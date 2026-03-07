// import Groq from "groq-sdk";
// import env from "../configs/env.config.js";

// const groq = new Groq({ apiKey: env.GROQ_API_KEY });

// export const chat = async (req, res) => {
//   try {
//     const { message, conversationHistory = [], language = "en" } = req.body;

//     if (!message) {
//       return res.status(400).json({ success: false, message: "Message is required" });
//     }

//     const historyText = conversationHistory
//       .map((m) => `${m.role === "assistant" ? "JanSathi AI" : "User"}: ${m.content}`)
//       .join("\n");

//     const languageInstruction = language === "hi"
//       ? "Always respond in Hindi (Devanagari script). Be simple and clear."
//       : "Always respond in English. Be simple and clear.";

//     const prompt = `You are JanSathi AI, a helpful voice assistant for Indian citizens.
// You help with government schemes, health services, form filling, and general queries.
// Keep responses SHORT and conversational — max 3 sentences. No bullet points, no markdown.
// ${languageInstruction}

// ${historyText ? `Previous conversation:\n${historyText}\n\n` : ""}User: ${message}
// JanSathi AI:`;

//     const response = await groq.chat.completions.create({
//       model: "llama-3.1-8b-instant",
//       messages: [{ role: "user", content: prompt }],
//       max_tokens: 200,
//     });

//     const reply = response.choices[0].message.content;
//     res.json({ success: true, reply });
//   } catch (error) {
//     console.error("Chat error:", error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };


import { GoogleGenAI } from "@google/genai";
import env from "../configs/env.config.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export const chat = async (req, res) => {
  try {
    const { message, conversationHistory = [], language  } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    const historyText = conversationHistory
      .map((m) => `${m.role === "assistant" ? "JanSathi AI" : "User"}: ${m.content}`)
      .join("\n");
    console.log("language : ",language);
    const languageInstruction = language === "hi"
      ? "Always respond in Hindi (Devanagari script). Be simple and clear."
      : "Always respond in English. Be simple and clear.";

    const prompt = `You are JanSathi AI, a helpful voice assistant for Indian citizens.
You help with government schemes, health services, form filling, and general queries.
Keep responses SHORT and conversational — max 3 sentences. No bullet points, no markdown.
${languageInstruction}

${historyText ? `Previous conversation:\n${historyText}\n\n` : ""}User: ${message}
JanSathi AI:`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
    //   model: "gemini-3.1-flash-preview",
      contents: prompt,
    });

    const reply = response.text;
    res.json({ success: true, reply });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};