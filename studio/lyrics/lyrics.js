"use strict";

const $ = (id) => document.getElementById(id);
const STORE_KEY = "heartbeat.lyricPad.v1";
const titleInput = $("songTitle");
const lyricsInput = $("lyrics");
const rhymeInput = $("rhymeWord");
let saveTimer;
let storageWorks = true;
let savedSelection = { start: 0, end: 0 };
let clearTimer;

const RHYME_FAMILIES = [
  ["day", "way", "say", "stay", "play", "away", "okay", "today", "yesterday", "display", "delay", "betray", "holiday", "birthday", "someday"],
  ["time", "rhyme", "climb", "dime", "prime", "crime", "lifetime", "bedtime", "overtime", "sublime"],
  ["line", "mine", "shine", "sign", "fine", "nine", "wine", "design", "divine", "baseline", "outline", "rewind"],
  ["mind", "find", "kind", "grind", "behind", "remind", "blind", "signed", "defined", "combined"],
  ["night", "light", "fight", "right", "sight", "flight", "tonight", "insight", "bright", "tight", "write", "life"],
  ["go", "know", "flow", "show", "glow", "slow", "grow", "though", "below", "hello", "echo", "solo", "window"],
  ["me", "free", "be", "see", "tree", "key", "dream", "believe", "memory", "energy", "family", "destiny"],
  ["love", "above", "dove", "shove", "glove", "enough", "tough", "stuff", "us", "trust", "dust"],
  ["heart", "start", "apart", "art", "dark", "spark", "mark", "apartment", "depart"],
  ["pain", "rain", "train", "brain", "chain", "again", "remain", "insane", "campaign", "lane"],
  ["fire", "higher", "wire", "desire", "inspire", "retire", "entire", "choir", "tired"],
  ["up", "cut", "but", "what", "much", "touch", "such", "enough", "rush", "trust"],
  ["down", "town", "sound", "ground", "around", "found", "now", "how", "loud", "proud"],
  ["home", "alone", "gone", "on", "stone", "phone", "known", "own", "road", "cold"],
  ["world", "girl", "her", "were", "words", "heard", "first", "work", "earth"],
  ["more", "for", "your", "door", "floor", "before", "war", "four", "sure"],
  ["eyes", "lies", "skies", "goodbye", "why", "try", "cry", "fly", "high", "alive"],
  ["man", "hand", "stand", "plan", "land", "understand", "can", "ran", "again"],
  ["back", "that", "at", "track", "rap", "map", "fact", "last", "past", "fast"],
  ["head", "said", "dead", "red", "bed", "instead", "bread", "friend", "end", "again"],
  ["feel", "real", "still", "deal", "heal", "ill", "will", "chill", "skill", "until"],
  ["money", "honey", "funny", "sunny", "running", "coming", "nothing", "something"],
  ["never", "forever", "together", "better", "ever", "whatever", "weather", "pressure"],
  ["blue", "you", "true", "through", "new", "knew", "do", "to", "too", "view"],
  ["all", "fall", "call", "wall", "small", "off", "lost", "talk", "walk", "thought"],
  ["out", "about", "doubt", "now", "down", "mouth", "south", "without"],
  ["away", "afraid", "made", "fade", "same", "name", "game", "change", "face", "place"],
  ["old", "gold", "soul", "control", "hold", "told", "road", "go", "know"],
  ["star", "far", "are", "car", "hard", "apart", "heart", "start"],
  ["wrong", "song", "long", "strong", "on", "gone", "belong", "along"]
];

const WORD_SYLLABLES = {
  a: 1, i: 1, the: 1, every: 2, everything: 3, different: 2, family: 3, heaven: 2,
  seven: 2, eleven: 3, poem: 2, poet: 2, poetry: 3, quiet: 2, science: 2, riot: 2,
  fire: 2, tired: 2, hour: 2, our: 2, flower: 2, power: 2, prayer: 2, people: 2,
  little: 2, middle: 2, rhythm: 2, camera: 3, chocolate: 3, interest: 3, general: 3,
  beautiful: 3, usually: 4, being: 2, going: 2, doing: 2, create: 2, creation: 3
};

const NUMBER_SYLLABLES = [2, 1, 1, 1, 1, 1, 1, 2, 1, 1];

function wordsIn(text) {
  return text.toLowerCase().match(/[a-z0-9]+(?:['’][a-z]+)?/g) || [];
}

function countWordSyllables(token) {
  let word = token.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]/g, "");
  if (!word) return 0;
  if (/^\d+$/.test(word)) return [...word].reduce((sum, digit) => sum + NUMBER_SYLLABLES[Number(digit)], 0);
  if (WORD_SYLLABLES[word] !== undefined) return WORD_SYLLABLES[word];
  if (word.endsWith("'s")) word = word.slice(0, -2);
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|[^laeiouy]e)$/, "").replace(/([^td])ed$/, "$1").replace(/^y/, "");
  const groups = word.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

