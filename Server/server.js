require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { findRelevantNotes } = require("./dropbox");
const { askClaude } = require("./claude");

const app = express();
app.use(cors());
app.use(express.json());

// Keywords that suggest the question is about one of Guru's own projects,
// worth checking the Obsidian vault for context before answering.
const BUSINESS_KEYWORDS = [
  "lead guru", "leadguru", "caribkeys", "keylo", "tenantpass", "ami",
  "microreceipts", "micro receipts", "trading", "gold", "xauusd", "prop firm",
  "wam", "wipay", "supabase", "railway", "vault", "obsidian",
  "guru automations", "fete", "keylo",
];

function isBusinessQuery(question) {
  const q = question.toLowerCase();
  return BUSINESS_KEYWORDS.some((kw) => q.includes(kw));
}

app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Missing 'question' in request body." });
    }

    let contextNotes = [];
    if (isBusinessQuery(question)) {
      try {
        contextNotes = await findRelevantNotes(question);
      } catch (err) {
        console.error("Dropbox lookup failed, continuing without context:", err.message);
      }
    }

    const answer = await askClaude(question, contextNotes);

    res.json({
      answer,
      usedNotes: contextNotes.map((n) => n.name),
    });
  } catch (err) {
    console.error("Error handling /ask:", err);
    res.status(500).json({ error: "Something went wrong answering that." });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Guru voice assistant server running on port ${PORT}`);
});
