import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";
import env from "../configs/env.config.js";
import cloudinary from "../configs/cloudinary.config.js";
import User from "../models/user.model.js";

const groq = new Groq({ apiKey: env.GROQ_API_KEY });
const ai   = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// ── Upload to Cloudinary ───────────────────────────────────────────────────────
const uploadToCloudinary = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, transformation: [{ quality: "auto", fetch_format: "auto" }] },
      (error, result) => { if (error) reject(error); else resolve(result); }
    );
    stream.end(buffer);
  });

// ── Use Groq to extract medicine names from OCR markdown result ───────────────
// Returns a clean string[] like ["Paracetamol", "Metformin", "Aspirin"]
const extractMedicinesWithGroq = async (ocrResult) => {
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `You are a medical data extractor. Extract all medicine/drug names from the given text.
Return ONLY a JSON array of medicine name strings. No explanation, no markdown, no extra text.
Example output: ["Paracetamol", "Metformin", "Aspirin"]
If no medicines found, return: []`,
        },
        {
          role: "user",
          content: `Extract all medicine names from this text:\n\n${ocrResult}`,
        },
      ],
      max_tokens: 200,
    });

    const raw = response.choices?.[0]?.message?.content?.trim() ?? "[]";
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed  = JSON.parse(cleaned);

    // Validate it's actually an array of strings
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m) => typeof m === "string" && m.trim().length > 1);
  } catch (err) {
    console.error("[extractMedicines] Groq extraction failed:", err.message);
    return []; // non-critical — save empty array, don't break the main OCR response
  }
};

// ── Save entry to history (max 10, evict oldest from Cloudinary) ───────────────
const saveToHistory = async (uid, type, imageUrl, imagePublicId, result, medicines) => {
  try {
    const historyField = type === "prescription" ? "prescriptionHistory" : "medicineHistory";
    const user = await User.findOne({ uid });
    if (!user) return;

    if ((user[historyField] || []).length >= 10) {
      const oldest = user[historyField][0];
      if (oldest?.imagePublicId) {
        await cloudinary.uploader.destroy(oldest.imagePublicId).catch(() => {});
      }
      await User.findOneAndUpdate({ uid }, { $pop: { [historyField]: -1 } });
    }

    await User.findOneAndUpdate(
      { uid },
      {
        $push: {
          [historyField]: {
            imageUrl,
            imagePublicId,
            result,
            medicines, // ✅ extracted medicine names stored directly
            createdAt: new Date(),
          },
        },
      }
    );
  } catch (e) {
    console.error("saveToHistory failed (non-critical):", e.message);
  }
};

// ── Prescription Reader ────────────────────────────────────────────────────────
export const readPrescription = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Image is required" });
    }

    const base64Image = req.file.buffer.toString("base64");
    const mimeType    = req.file.mimetype;

    // Step 1: OCR with Groq vision
    const ocrResponse = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [{
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
      }],
      max_tokens: 2048,
    });

    const prescriptionText = ocrResponse.choices[0].message.content;

    // Step 2: Extract medicine names with Groq (runs in parallel with upload)
    const [medicines, uploadResult] = await Promise.allSettled([
      extractMedicinesWithGroq(prescriptionText),
      uploadToCloudinary(req.file.buffer, "jansathi/prescriptions"),
    ]);

    const extractedMedicines = medicines.status === "fulfilled" ? medicines.value : [];
    const uploaded = uploadResult.status === "fulfilled" ? uploadResult.value : null;

    console.log(`[prescription] extracted medicines: ${extractedMedicines.join(", ") || "none"}`);

    // Step 3: Save to history with extracted medicines
    if (uploaded) {
      await saveToHistory(
        req.user.uid,
        "prescription",
        uploaded.secure_url,
        uploaded.public_id,
        prescriptionText,
        extractedMedicines
      );
    }

    res.json({ success: true, prescriptionText, medicines: extractedMedicines });
  } catch (error) {
    console.error("readPrescription error:", error);
    res.status(500).json({ success: false, message: error.message || "OCR failed" });
  }
};

