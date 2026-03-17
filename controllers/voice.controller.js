// controllers/voice.controller.js
// POST /api/voice/command
//
// Request body:
//   message             — user's command (wake word already stripped)
//   routeMap            — { "alias": "/route", ... } — alias → route only
//   language            — "en" | "hi" | "te" etc.
//   currentRoute        — e.g. "/" or "/health/prescription-reader"
//   currentScreenName   — e.g. "Home" or "Prescription Reader"
//   conversationHistory — optional [{ role, content }]
//
// Response:
//   { message, speakText, navigateTo? }

import { GoogleGenAI } from "@google/genai";
import Groq            from "groq-sdk";
import env             from "../configs/env.config.js";

const ai   = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
const groq = new Groq({ apiKey: env.GROQ_API_KEY });

const LANGUAGE_NAMES = {
  en: "English", hi: "Hindi",  te: "Telugu",
  ta: "Tamil",   kn: "Kannada", ml: "Malayalam",
  mr: "Marathi", bn: "Bengali", gu: "Gujarati", pa: "Punjabi",
};

// ── Build AI prompt ───────────────────────────────────────────────────────────
function buildPrompt({ message, routeMap, language, currentRoute, currentScreenName, conversationHistory }) {
  const langName = LANGUAGE_NAMES[language] ?? LANGUAGE_NAMES[language?.split("-")[0]] ?? "English";

  const historyStr = conversationHistory?.length
    ? conversationHistory.slice(-4)
        .map((m) => `${m.role === "user" ? "User" : "JanSathi"}: ${m.content}`)
        .join("\n")
    : "";

  // Format: "alias" → /route   (sorted so related routes group together)
  const aliasLines = Object.entries(routeMap)
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([alias, route]) => `  "${alias}" → ${route}`)
    .join("\n");

  return `You are the voice assistant for JanSathi — a mobile app for rural Indian citizens.
JanSathi has ONLY these screens (listed as "what the user might say" → route to navigate to):

${aliasLines}

User is currently on: "${currentScreenName}" (${currentRoute})
User language: ${langName}
${historyStr ? `\nRecent conversation:\n${historyStr}\n` : ""}
User just said: "${message}"

DECIDE: Is this a NAVIGATION command or a QUESTION/CONVERSATION?

NAVIGATION — user explicitly wants to OPEN a screen. Only these patterns count:
• "open X", "go to X", "take me to X", "navigate to X", "show X", "launch X"
• Saying ONLY a screen name with nothing else: "health services", "volunteer network", "profile"
• "I want to see X", "show me X screen"
→ Return navigateTo with the best matching route.
→ If matched route equals current route → already there, no navigateTo.

QUESTION/CONVERSATION — answer directly, NO navigateTo:
• "how to X", "how do I X", "what is X", "tell me about X", "explain X"
• "how to apply for pan card" → answer the question about pan card
• "what schemes am I eligible for" → answer about schemes
• "what is jansathi" → explain the app
• ANY sentence with a question word or descriptive intent
→ Answer in 1-2 sentences. DO NOT return navigateTo.
→ If the answer involves a JanSathi feature, mention it naturally.
→ Example: "how to apply for pan card" → "You can follow step-by-step guidance in JanSathi's Step Guides feature."

RULES:
- NEVER mention external apps, websites, or platforms.
- NEVER return navigateTo for questions — only for explicit open/go/navigate commands.
- Keep message to 1-2 sentences max.
- Respond in ${langName}.
- For Hindi/Telugu: speakText = Roman phonetic transliteration for en-IN TTS. For English: speakText = message.
- Return ONLY valid JSON. No markdown, no explanation.

Format when navigating:    {"message":"Opening Step Guides...","speakText":"Opening Step Guides...","navigateTo":"/g-assist/step-guides"}
Format when already there: {"message":"You are already on ${currentScreenName}!","speakText":"You are already on ${currentScreenName}!"}
Format when answering:     {"message":"You can apply for a PAN card by visiting the NSDL website or use JanSathi's Step Guides for help.","speakText":"You can apply for a PAN card by visiting the NSDL website or use JanSathi's Step Guides for help."}`;
}

// ── Parse AI JSON response safely ─────────────────────────────────────────────
function parseAIResponse(raw) {
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end   = clean.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON");
    return JSON.parse(clean.slice(start, end + 1));
  } catch {
    return { message: raw.trim(), speakText: raw.trim() };
  }
}

