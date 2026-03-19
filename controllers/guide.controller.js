import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import env from "../configs/env.config.js";

const ai   = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
const groq = new Groq({ apiKey: env.GROQ_API_KEY });

// ── System prompt ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a government services guide assistant for rural India.
Generate clear, simple step-by-step guides for government procedures.

Respond ONLY with valid JSON in this exact shape — no markdown, no explanation:
{
  "title": "procedure name",
  "description": "1 sentence description",
  "totalTime": "estimated total time",
  "difficulty": "Easy" | "Medium" | "Hard",
  "requirements": ["requirement 1", "requirement 2"],
  "steps": [
    {
      "number": 1,
      "title": "step title",
      "description": "clear description of what to do",
      "tip": "optional helpful tip or null",
      "duration": "time estimate for this step"
    }
  ],
  "helpline": "helpline number if any or null",
  "website": "official URL if any or null"
}

Rules:
- Max 8 steps
- Keep language very simple — assume low literacy
- Each step description must be actionable and specific
- Include real Indian government URLs and helplines where known
- Return ONLY the JSON object, nothing else`;

// ── AI callers ─────────────────────────────────────────────────────────────────
const callGemini = async (query) => {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-lite",
    contents: `${SYSTEM_PROMPT}\n\nGenerate a step-by-step guide for: ${query}`,
  });
  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned empty response");
  return text;
};

const callGroq = async (query) => {
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: `Generate a step-by-step guide for: ${query}` },
    ],
    max_tokens: 1500,
  });
  const text = response.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq returned empty response");
  return text;
};

// ── POST /guide/generate ───────────────────────────────────────────────────────
export const generateGuide = async (req, res) => {
  try {
    const { query } = req.body;

    if (!query?.trim()) {
      return res.status(400).json({ success: false, message: "Query is required" });
    }

    console.log(`[guide] generating for: "${query}"`);

    let rawText;
    let provider = "gemini";

    // Gemini first, Groq fallback
    try {
      rawText = await callGemini(query);
      console.log("[guide] Gemini responded");
    } catch (geminiErr) {
      console.warn("[guide] Gemini failed:", geminiErr.message, "— trying Groq");
      provider = "groq";
      try {
        rawText = await callGroq(query);
        console.log("[guide] Groq fallback responded");
      } catch (groqErr) {
        console.error("[guide] Both failed:", groqErr.message);
        return res.status(500).json({
          success: false,
          message: "Both AI providers are unavailable. Please try again later.",
        });
      }
    }

    // Strip accidental markdown fences and parse
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const guide   = JSON.parse(cleaned);

    // Validate required fields
    if (!guide.title || !guide.steps || !Array.isArray(guide.steps)) {
      throw new Error("Invalid guide structure returned by AI");
    }

    // Normalise — ensure steps have correct shape
    guide.steps = guide.steps.map((s, i) => ({
      number:      s.number      ?? i + 1,
      title:       s.title       ?? `Step ${i + 1}`,
      description: s.description ?? "",
      tip:         s.tip         || null,
      duration:    s.duration    || null,
    }));

    // Normalise top-level optional fields
    guide.helpline = guide.helpline || null;
    guide.website  = guide.website  || null;
    guide.requirements = Array.isArray(guide.requirements) ? guide.requirements : [];

    res.json({ success: true, guide, provider });
  } catch (error) {
    console.error("[guide] generateGuide error:", error.message);

    // If JSON parse failed, tell the client clearly
    if (error instanceof SyntaxError) {
      return res.status(500).json({
        success: false,
        message: "AI returned malformed response. Please try again.",
      });
    }

    res.status(500).json({ success: false, message: error.message });
  }
};