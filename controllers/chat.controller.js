import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import env from "../configs/env.config.js";

const ai   = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
const groq = new Groq({ apiKey: env.GROQ_API_KEY });

// ── Language instruction map ───────────────────────────────────────────────────
const LANGUAGE_INSTRUCTIONS = {
  en: "Always respond in English. Be simple and clear.",
  hi: "Always respond in Hindi (Devanagari script). Be simple and clear.",
  te: "Always respond in Telugu (Telugu script). Be simple and clear.",
  ta: "Always respond in Tamil (Tamil script). Be simple and clear.",
  kn: "Always respond in Kannada (Kannada script). Be simple and clear.",
  ml: "Always respond in Malayalam (Malayalam script). Be simple and clear.",
  mr: "Always respond in Marathi (Devanagari script). Be simple and clear.",
  bn: "Always respond in Bengali (Bengali script). Be simple and clear.",
  gu: "Always respond in Gujarati (Gujarati script). Be simple and clear.",
  pa: "Always respond in Punjabi (Gurmukhi script). Be simple and clear.",
  ur: "Always respond in Urdu (Nastaliq script). Be simple and clear.",
  or: "Always respond in Odia (Odia script). Be simple and clear.",
};

const getLanguageInstruction = (language) => {
  if (!language) return LANGUAGE_INSTRUCTIONS.en;
  if (LANGUAGE_INSTRUCTIONS[language]) return LANGUAGE_INSTRUCTIONS[language];
  const prefix = language.split("-")[0].toLowerCase();
  if (LANGUAGE_INSTRUCTIONS[prefix]) return LANGUAGE_INSTRUCTIONS[prefix];
  return `Always respond in the language with code "${language}". Be simple and clear.`;
};

const buildPrompt = (message, conversationHistory, language) => {
  const historyText = conversationHistory
    .map((m) => `${m.role === "assistant" ? "JanSathi AI" : "User"}: ${m.content}`)
    .join("\n");

  const languageInstruction = getLanguageInstruction(language);

  return `You are JanSathi AI, a helpful assistant for Indian citizens.
You help with government schemes, health services, form filling, and general queries.
Keep responses SHORT and conversational — max 3 sentences. No bullet points, no markdown.
${languageInstruction}

${historyText ? `Previous conversation:\n${historyText}\n\n` : ""}User: ${message}
JanSathi AI:`;
};

// ── Primary: Gemini ───────────────────────────────────────────────────────────
const callGemini = async (prompt) => {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-lite",
    contents: prompt,
  });
  const reply = response.text;
  if (!reply) throw new Error("Gemini returned empty response");
  return reply;
};

// ── Fallback: Groq ────────────────────────────────────────────────────────────
const callGroq = async (prompt) => {
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 200,
  });
  const reply = response.choices?.[0]?.message?.content;
  if (!reply) throw new Error("Groq returned empty response");
  return reply;
};

// ── Main handler ──────────────────────────────────────────────────────────────
export const chat = async (req, res) => {
  try {
    const { message, conversationHistory = [], language } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    const prompt = buildPrompt(message, conversationHistory, language);
    console.log(`[chat] language: ${language ?? "en"}`);

    let reply;
    let usedFallback = false;

    // Try Gemini first
    try {
      reply = await callGemini(prompt);
      console.log("[chat] responded via Gemini");
    } catch (geminiError) {
      console.warn("[chat] Gemini failed:", geminiError.message, "— falling back to Groq");
      usedFallback = true;

      // Fall back to Groq
      try {
        reply = await callGroq(prompt);
        console.log("[chat] responded via Groq (fallback)");
      } catch (groqError) {
        // Both failed
        console.error("[chat] Groq fallback also failed:", groqError.message);
        return res.status(500).json({
          success: false,
          message: "Both AI providers are unavailable. Please try again later.",
        });
      }
    }

    res.json({ success: true, reply, ...(usedFallback && { provider: "groq" }) });
  } catch (error) {
    console.error("[chat] Unexpected error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};