// ── Validate navigateTo is a real route in our map ────────────────────────────
function validateRoute(navigateTo, routeMap) {
  if (!navigateTo) return undefined;
  // routeMap values are routes — check if navigateTo is one of them
  const validRoutes = new Set(Object.values(routeMap));
  return validRoutes.has(navigateTo) ? navigateTo : undefined;
}

// ── Gemini ────────────────────────────────────────────────────────────────────
async function callGemini(prompt) {
  const response = await ai.models.generateContent({
    model:    "gemini-2.0-flash-lite",
    contents: prompt,
  });
  const reply = response.text;
  if (!reply) throw new Error("Gemini returned empty");
  return reply;
}

// ── Groq fallback ─────────────────────────────────────────────────────────────
async function callGroq(prompt) {
  const response = await groq.chat.completions.create({
    model:       "llama-3.1-8b-instant",
    messages:    [{ role: "user", content: prompt }],
    max_tokens:  200,
    temperature: 0.1,   // lower = more deterministic navigation
  });
  const reply = response.choices?.[0]?.message?.content;
  if (!reply) throw new Error("Groq returned empty");
  return reply;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function handleVoiceCommand(req, res) {
  try {
    const {
      message,
      routeMap            = {},
      language            = "en",
      currentRoute        = "/",
      currentScreenName   = "Home",
      conversationHistory = [],
    } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: "message is required" });
    }

    console.log(`[voice] "${message}" | screen: ${currentScreenName} | lang: ${language}`);

    const prompt = buildPrompt({
      message, routeMap, language, currentRoute, currentScreenName, conversationHistory,
    });

    // ── Gemini → Groq fallback ────────────────────────────────────────────
    let rawResponse;
    let usedFallback = false;

    try {
      rawResponse = await callGemini(prompt);
      console.log("[voice] Gemini:", rawResponse.slice(0, 150).replace(/\n/g, " "));
    } catch (geminiErr) {
      console.warn("[voice] Gemini failed:", geminiErr.message, "→ Groq");
      usedFallback = true;
      try {
        rawResponse = await callGroq(prompt);
        console.log("[voice] Groq:", rawResponse.slice(0, 150).replace(/\n/g, " "));
      } catch (groqErr) {
        console.error("[voice] Both failed:", groqErr.message);
        return res.status(500).json({
          success:   false,
          message:   "Service unavailable. Please try again.",
          speakText: "Service unavailable. Please try again.",
        });
      }
    }

    const parsed     = parseAIResponse(rawResponse);

    // ── Server-side safety net ────────────────────────────────────────────
    // If the message looks like a question/how-to, strip navigateTo even if
    // the AI incorrectly returned one. This prevents "how to apply for pan card"
    // from navigating instead of answering.
    const questionPatterns = [
      /^how\b/i, /^what\b/i, /^why\b/i, /^when\b/i, /^where\b/i,
      /^who\b/i, /^which\b/i, /^can\b/i, /^is\b/i, /^are\b/i,
      /^does\b/i, /^do\b/i, /^tell me/i, /^explain/i,
      /\?$/, /how to\b/i, /how do\b/i, /how can\b/i,
    ];
    const isQuestion = questionPatterns.some((p) => p.test(message.trim()));
    if (isQuestion && parsed.navigateTo) {
      console.log(`[voice] stripping navigateTo — message looks like a question: "${message}"`);
      delete parsed.navigateTo;
    }

    const navigateTo = validateRoute(parsed.navigateTo, routeMap);

    console.log(`[voice] navigateTo: ${navigateTo ?? "none"} | alreadyHere: ${navigateTo === currentRoute}`);

    // Safety net — if AI navigated to current screen despite prompt instructions
    const alreadyHere = navigateTo && navigateTo === currentRoute;

    const alreadyMsg =
      language === "hi" ? `आप पहले से ${currentScreenName} पर हैं!` :
      language === "te" ? `మీరు ఇప్పటికే ${currentScreenName}పై ఉన్నారు!` :
                          `You're already on ${currentScreenName}!`;

    return res.json({
      success:   true,
      message:   alreadyHere ? alreadyMsg : (parsed.message   || ""),
      speakText: alreadyHere ? alreadyMsg : (parsed.speakText || parsed.message || ""),
      ...(navigateTo && !alreadyHere ? { navigateTo } : {}),
      ...(usedFallback ? { provider: "groq" } : {}),
    });

  } catch (err) {
    console.error("[voice] unexpected error:", err);
    return res.status(500).json({
      success:   false,
      message:   "Something went wrong. Please try again.",
      speakText: "Something went wrong. Please try again.",
    });
  }
}