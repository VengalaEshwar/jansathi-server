import Groq from "groq-sdk";
import sharp from "sharp";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import env from "../configs/env.config.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import cloudinary from "../configs/cloudinary.config.js";
import User from "../models/user.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const groq = new Groq({ apiKey: env.GROQ_API_KEY });

// Helper: map common field labels to user profile fields
const getProfileValue = (label, user) => {
  const l = label.toLowerCase();
  if (l.includes("name") && !l.includes("father") && !l.includes("mother")) return user.name || "";
  if (l.includes("phone") || l.includes("mobile")) return user.phone || "";
  if (l.includes("email")) return user.email || "";
  if (l.includes("age")) return user.personalInfo?.age?.toString() || "";
  if (l.includes("dob") || l.includes("date of birth") || l.includes("birth date")) return user.personalInfo?.dob || "";
  if (l.includes("gender")) return user.personalInfo?.gender || "";
  if (l.includes("address")) return user.personalInfo?.address || "";
  if (l.includes("city") || l.includes("location")) return user.personalInfo?.location || "";

  // Check extra fields
  const extra = user.personalInfo?.extra || [];
  const match = extra.find((e) => e.label.toLowerCase().includes(l) || l.includes(e.label.toLowerCase()));
  if (match) return match.value;

  return "";
};

// Helper: Clean up orphaned files older than 1 hour in the background
const cleanOldTempFiles = (dir) => {
  try {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    const now = Date.now();
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      // 3600000 ms = 1 hour
      if (now - stats.mtimeMs > 3600000) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    });
  } catch (err) {
    console.error("Cleanup error:", err);
  }
};

// Step 1: Extract form fields + pre-fill from user profile
export const extractFormFields = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Form image is required" });
    }

    // Run the cleanup utility to prevent orphaned files from building up
    const tempDir = path.join(__dirname, "../temp");
    cleanOldTempFiles(tempDir);

    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype;

    const response = await groq.chat.completions.create({
      model: "meta-llama/llama-4-maverick-17b-128e-instruct",
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a form analysis expert. Analyze this government form image and extract all fillable fields.

Return ONLY a valid JSON array, no explanation, no markdown, just raw JSON like this:
[
  {
    "id": "field_1",
    "label": "Full Name",
    "type": "text",
    "required": true,
    "placeholder": "Enter your full name"
  }
]

Field types can be: text, date, number, email, phone
Extract ALL fields visible in the form. Be thorough.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
          ],
        },
      ],
      max_tokens: 2048,
    });

    const content = response.choices[0].message.content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(500).json({ success: false, message: "Could not extract form fields" });
    }

    const fields = JSON.parse(jsonMatch[0]);

    // Pre-fill from user profile
    const user = await User.findOne({ uid: req.user.uid });
    const preFilledFields = fields.map((field) => ({
      ...field,
      value: getProfileValue(field.label, user),
      preFilledFromProfile: !!getProfileValue(field.label, user),
    }));

    // Save form image temporarily
    const imageId = `form_${Date.now()}`;
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const imagePath = path.join(tempDir, `${imageId}.jpg`);
    await sharp(req.file.buffer).jpeg().toFile(imagePath);

    res.json({ success: true, fields: preFilledFields, imageId });
  } catch (error) {
    console.error("Form extract error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to extract form fields" });
  }
};

