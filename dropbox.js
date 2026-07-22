// dropbox.js
// Talks directly to the Dropbox HTTP API (no SDK needed) to read
// markdown notes out of the Obsidian vault folder.

const DROPBOX_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;
const VAULT_PATH = process.env.DROPBOX_VAULT_PATH || "";

// Simple in-memory cache of the folder listing so we don't hit the
// Dropbox API on every single question. Refreshes every 10 minutes.
let cachedListing = null;
let cachedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

// Common words to ignore when turning a spoken question into search terms.
const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "what", "whats", "where",
  "when", "who", "how", "why", "do", "does", "did", "can", "could", "should",
  "would", "my", "me", "i", "to", "for", "of", "in", "on", "at", "and", "or",
  "with", "about", "tell", "please", "hey", "guru", "give", "show", "have",
  "has", "it", "this", "that", "there", "any", "update", "updates", "status"
]);

async function dbxFetch(url, body, extraHeaders = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DROPBOX_TOKEN}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dropbox API error ${res.status}: ${text}`);
  }
  return res;
}

// Recursively list every .md file in the vault folder (Dropbox paginates
// via has_more/cursor, so we follow that until it's exhausted).
async function listVaultFiles() {
  const now = Date.now();
  if (cachedListing && now - cachedAt < CACHE_TTL_MS) {
    return cachedListing;
  }

  let entries = [];
  let res = await dbxFetch("https://api.dropboxapi.com/2/files/list_folder", {
    path: VAULT_PATH,
    recursive: true,
  });
  let data = await res.json();
  entries = entries.concat(data.entries);

  while (data.has_more) {
    res = await dbxFetch("https://api.dropboxapi.com/2/files/list_folder/continue", {
      cursor: data.cursor,
    });
    data = await res.json();
    entries = entries.concat(data.entries);
  }

  const notes = entries.filter(
    (e) => e[".tag"] === "file" && e.name.toLowerCase().endsWith(".md")
  );

  cachedListing = notes;
  cachedAt = now;
  return notes;
}

// Download the raw text content of one note by its Dropbox path.
async function downloadNote(path) {
  const res = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DROPBOX_TOKEN}`,
      "Dropbox-API-Arg": JSON.stringify({ path }),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dropbox download error ${res.status}: ${text}`);
  }
  return res.text();
}

// Turn a spoken question into a set of meaningful keywords.
function extractKeywords(question) {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

// Find the best-matching note(s) for a question: filename match first,
// falling back to a light content scan if nothing matches by name.
async function findRelevantNotes(question, maxNotes = 2) {
  const keywords = extractKeywords(question);
  if (keywords.length === 0) return [];

  const notes = await listVaultFiles();

  const scored = notes
    .map((note) => {
      const nameLower = note.name.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (nameLower.includes(kw)) score += 3;
      }
      return { note, score };
    })
    .filter((n) => n.score > 0)
    .sort((a, b) => b.score - a.score);

  let candidates = scored.slice(0, maxNotes).map((s) => s.note);

  // Fallback: no filename hits — scan a small slice of notes' content instead.
  if (candidates.length === 0 && notes.length > 0) {
    const sample = notes.slice(0, 25);
    const contentScored = [];
    for (const note of sample) {
      try {
        const text = await downloadNote(note.path_lower);
        const textLower = text.toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          if (textLower.includes(kw)) score += 1;
        }
        if (score > 0) contentScored.push({ note, text, score });
      } catch {
        // skip unreadable file, keep going
      }
    }
    contentScored.sort((a, b) => b.score - a.score);
    return contentScored.slice(0, maxNotes).map((s) => ({
      name: s.note.name,
      content: s.text,
    }));
  }

  const results = [];
  for (const note of candidates) {
    try {
      const content = await downloadNote(note.path_lower);
      results.push({ name: note.name, content });
    } catch {
      // skip unreadable file
    }
  }
  return results;
}

module.exports = { findRelevantNotes, listVaultFiles };