function countSyllables(text) {
  return wordsIn(text).reduce((sum, word) => sum + countWordSyllables(word), 0);
}

function cleanWord(text) {
  const words = wordsIn(text);
  return words.length ? words[words.length - 1].replace(/[’']/g, "").replace(/[^a-z]/g, "") : "";
}

function lineNumberAtCursor() {
  return lyricsInput.value.slice(0, lyricsInput.selectionStart).split("\n").length - 1;
}

function updateCurrentBar() {
  const lines = lyricsInput.value.split("\n");
  const index = Math.min(lineNumberAtCursor(), lines.length - 1);
  const count = lines[index].trim() ? countSyllables(lines[index]) : 0;
  $("currentBar").textContent = count;
}

function updateBarMap() {
  const lines = lyricsInput.value.split("\n");
  let barNumber = 0;
  let total = 0;
  const fragment = document.createDocumentFragment();
  $("barList").textContent = "";
  lines.forEach((text, index) => {
    if (!text.trim()) {
      if (lines.length > 1) {
        const space = document.createElement("li");
        space.className = "space";
        space.textContent = "space";
        fragment.appendChild(space);
      }
      return;
    }
    barNumber += 1;
    const syllables = countSyllables(text);
    total += syllables;
    const item = document.createElement("li");
    const number = document.createElement("span");
    number.className = "bar-number";
    number.textContent = "Bar " + barNumber;
    const count = document.createElement("span");
    count.className = "syllables";
    count.textContent = syllables + " syl";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bar-text";
    button.textContent = text;
    button.setAttribute("aria-label", "Edit bar " + barNumber + ": " + text);
    button.addEventListener("click", () => {
      const start = lines.slice(0, index).reduce((sum, line) => sum + line.length + 1, 0);
      lyricsInput.focus();
      lyricsInput.setSelectionRange(start, start + text.length);
      rememberSelection();
      updateCurrentBar();
    });
    item.append(number, count, button);
    fragment.appendChild(item);
  });
  if (!barNumber) {
    const empty = document.createElement("li");
    empty.className = "space";
    empty.textContent = "Your bars will show here.";
    fragment.appendChild(empty);
  }
  $("barList").appendChild(fragment);
  $("barCount").textContent = barNumber;
  $("syllableCount").textContent = total;
  updateCurrentBar();
}

function setSaveMessage(text, warning = false) {
  $("saveState").textContent = text;
  $("saveState").classList.toggle("warn", warning);
}

function saveSong() {
  clearTimeout(saveTimer);
  if (!storageWorks) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ title: titleInput.value, lyrics: lyricsInput.value, updatedAt: Date.now() }));
    setSaveMessage("Saved on this phone");
  } catch (error) {
    storageWorks = false;
    setSaveMessage("Not saving in this browser", true);
    $("storageNote").textContent = "This browser will not keep your song. Export a text copy now and before you leave.";
  }
}

function queueSave() {
  setSaveMessage(storageWorks ? "Saving..." : "Not saving in this browser", !storageWorks);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSong, 250);
}

function updateSong() {
  rememberSelection();
  updateBarMap();
  queueSave();
}

function loadSong() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (saved && typeof saved.title === "string" && typeof saved.lyrics === "string") {
      titleInput.value = saved.title;
      lyricsInput.value = saved.lyrics;
      setSaveMessage("Restored from this phone");
    }
  } catch (error) {
    storageWorks = false;
    setSaveMessage("Not saving in this browser", true);
    $("storageNote").textContent = "This browser will not keep your song. Export a text copy now and before you leave.";
  }
  updateBarMap();
  rememberSelection();
}

function rememberSelection() {
  savedSelection = { start: lyricsInput.selectionStart, end: lyricsInput.selectionEnd };
}