// Step 2: Fill form, generate PDF, upload to Cloudinary, save history
export const fillForm = async (req, res) => {
  const { imageId, formData, saveToProfile } = req.body;
  const tempDir = path.join(__dirname, "../temp");
  const imagePath = imageId ? path.join(tempDir, `${imageId}.jpg`) : null;

  try {
    if (!imageId || !formData) {
      return res.status(400).json({ success: false, message: "imageId and formData are required" });
    }

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ success: false, message: "Form image not found or expired" });
    }

    const imageBytes = fs.readFileSync(imagePath);
    const imageMetadata = await sharp(imagePath).metadata();
    const imgWidth = imageMetadata.width || 800;
    const imgHeight = imageMetadata.height || 1100;

    // ── Build PDF ──────────────────────────────────────────────────
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595;
    const pageHeight = 842;

    // Page 1: original form image
    const jpgImage = await pdfDoc.embedJpg(imageBytes);
    const page1 = pdfDoc.addPage([pageWidth, pageHeight]);
    const scale = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
    const drawWidth = imgWidth * scale;
    const drawHeight = imgHeight * scale;
    page1.drawImage(jpgImage, {
      x: (pageWidth - drawWidth) / 2,
      y: (pageHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });

    const addDataPage = (isFirst = false) => {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      page.drawRectangle({ x: 0, y: pageHeight - 80, width: pageWidth, height: 80, color: rgb(0.39, 0.4, 0.95) });
      page.drawText("Filled Form Data", { x: 40, y: pageHeight - 45, size: 22, font: boldFont, color: rgb(1, 1, 1) });
      page.drawText(isFirst ? "Generated by JanSathi AI" : "Continued...", { x: 40, y: pageHeight - 65, size: 10, font, color: rgb(0.78, 0.8, 0.98) });
      page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 35, color: rgb(0.39, 0.4, 0.95) });
      page.drawText(`JanSathi • ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`, { x: 40, y: 12, size: 9, font, color: rgb(0.78, 0.8, 0.98) });
      return page;
    };

    let currentPage = addDataPage(true);
    let yPosition = pageHeight - 110;
    const entries = Object.entries(formData);

    for (let i = 0; i < entries.length; i++) {
      const [label, value] = entries[i];
      if (yPosition < 60) { currentPage = addDataPage(false); yPosition = pageHeight - 110; }
      const bgColor = i % 2 === 0 ? rgb(0.97, 0.97, 1) : rgb(1, 1, 1);
      currentPage.drawRectangle({ x: 30, y: yPosition - 38, width: pageWidth - 60, height: 48, color: bgColor, borderColor: rgb(0.85, 0.85, 0.95), borderWidth: 1 });
      currentPage.drawText(String(label), { x: 42, y: yPosition - 14, size: 9, font: boldFont, color: rgb(0.39, 0.4, 0.95) });
      currentPage.drawText(String(value || "—").substring(0, 80), { x: 42, y: yPosition - 30, size: 12, font, color: rgb(0.1, 0.1, 0.1) });
      yPosition -= 56;
    }

    const pdfBytes = await pdfDoc.save();

    // ── Upload PDF to Cloudinary ───────────────────────────────────
   const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { 
          folder: "jansathi/forms", 
          resource_type: "raw", 
          format: "pdf",
          type: "upload", // make sure it's public upload
          access_mode: "public",
        },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(Buffer.from(pdfBytes));
    });

    const { secure_url: pdfUrl, public_id: pdfPublicId } = uploadResult;

    // ── Save to user form history (max 3) ─────────────────────────
    const user = await User.findOne({ uid: req.user.uid });
    const formHistory = user?.formHistory || [];

    if (formHistory.length >= 3) {
      const oldest = formHistory[0];
      if (oldest.pdfPublicId) {
        await cloudinary.uploader.destroy(oldest.pdfPublicId, { resource_type: "raw" });
      }
      await User.findOneAndUpdate({ uid: req.user.uid }, { $pop: { formHistory: -1 } });
    }

    const formFields = Object.entries(formData).map(([label, value]) => ({ label, value: String(value) }));
    await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $push: { formHistory: { pdfUrl, pdfPublicId, formFields, createdAt: new Date() } } }
    );

    // ── Optionally save new data to personalInfo.extra ────────────
    if (saveToProfile && Array.isArray(saveToProfile) && saveToProfile.length > 0) {
      const currentUser = await User.findOne({ uid: req.user.uid });
      const existingExtra = currentUser?.personalInfo?.extra || [];

      const updatedExtra = [...existingExtra];
      for (const { label, value } of saveToProfile) {
        const existingIndex = updatedExtra.findIndex(
          (e) => e.label.toLowerCase() === label.toLowerCase()
        );
        if (existingIndex >= 0) {
          updatedExtra[existingIndex].value = value;
        } else {
          updatedExtra.push({ label, value });
        }
      }

      await User.findOneAndUpdate(
        { uid: req.user.uid },
        { $set: { "personalInfo.extra": updatedExtra } }
      );
    }

    res.json({ success: true, pdfUrl, message: "Form filled successfully" });
  } catch (error) {
    console.error("Form fill error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to fill form" });
  } finally {
    // ── GUARANTEED CLEANUP ────────────────────────────────────────
    // This block ALWAYS runs, even if the PDF or Cloudinary upload crashes.
    if (imagePath && fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
      } catch (cleanupError) {
        console.error("Failed to clean up temp file:", cleanupError);
      }
    }
  }
};

// Step 3: Get form history
export const getFormHistory = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, history: [...(user.formHistory || [])].reverse() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};