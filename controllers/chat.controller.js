import { GoogleGenAI } from "@google/genai";
import env from "../configs/env.config.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export const chat = async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    // Build conversation context from history
    const historyText = conversationHistory
      .map((m) => `${m.role === "assistant" ? "JanSathi AI" : "User"}: ${m.content}`)
      .join("\n");

    const prompt = `You are JanSathi AI, a helpful assistant for Indian citizens.
You help with government schemes, health services, form filling, and general queries.
Keep responses concise and friendly. Support Hindi and English.

${historyText ? `Previous conversation:\n${historyText}\n\n` : ""}User: ${message}
JanSathi AI:`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
    //   model: "gemini-3.1-flash-preview",
      contents: prompt,
    });

    res.json({ success: true, reply: response.text });
  } catch (error) {
    console.error("Gemini error:", error);
    res.status(500).json({ success: false, message: error.message || "AI error" });
  }
};