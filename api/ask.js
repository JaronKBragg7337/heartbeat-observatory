// /api/ask.js — the in-world guide (Claude, the ghost who roams the Engine / hub).
// Scripted, no AI API (Jaron 10/25: "take away the fact that it uses API credits"). Each answer below was written by
// Claude; the guide matches the visitor's words to the closest topic. Add topics to ANSWERS to teach it more.
// Response shape is unchanged ({ reply, note }), so engine/hub and worlds-lab/starter need no changes.

const ANSWERS = [
  { keys: ["what is this", "what's this", "where am i", "what is heartbeat", "about", "place"],
    reply: "This is Heartbeat Observatory, a walkable town where real people and AIs build things together, in public. One founder in Fort Wayne and a crew of AIs make the news show, the TV channels, the Studio, the worlds and more. Everything here is free to look around." },
  { keys: ["move", "walk", "joystick", "wasd", "control", "look around", "jump", "duck"],
    reply: "Move with the on-screen joystick or WASD, and look by dragging the screen or moving the mouse. You can jump, duck, throw a snowball, and hold things like coffee or a ball. Press E, or tap Enter, to go into a building." },
  { keys: ["building", "enter", "go in", "inside", "door"],
    reply: "Walk up to a building and press E, or tap Enter. Each building opens a part of the site: the news, the TV, the Studio, the library and more." },
  { keys: ["claim", "plot", "home", "house", "my own", "spot", "land"],
    reply: "You can claim a spot: link a GitHub project to an open plot, or earn a personal home as you get involved. Sign in first, then look for an open plot." },
  { keys: ["news", "today"],
    reply: "Heartbeat News is a daily show, live every morning by 8 AM, with every story sourced. Find it on the News page or walk into the news building." },
  { keys: ["tv", "show", "episode", "channel", "watch", "history", "science"],
    reply: "Heartbeat TV has channels for History, Science, Open Questions, mysteries, music and more. Many episodes start from a viewer's question, so if you wonder something, ask on one of our videos." },
  { keys: ["music", "studio", "beat", "record", "song", "rap"],
    reply: "The Studio lets you make a song on your phone: pick or roll a free beat, record over it, and save it. Your voice never leaves your device." },
  { keys: ["website", "hire", "business", "work with", "build me", "client"],
    reply: "We build simple, fast websites for local businesses, and we make a free preview first. See Work with us on the main site." },
  { keys: ["who are you", "claude", "ghost", "are you ai", "are you real"],
    reply: "I'm Claude, an AI made by Anthropic, and here I'm the guide who roams the hub. My answers are written ahead of time, so ask me about this place and how to get around." },
  { keys: ["free", "cost", "price", "pay", "money"],
    reply: "Looking around is free, and the news, shows, beats and knowledge here never cost anything. If you want to support it, there's a tip button on the TV page." },
  { keys: ["sign in", "login", "account"],
    reply: "Tap Sign in at the top of the main site. You only need an account to claim a spot or post; looking around works without one." },
  { keys: ["hi", "hello", "hey", "yo", "sup"],
    reply: "Hey, welcome to the hub. Ask me what this place is, how to get around, or where to find the news, TV or Studio." }
];

const FALLBACK = "I don't have an answer for that one yet. Ask me what this place is, how to move around, how to claim a spot, or where the news, TV and Studio are.";

function answer(message) {
  const m = " " + message.toLowerCase().replace(/[^a-z0-9' ]+/g, " ") + " ";
  let best = null, bestScore = 0;
  for (const a of ANSWERS) {
    const score = a.keys.reduce((s, k) => s + (m.includes(" " + k + " ") || (k.length > 4 && m.includes(k)) ? k.length : 0), 0);
    if (score > bestScore) { best = a; bestScore = score; }
  }
  return best ? best.reply : FALLBACK;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ reply: "", note: "method_not_allowed" });
    return;
  }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const message = String((body && body.message) || "").trim().slice(0, 500);
  if (!message) {
    res.status(200).json({ reply: "", note: "empty" });
    return;
  }
  res.status(200).json({ reply: answer(message), note: "ok" });
}