// ── Medicine Scanner ───────────────────────────────────────────────────────────
export const analyzeMedicine = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Image is required" });
    }

    const base64Image = req.file.buffer.toString("base64");
    const mimeType    = req.file.mimetype;

    // Step 1: Analyze with Groq vision
    const ocrResponse = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [{
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
      }],
      max_tokens: 2048,
    });

    const analysis = ocrResponse.choices[0].message.content;

    // Step 2: Extract medicine names + upload in parallel
    const [medicines, uploadResult] = await Promise.allSettled([
      extractMedicinesWithGroq(analysis),
      uploadToCloudinary(req.file.buffer, "jansathi/medicines"),
    ]);

    const extractedMedicines = medicines.status === "fulfilled" ? medicines.value : [];
    const uploaded = uploadResult.status === "fulfilled" ? uploadResult.value : null;

    console.log(`[medicine] extracted medicines: ${extractedMedicines.join(", ") || "none"}`);

    // Step 3: Save to history with extracted medicines
    if (uploaded) {
      await saveToHistory(
        req.user.uid,
        "medicine",
        uploaded.secure_url,
        uploaded.public_id,
        analysis,
        extractedMedicines
      );
    }

    res.json({ success: true, analysis, medicines: extractedMedicines });
  } catch (error) {
    console.error("analyzeMedicine error:", error);
    res.status(500).json({ success: false, message: error.message || "Analysis failed" });
  }
};

// ── Get OCR History ────────────────────────────────────────────────────────────
export const getHistory = async (req, res) => {
  try {
    const { type } = req.params;
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const history = type === "prescription"
      ? user.prescriptionHistory
      : user.medicineHistory;

    res.json({ success: true, history: [...history].reverse() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Get all medicines from scan history (for danger alert matching) ─────────────
// GET /ocr/my-medicines
// Reads the stored medicines[] array from DB — no regex parsing needed
export const getMyMedicines = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const allNames = new Map(); // name → { from, date }

    // From medicine scanner
    for (const entry of user.medicineHistory || []) {
      for (const name of entry.medicines || []) {
        if (!allNames.has(name)) {
          allNames.set(name, { from: "medicine-scanner", date: entry.createdAt });
        }
      }
    }

    // From prescription reader
    for (const entry of user.prescriptionHistory || []) {
      for (const name of entry.medicines || []) {
        if (!allNames.has(name)) {
          allNames.set(name, { from: "prescription-reader", date: entry.createdAt });
        }
      }
    }

    const medicines = [...allNames.keys()];
    const sources   = [...allNames.entries()].map(([name, meta]) => ({ name, ...meta }));

    res.json({ success: true, medicines, sources });
  } catch (error) {
    console.error("getMyMedicines error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── AI Drug Interaction Check (Gemini primary, Groq fallback) ──────────────────
// POST /ocr/check-interactions
export const checkInteractions = async (req, res) => {
  try {
    const { medicines } = req.body;

    if (!medicines || medicines.length < 2) {
      return res.status(400).json({ success: false, message: "At least 2 medicines required" });
    }

    const systemPrompt = `You are a clinical pharmacist assistant for rural India. Analyze drug interactions.
Respond ONLY as valid JSON with no markdown, no code fences, no explanation:
{"safe":boolean,"riskLevel":"high"|"medium"|"low"|"none","summary":"plain language 1-2 sentences","interactions":[{"pair":"Drug A + Drug B","risk":"high"|"medium"|"low","effect":"what happens","advice":"what to do"}],"generalAdvice":"overall recommendation"}`;

    const userPrompt = `Check drug interactions for: ${medicines.join(", ")}`;

    let resultText;

    // Try Gemini first
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-lite",
        contents: `${systemPrompt}\n\n${userPrompt}`,
      });
      resultText = response.text?.trim();
      if (!resultText) throw new Error("Empty response");
      console.log("[interactions] Gemini responded");
    } catch (geminiErr) {
      console.warn("[interactions] Gemini failed:", geminiErr.message, "— trying Groq");
      const response = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
        max_tokens: 600,
      });
      resultText = response.choices?.[0]?.message?.content?.trim();
      if (!resultText) throw new Error("Groq returned empty response");
      console.log("[interactions] Groq fallback responded");
    }

    const cleaned = resultText.replace(/```json|```/g, "").trim();
    const result  = JSON.parse(cleaned);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error("checkInteractions error:", error);
    res.status(500).json({ success: false, message: error.message || "Interaction check failed" });
  }
};