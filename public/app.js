// app.js
// Runs entirely in the tablet's browser. Uses the Web Speech API for both
// listening (SpeechRecognition) and speaking (SpeechSynthesis).

const BACKEND_URL = "https://guru-voice-assistant.onrender.com";
const WAKE_PHRASE = "hey guru";

const stage = document.querySelector(".stage");
const micBtn = document.getElementById("micBtn");
const statusEl = document.getElementById("status");
const heardEl = document.getElementById("heard");
const answerEl = document.getElementById("answer");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let running = false; // whether the mic loop is turned on at all
let busy = false; // true while thinking/speaking - ignore input then

function setState(mode, text) {
  stage.classList.remove("listening", "thinking", "speaking");
  if (mode) stage.classList.add(mode);
  if (text) statusEl.textContent = text;
}

function speak(text) {
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.02;
    utter.onend = resolve;
    utter.onerror = resolve;
    setState("speaking", "speaking...");
    window.speechSynthesis.speak(utter);
  });
}

async function askBackend(question) {
  const res = await fetch(`${BACKEND_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json();
}

async function handleUtterance(rawText) {
  const lower = rawText.toLowerCase().trim();
  if (!lower.startsWith(WAKE_PHRASE)) return; // ignore anything not addressed to us

  const question = rawText.slice(rawText.toLowerCase().indexOf(WAKE_PHRASE) + WAKE_PHRASE.length).trim();
  if (!question) {
    setState("listening", "yes?");
    return;
  }

  busy = true;
  heardEl.textContent = `"${rawText}"`;
  answerEl.textContent = "";
  setState("thinking", "thinking...");

  try {
    const { answer } = await askBackend(question);
    answerEl.textContent = answer;
    await speak(answer);
  } catch (err) {
    console.error(err);
    answerEl.textContent = "Couldn't reach the server.";
    await speak("Sorry, I couldn't reach the server.");
  } finally {
    busy = false;
    if (running) startRecognition();
    setState("listening", 'say "hey guru" to start');
  }
}

function startRecognition() {
  if (!SpeechRecognition) {
    setState(null, "Speech recognition not supported in this browser.");
    return;
  }
  recognition = new SpeechRecognition();
  recognition.continuous = false; // restart manually - more reliable across Android Chrome versions
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    const text = event.results[event.results.length - 1][0].transcript;
    handleUtterance(text);
  };

  recognition.onerror = (event) => {
    console.warn("Recognition error:", event.error);
    // 'no-speech' and 'aborted' are routine - just restart the loop.
    if (running && !busy) restartSoon();
  };

  recognition.onend = () => {
    if (running && !busy) restartSoon();
  };

  try {
    recognition.start();
    setState("listening", 'say "hey guru" to start');
  } catch (e) {
    // start() can throw if called while already running - safe to ignore
  }
}

function restartSoon() {
  setTimeout(() => {
    if (running && !busy) startRecognition();
  }, 250);
}

function toggleListening() {
  running = !running;
  if (running) {
    startRecognition();
  } else {
    if (recognition) recognition.stop();
    setState(null, "tap to start listening");
  }
}

micBtn.addEventListener("click", toggleListening);

// Register the service worker for installability.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

setState(null, "tap to start listening");