function getRhymes(input) {
  const word = cleanWord(input);
  if (!word) return [];
  const matches = new Set();
  const ownWords = wordsIn(lyricsInput.value);
  ownWords.forEach((candidate) => {
    const clean = candidate.replace(/[’']/g, "").replace(/[^a-z]/g, "");
    if (clean !== word && clean.length > 2 && (clean.endsWith(word.slice(-2)) || word.endsWith(clean.slice(-2)))) matches.add(clean);
  });
  RHYME_FAMILIES.forEach((family) => {
    if (family.includes(word)) family.forEach((candidate) => { if (candidate !== word) matches.add(candidate); });
  });
  let bestEnding = "";
  RHYME_FAMILIES.forEach((family) => {
    family.forEach((candidate) => {
      const max = Math.min(5, word.length - 1, candidate.length - 1);
      for (let length = max; length >= 3; length -= 1) {
        const ending = word.slice(-length);
        if (candidate.endsWith(ending) && ending.length > bestEnding.length) {
          bestEnding = ending;
          matches.add(candidate);
          break;
        }
      }
    });
  });
  return [...matches].filter((candidate) => candidate !== word).sort((a, b) => {
    const aFamily = RHYME_FAMILIES.some((family) => family.includes(word) && family.includes(a));
    const bFamily = RHYME_FAMILIES.some((family) => family.includes(word) && family.includes(b));
    return Number(bFamily) - Number(aFamily) || a.localeCompare(b);
  }).slice(0, 24);
}

function findRhymes() {
  const word = cleanWord(rhymeInput.value);
  const container = $("rhymes");
  container.textContent = "";
  if (!word) {
    container.innerHTML = '<span class="muted">Type a word first.</span>';
    rhymeInput.focus();
    return;
  }
  rhymeInput.value = word;
  const rhymes = getRhymes(word);
  if (!rhymes.length) {
    const empty = document.createElement("span");
    empty.className = "muted";
    empty.textContent = "No close rhymes in this small word book. Try a simpler word.";
    container.appendChild(empty);
    return;
  }
  rhymes.forEach((wordChoice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = wordChoice;
    button.setAttribute("aria-label", "Add " + wordChoice + " to lyrics");
    button.addEventListener("click", () => insertWord(wordChoice));
    container.appendChild(button);
  });
}

function insertWord(word) {
  const start = Math.min(savedSelection.start, lyricsInput.value.length);
  const end = Math.min(savedSelection.end, lyricsInput.value.length);
  const before = lyricsInput.value.slice(0, start);
  const after = lyricsInput.value.slice(end);
  const leading = before && !/\s$/.test(before) ? " " : "";
  const trailing = after && !/^\s/.test(after) ? " " : "";
  const insertion = leading + word + trailing;
  lyricsInput.value = before + insertion + after;
  const cursor = start + insertion.length;
  lyricsInput.focus();
  lyricsInput.setSelectionRange(cursor, cursor);
  rememberSelection();
  updateSong();
}

function exportText() {
  saveSong();
  const title = titleInput.value.trim();
  const text = (title ? title + "\n\n" : "") + lyricsInput.value.replace(/\s+$/, "") + "\n";
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = (title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "heartbeat-lyrics") + ".txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  setSaveMessage("Text file ready. Check Downloads");
}

titleInput.addEventListener("input", queueSave);
lyricsInput.addEventListener("input", updateSong);
lyricsInput.addEventListener("click", () => { rememberSelection(); updateCurrentBar(); });
lyricsInput.addEventListener("keyup", () => { rememberSelection(); updateCurrentBar(); });
lyricsInput.addEventListener("select", rememberSelection);
rhymeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); findRhymes(); }
});
$("rhymeBtn").addEventListener("click", findRhymes);
$("lastWordBtn").addEventListener("click", () => {
  const word = cleanWord(lyricsInput.value.slice(0, lyricsInput.selectionStart));
  rhymeInput.value = word;
  findRhymes();
});
$("exportBtn").addEventListener("click", exportText);
$("newBtn").addEventListener("click", () => {
  if (!$("newBtn").dataset.armed) {
    $("newBtn").dataset.armed = "true";
    $("newBtn").textContent = "Tap again to clear this song";
    clearTimeout(clearTimer);
    clearTimer = setTimeout(() => { delete $("newBtn").dataset.armed; $("newBtn").textContent = "Start a new song"; }, 4000);
    return;
  }
  clearTimeout(clearTimer);
  clearTimeout(saveTimer);
  titleInput.value = "";
  lyricsInput.value = "";
  rhymeInput.value = "";
  $("rhymes").innerHTML = '<span class="muted">Suggestions will show here. Tap one to add it to your lyrics.</span>';
  delete $("newBtn").dataset.armed;
  $("newBtn").textContent = "Start a new song";
  if (storageWorks) {
    try { localStorage.removeItem(STORE_KEY); } catch (error) { storageWorks = false; }
  }
  updateBarMap();
  saveSong();
  rememberSelection();
  titleInput.focus();
});
window.addEventListener("pagehide", saveSong);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveSong(); });

loadSong();
