// claude.js
// Wraps the Anthropic Messages API call for the voice assistant.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-haiku-4-5-20251001"; // fast + cheap, good fit for voice replies

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

async function askClaude(question, contextNotes = []) {
  let contextBlock = "";
  if (contextNotes.length > 0) {
    contextBlock =
      "\n\nRelevant notes from Guru's Obsidian vault:\n\n" +
      contextNotes
        .map((n) => `--- ${n.name} ---\n${n.content.slice(0, 3000)}`)
        .join("\n\n");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${question}${contextBlock}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const textBlocks = data.content.filter((b) => b.type === "text").map((b) => b.text);
  return textBlocks.join(" ").trim();
}

module.exports = { askClaude };
