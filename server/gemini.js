// gemini.js
// Wraps the Google Gemini API call for the voice assistant.
// Uses the free-tier Flash model - no billing required to start.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash"; // fast + free-tier, good fit for voice replies

const SYSTEM_PROMPT = `You are Guru's personal voice assistant, running on his Samsung
Galaxy Tab A9+. Guru is a solo founder (Guru Automations Limited, based in Trinidad
and Tobago) building: Lead Guru (WhatsApp AI lead gen SaaS), CaribKeys/Keylo
(Caribbean real estate marketplace), TenantPass (tenant verification platform),
AMI (marketing audit tool), and MicroReceipts (receipt generator PWA).

You may be given relevant notes from his Obsidian vault as context - use them if
present and relevant, and say so briefly ("your notes say...") when you do. If no
notes are provided or relevant, just answer from general knowledge.

This is a SPOKEN interface - the answer will be read aloud by text-to-speech, so:
- Keep answers to 2-3 short sentences whenever possible.
- Never use markdown, bullet points, numbered lists, or code blocks.
- Speak naturally, like a person talking, not like you're writing a document.
- If the question genuinely needs more detail, say so briefly and offer to
  go deeper, rather than dumping a long answer.`;

async function askGemini(question, contextNotes = []) {
  let contextBlock = "";
  if (contextNotes.length > 0) {
    contextBlock =
      "\n\nRelevant notes from Guru's Obsidian vault:\n\n" +
      contextNotes
        .map((n) => `--- ${n.name} ---\n${n.content.slice(0, 3000)}`)
        .join("\n\n");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: `${question}${contextBlock}` }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 300,
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const answer = parts.map((p) => p.text || "").join(" ").trim();

  if (!answer) {
    throw new Error("Gemini returned no usable response text.");
  }
  return answer;
}

module.exports = { askGemini };
