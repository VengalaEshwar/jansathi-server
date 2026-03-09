import Groq from "groq-sdk";
import env from "../configs/env.config.js";
import cloudinary from "../configs/cloudinary.config.js";
import User from "../models/user.model.js";
import verifyFirebaseToken from "../utils/firebaseAuth.js";

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

// Helper: upload buffer to Cloudinary
const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, transformation: [{ quality: "auto", fetch_format: "auto" }] },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
};

// Helper: save to user history (max 10, delete oldest from Cloudinary)
const saveToHistory = async (uid, type, imageUrl, imagePublicId, result) => {
  try {
    const user = await User.findOne({ uid });
    if (!user) return;

    const historyField = type === "prescription" ? "prescriptionHistory" : "medicineHistory";
    const history = user[historyField] || [];

    // If already 10 entries, delete the oldest image from Cloudinary
    if (history.length >= 10) {
      const oldest = history[0];
      if (oldest.imagePublicId) {
        await cloudinary.uploader.destroy(oldest.imagePublicId);
      }
      // Remove oldest from array
      await User.findOneAndUpdate(
        { uid },
        { $pop: { [historyField]: -1 } } // -1 removes first element
      );
    }

    // Push new entry
    await User.findOneAndUpdate(
      { uid },
      {
        $push: {
          [historyField]: { imageUrl, imagePublicId, result, createdAt: new Date() },
        },
      }
    );
  } catch (e) {
    console.error("Failed to save history:", e.message);
  }
};

export const readPrescription = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Image is required" });
    }

    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype;

    const response = await groq.chat.completions.create({
      model: "meta-llama/llama-4-maverick-17b-128e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a medical OCR assistant. Extract information from this prescription image and respond in clean markdown format. Be concise and simple.

Use exactly this format:

## 👤 Patient Info
- **Name:** [name]
- **Age:** [age]
- **Date:** [date]

## 💊 Medicines
| Medicine | Dose | Frequency |
|----------|------|-----------|
| [name] | [dose] | [frequency in simple words] |

## 🩺 Doctor
- **Name:** [doctor name]

## ⚠️ Important Notes
- [any warnings or special instructions, or "None" if not present]

Keep it simple. Use plain English for frequency (e.g. "Twice a day" not "BID").`,
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

    const prescriptionText = response.choices[0].message.content;

    // Upload image to Cloudinary and save to history
    try {
      const uploaded = await uploadToCloudinary(req.file.buffer, "jansathi/prescriptions");
      await saveToHistory(
        req.user.uid,
        "prescription",
        uploaded.secure_url,
        uploaded.public_id,
        prescriptionText
      );
    } catch (e) {
      console.error("History save failed (non-critical):", e.message);
    }

    res.json({ success: true, prescriptionText });
  } catch (error) {
    console.error("OCR error:", error);
    res.status(500).json({ success: false, message: error.message || "OCR failed" });
  }
};

export const analyzeMedicine = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Image is required" });
    }

    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype;

    const response = await groq.chat.completions.create({
      model: "meta-llama/llama-4-maverick-17b-128e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a medicine analysis expert. Analyze this medicine image and respond in clean markdown. Be concise.

Use exactly this format:

## 💊 Medicine Info
- **Name:** [name]
- **Manufacturer:** [manufacturer]
- **Expiry Date:** [expiry]
- **Batch Number:** [batch]

## 🧪 Composition
- [active ingredients]

## 📖 Usage
- [what it's used for, 1-2 lines]

## ⚠️ Side Effects
- [common side effects, keep it brief]

## ✅ Safety Status
- **Status:** [SAFE / EXPIRED / UNKNOWN]
- **Warnings:** [any warnings or "None"]

Keep it simple and easy to understand.`,
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

    const analysis = response.choices[0].message.content;

    // Upload image to Cloudinary and save to history
    try {
      const uploaded = await uploadToCloudinary(req.file.buffer, "jansathi/medicines");
      await saveToHistory(
        req.user.uid,
        "medicine",
        uploaded.secure_url,
        uploaded.public_id,
        analysis
      );
    } catch (e) {
      console.error("History save failed (non-critical):", e.message);
    }

    res.json({ success: true, analysis });
  } catch (error) {
    console.error("Medicine analysis error:", error);
    res.status(500).json({ success: false, message: error.message || "Analysis failed" });
  }
};
export const getHistory = async (req, res) => {
  try {
    const { type } = req.params; // "prescription" or "medicine"
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const history = type === "prescription"
      ? user.prescriptionHistory
      : user.medicineHistory;

    // Return newest first
    res.json({ success: true, history: [...history].reverse() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};