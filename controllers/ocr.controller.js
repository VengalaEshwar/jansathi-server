import Groq from "groq-sdk";
import env from "../configs/env.config.js";

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

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
    res.json({ success: true, analysis });
  } catch (error) {
    console.error("Medicine analysis error:", error);
    res.status(500).json({ success: false, message: error.message || "Analysis failed" });
  }
};