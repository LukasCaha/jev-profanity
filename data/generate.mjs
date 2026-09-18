#!/usr/bin/env node
/**
 * v3 template-engine synthetic data + sampled real clean reviews.
 * Seeded 20260919v3. Test families never appear in train/dev.
 * Czech-first (≥75–85% CS-dominant). V2b policy kept (rude = positive).
 * V3 adds: algospeak, short codes, subculture slurs, semantic weaponization,
 * coded hate (+ clean numeric traps). Carry-forward V2 evasions mostly CS.
 *
 * Evasion families grounded in:
 *  - ACM “On Obstructing Obscenity Obfuscation”
 *  - O-Norm (qubies/o_norm)
 *  - word-camouflage / pyleetspeak
 *  - Cleanspeak leet docs
 *  - EMNLP OTH homoglyphs
 *  - Bad Characters / ZWSP attacks
 *
 * Partial self-censor policy: gold masks with intended-word alphabetic
 * letter count (e.g. f*ck → ****), not surface letter count excluding *.
 *
 * V2b policy: rude/insulting/demeaning language unsuitable for a company
 * public website is POSITIVE. Families rude_not_profane_* / rude_insult_*
 * keep names for id continuity but gold has_profanity=true; censor rule =
 * mask each content word of the insult (* × letters).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applySpanMask, letterCount } from "../lib/text.mjs";
import {
  V3_TRAIN_DEV_FNS,
  V3_TEST_FNS,
} from "./v3_families.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "synth.jsonl");
const REVIEWS = "/workspace/jev-lab-reviews/reviews-text.jsonl";
/** Seed string "20260919v3" → stable int */
const SEED = 202609193;

function mulberry32(a) {
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function slotsToExample(id, family, split, slots, extra = {}) {
  let text = "";
  const spans = [];
  for (const sl of slots) {
    const start = text.length;
    text += sl.s;
    if (sl.p) {
      const letters =
        typeof sl.letters === "number" ? sl.letters : letterCount(sl.s);
      spans.push({
        start,
        end: text.length,
        word: sl.s,
        letters,
      });
    }
  }
  const censored_gold = applySpanMask(
    text,
    spans.map((sp) => ({ start: sp.start, end: sp.end, letters: sp.letters })),
  );
  return {
    id,
    family,
    split,
    text,
    has_profanity: spans.length > 0,
    censored_gold,
    spans,
    ...extra,
  };
}

// --- banks ---
const EN_STRONG = [
  "fuck", "fucking", "shit", "bullshit", "asshole", "bitch", "dick",
  "bastard", "crap", "piss", "prick", "wanker",
];
const EN_STRONG_TEST = [
  "motherfucker", "bollocks", "cunt", "dickhead", "shithead", "whore", "slut",
  "fuckwit", "arsehole", "tosser",
];
const EN_MILD = ["damn", "hell", "crap", "bloody"];
const CS_STRONG = [
  "kurva", "kokot", "píča", "prdel", "hovno", "zmrd", "debil", "čurák", "hajzl",
];
const CS_STRONG_TEST = [
  "pičovina", "kokotina", "zkurvený", "zasraný", "kretén", "sračka", "kunda", "mrdka",
];
const CS_MILD = ["sakra", "kruci", "prdel"];
const EN_NOUN = [
  "service", "order", "driver", "app", "refund", "package", "manager",
  "queue", "ticket", "delivery", "cleaner", "support",
];
const CS_NOUN = [
  "úklid", "objednávka", "řidič", "balík", "aplikace", "refundace",
  "fronta", "servis", "účet", "podpora", "uklízečka",
];
const EN_ADJ = ["terrible", "awful", "late", "broken", "useless", "slow", "rude"];
const CS_ADJ = ["strašný", "hrozný", "pozdní", "k ničemu", "pomalý", "neochotný"];
const EN_NAME = ["Sam", "Alex", "Jordan", "Chris", "Taylor", "Morgan"];
const CS_NAME = ["Petr", "Jana", "Martin", "Eva", "Tomáš", "Lucie"];
const EN_PRAISE = [
  "excellent", "wonderful", "helpful", "friendly", "on time", "spotless", "professional",
];
const CS_PRAISE = [
  "skvělý", "úžasný", "ochotný", "příjemný", "včas", "perfektní", "profesionální",
];

const LEET_MAP = {
  a: ["@", "4"],
  e: ["3"],
  i: ["1", "!"],
  o: ["0"],
  s: ["$", "5"],
  b: ["8"],
  t: ["7"],
};

function leetify(word, rng, mode = "mixed") {
  // mode: vowels | full | mixed
  const chars = [...word];
  return chars
    .map((ch) => {
      const low = ch.toLowerCase();
      const opts = LEET_MAP[low];
      if (!opts) return ch;
      if (mode === "vowels" && !"aeiou".includes(low)) return ch;
      const p = mode === "full" ? 0.85 : 0.55;
      if (rng() < p) return pick(rng, opts);
      return ch;
    })
    .join("");
}

function spaceify(word) {
  return word.split("").join(" ");
}

function sepify(word, sep) {
  return word.split("").join(sep);
}

function softHyphenify(word) {
  return word.split("").join("\u00AD");
}

function zwspify(word) {
  return word.split("").join("\u200B");
}

function repeatPad(word, rng) {
  const i = Math.floor(rng() * word.length);
  const n = 2 + Math.floor(rng() * 4);
  return word.slice(0, i) + word[i].repeat(n) + word.slice(i + 1);
}

function partialCensor(word, rng) {
  // f*ck, sh*t, f**k, kur*a — keep enough letters; insert * replacing 1–2 letters
  if (word.length < 3) return word[0] + "*" + (word.slice(2) || "");
  const variants = [
    () => word[0] + "*" + word.slice(2),
    () => word[0] + "**" + word.slice(3),
    () => word.slice(0, 2) + "*" + word.slice(3),
    () => word[0] + "*" + word.slice(2, -1) + (word.length > 3 ? word.slice(-1) : ""),
  ];
  return pick(rng, variants)();
}

function homoglyphify(word, rng) {
  // Mix Cyrillic lookalikes into Latin swear (EMNLP OTH / Bad Characters)
  const map = { a: "а", e: "е", o: "о", p: "р", c: "с", x: "х", y: "у", k: "к", A: "А", E: "Е", O: "О" };
  return [...word]
    .map((ch) => {
      if (map[ch] && rng() < 0.55) return map[ch];
      return ch;
    })
    .join("");
}

function gluePunct(word, rng) {
  return pick(rng, [
    `${word}!`, `${word}!!`, `(${word})`, `${word}?`, `"${word}"`, `${word},`,
  ]);
}

function keyboardTypo(word, rng) {
  // mild adjacency: swap or replace with nearby key
  const near = {
    a: "sq", s: "ad", d: "sf", f: "gd", g: "fh", h: "gj",
    j: "hk", k: "jl", l: "k", u: "yi", i: "uo", o: "ip",
    e: "wr", r: "et", t: "ry", c: "vx", v: "cb", b: "vn",
    n: "bm", m: "n", q: "wa", w: "qe", y: "tu", p: "o",
  };
  if (word.length < 3) return word;
  const i = 1 + Math.floor(rng() * (word.length - 2));
  const ch = word[i].toLowerCase();
  const opts = near[ch];
  if (!opts) return word;
  const rep = opts[Math.floor(rng() * opts.length)];
  return word.slice(0, i) + rep + word.slice(i + 1);
}

function phoneticEn(word, rng) {
  // foreign/phonetic spelling variants of EN swears
  const table = {
    fuck: ["phuck", "fuk", "fack", "fak", "fucc"],
    shit: ["shyt", "sheeeit", "shiit"],
    bitch: ["biatch", "byotch", "bich"],
    asshole: ["ashole", "arsehole"],
    damn: ["dayum", "dam"],
    cock: ["cok", "coq"],
  };
  const opts = table[word];
  if (opts) return pick(rng, opts);
  // generic: double vowel / ph
  if (word.startsWith("f")) return "ph" + word.slice(1);
  return word[0] + word[0] + word.slice(1);
}

// ---------- TRAIN/DEV families ----------
function gen_clean_praise_cs(rng) {
  const adj = pick(rng, CS_PRAISE);
  const noun = pick(rng, CS_NOUN);
  const name = pick(rng, CS_NAME);
  return pick(rng, [
    [{ s: `Moc děkuji, ${noun} byl ${adj}.` }],
    [{ s: `${name} byla ${adj} a vše proběhlo v klidu.` }],
    [{ s: `Úklid byl ${adj}, ráda objednám znovu.` }],
    [{ s: `Dobrý den, vše v pořádku, ${noun} super.` }],
    [{ s: `Velká spokojenost s ${noun}, fakt ${adj}.` }],
    [{ s: `Pěkně uklizeno, ${name} je ${adj}.` }],
    [{ s: `Doporučuji ${name}, ${noun} zvládl výborně.` }],
    [{ s: `Bez připomínek, ${adj} práce.` }],
  ]);
}

function gen_clean_praise_en(rng) {
  const adj = pick(rng, EN_PRAISE);
  const noun = pick(rng, EN_NOUN);
  const name = pick(rng, EN_NAME);
  return pick(rng, [
    [{ s: `Thanks, the ${noun} was ${adj}.` }],
    [{ s: `${name} was ${adj} and on time.` }],
    [{ s: `Really ${adj} service, I will book again.` }],
    [{ s: `Hello, everything looked ${adj} today.` }],
    [{ s: `The ${noun} arrived ${adj}; much appreciated.` }],
    [{ s: `Please thank ${name} for the ${adj} work.` }],
    [{ s: `No issues — ${adj} ${noun} throughout.` }],
    [{ s: `Booking went smoothly; ${name} was ${adj}.` }],
  ]);
}

function gen_strong_cs(rng) {
  const w = pick(rng, CS_STRONG);
  const noun = pick(rng, CS_NOUN);
  const adj = pick(rng, CS_ADJ);
  const name = pick(rng, CS_NAME);
  return pick(rng, [
    [{ s: "To je " }, { s: w, p: true }, { s: ` ${adj} ${noun}!` }],
    [{ s: "Ty jsi " }, { s: w, p: true }, { s: `, ${name}.` }],
    [{ s: w, p: true }, { s: `, ten ${noun} je k ničemu.` }],
    [{ s: `Ten ${noun} je jedno velké ` }, { s: w, p: true }, { s: "." }],
    [{ s: "Seru na to, " }, { s: w, p: true }, { s: ` s tím ${noun}.` }],
    [{ s: w, p: true }, { s: " vole, to snad není možný." }],
    [{ s: `Za ten ${noun} — ` }, { s: w, p: true }, { s: "!" }],
  ]);
}

function gen_strong_en(rng) {
  const w = pick(rng, EN_STRONG);
  const noun = pick(rng, EN_NOUN);
  const adj = pick(rng, EN_ADJ);
  const name = pick(rng, EN_NAME);
  return pick(rng, [
    [{ s: "This " }, { s: noun }, { s: " is " }, { s: w, p: true }, { s: "." }],
    [{ s: "What the " }, { s: w, p: true }, { s: ` was that ${noun}?` }],
    [{ s: w, p: true }, { s: ` you, ${name}.` }],
    [{ s: "I am so " }, { s: w, p: true }, { s: ` at this ${adj} ${noun}.` }],
    [{ s: "Total " }, { s: w, p: true }, { s: `, never again.` }],
    [{ s: `The ${noun} is ` }, { s: w, p: true }, { s: ` ${adj}.` }],
    [{ s: "Such a " }, { s: w, p: true }, { s: ` ${noun}.` }],
  ]);
}

function gen_mild_interjection_cs(rng) {
  const w = pick(rng, CS_MILD);
  const noun = pick(rng, CS_NOUN);
  return pick(rng, [
    [{ s: w, p: true }, { s: `, to je ale ${noun}.` }],
    [{ s: "No " }, { s: w, p: true }, { s: ", zase pozdě." }],
    [{ s: "Do " }, { s: w === "prdel" ? "prdele" : w, p: true }, { s: " s tím." }],
    [{ s: w, p: true }, { s: " už, nech toho." }],
    [{ s: "Ale " }, { s: w, p: true }, { s: `, ${noun} nedorazil.` }],
  ]);
}

function gen_obfuscation_leet(rng) {
  const base = pick(rng, [...EN_STRONG, ...CS_STRONG]);
  const mode = pick(rng, ["vowels", "mixed", "full"]);
  const w = leetify(base, rng, mode);
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  return pick(rng, [
    [{ s: "This " }, { s: noun }, { s: " is " }, { s: w, p: true, letters: letterCount(base) }, { s: "." }],
    [{ s: "To je " }, { s: w, p: true, letters: letterCount(base) }, { s: ` ${noun}.` }],
    [{ s: w, p: true, letters: letterCount(base) }, { s: " this is unacceptable." }],
    [{ s: "Fakt " }, { s: w, p: true, letters: letterCount(base) }, { s: ", už dost." }],
  ]);
}

function rudeSlotsFromPhrase(phrase, restPrefix = "", restSuffix = "") {
  // Per-word censor rule: each content word of the insult is a positive span.
  const slots = [];
  if (restPrefix) slots.push({ s: restPrefix });
  const parts = phrase.split(/(\s+)/);
  for (const part of parts) {
    if (!part) continue;
    if (/^\s+$/.test(part)) slots.push({ s: part });
    else slots.push({ s: part, p: true });
  }
  if (restSuffix) slots.push({ s: restSuffix });
  return slots;
}

function gen_rude_insult_cs(rng) {
  // TRAIN/DEV: under v2b these are POSITIVE (public-unsafe rude insults).
  // Disjoint templates from test rude_not_profane_* / rude_public_unsafe_*.
  const noun = pick(rng, CS_NOUN);
  const name = pick(rng, CS_NAME);
  const who = pick(rng, ["hlupák", "líňoch", "trapný typ", "neochotný člověk", "pomalej kluk"]);
  const dig = pick(rng, ["stará paní", "starý pán", "ta ženská", "ten chlap"]);
  return pick(rng, [
    rudeSlotsFromPhrase(`Ta ${dig}`, "", ` u ${noun} byla neochotná, nic víc.`),
    rudeSlotsFromPhrase(`Ten ${who}`, "", ` z podpory nic nechápe ohledně ${noun}.`),
    rudeSlotsFromPhrase("Blbá holka", "", ` z recepce (${name}), ale bez vulgarit.`),
    rudeSlotsFromPhrase("K ničemu", "", ` ten ${noun}, fakt nespokojenost.`),
    rudeSlotsFromPhrase("Starý dědek", "", ` zpozdil ${noun} o hodinu.`),
    [{ s: "Useless", p: true }, { s: ` přístup k ${noun}, žádné sprosté slovo.` }],
    [
      ...rudeSlotsFromPhrase("Ta ženská", "", ` u ${noun} je `),
      { s: "nepříjemná", p: true },
      { s: " a pomalá." },
    ],
    [{ s: "Trapný", p: true }, { s: ` výkon u ${noun}, doporučuji změnu.` }],
    rudeSlotsFromPhrase("Líný brigádník", "", ` ${name}, nic neudělal pořádně.`),
    [{ s: "Pitomý", p: true }, { s: ` systém ${noun}, pořád padá.` }],
    [
      { s: `${name} je ` },
      { s: "hlupák", p: true },
      { s: ", ale text bez vulgarismů." },
    ],
    rudeSlotsFromPhrase(`Nepříjemný ${dig}`, "", `, ${noun} zklamal.`),
  ]);
}

function gen_rude_insult_en(rng) {
  // TRAIN/DEV positives under v2b (public-unsafe rude insults).
  const noun = pick(rng, EN_NOUN);
  const name = pick(rng, EN_NAME);
  const dig = pick(rng, ["old lady", "silly manager", "useless cleaner", "clown of a driver", "incompetent clerk"]);
  return pick(rng, [
    rudeSlotsFromPhrase(`That ${dig}`, "", ` left the ${noun} a mess.`),
    [
      { s: "What a " },
      { s: "silly", p: true },
      { s: ` ${noun} policy — no swear words needed.` },
    ],
    rudeSlotsFromPhrase("The old lady", "", ` at the desk was rude about ${noun}.`),
    [{ s: "Dumb", p: true }, { s: ` decision by support on ${noun}, still no refund.` }],
    [
      { s: "Pathetic", p: true },
      { s: ` ${noun}, late and messy.` },
    ],
    rudeSlotsFromPhrase("That clown of a driver", "", ` missed the ${noun}.`),
    rudeSlotsFromPhrase("Incompetent staff", "", ` on ${noun}, ageist digs aside.`),
    [
      { s: "Worthless", p: true },
      { s: ` ${noun} update, nothing works.` },
    ],
    rudeSlotsFromPhrase("Nasty attitude", "", ` from ${name} about the ${noun}.`),
    [
      { s: "Foolish", p: true },
      { s: ` ${noun} policy, customers lose again.` },
    ],
    [
      { s: `${name} was a ` },
      { s: "fool", p: true },
      { s: ` about the ${noun}, still no taboo words.` },
    ],
    rudeSlotsFromPhrase("Lazy intern", "", ` ruined the ${noun} — sarcastic dig only.`),
  ]);
}

function gen_repeat_pad_train(rng) {
  const base = pick(rng, [...EN_STRONG, ...CS_STRONG]);
  const w = repeatPad(base, rng);
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  return pick(rng, [
    [{ s: `Wow ${w}`, p: true, letters: letterCount(w) }, { s: ` this ${noun}.` }],
    [{ s: "To je " }, { s: w, p: true, letters: letterCount(w) }, { s: "." }],
  ]);
}

function gen_partial_censor_train(rng) {
  const base = pick(rng, ["fuck", "shit", "bitch", "kurva", "kokot", "damn"]);
  const w = partialCensor(base, rng);
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  // Policy: intended-word alphabetic letter count
  return pick(rng, [
    [{ s: "This is " }, { s: w, p: true, letters: letterCount(base) }, { s: ` ${noun}.` }],
    [{ s: w, p: true, letters: letterCount(base) }, { s: ", never again." }],
  ]);
}

function gen_sep_space_train(rng) {
  const base = pick(rng, ["fuck", "shit", "kurva", "kokot", "prdel", "bitch", "hovno", "zmrd"]);
  const w = spaceify(base);
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  const name = pick(rng, [...EN_NAME, ...CS_NAME]);
  return pick(rng, [
    [{ s: "Honestly " }, { s: w, p: true, letters: letterCount(base) }, { s: ` no ${noun}.` }],
    [{ s: "To je " }, { s: w, p: true, letters: letterCount(base) }, { s: ` ${noun}.` }],
    [{ s: w, p: true, letters: letterCount(base) }, { s: ` — ${name} said.` }],
    [{ s: `Why ${noun} ` }, { s: w, p: true, letters: letterCount(base) }, { s: "?" }],
  ]);
}

// ---------- TEST-ONLY families ----------
function gen_obfuscation_spaced(rng) {
  const base = pick(rng, [...EN_STRONG, ...CS_STRONG, "fuck", "kurva", "shit"]);
  const w = spaceify(base);
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  return pick(rng, [
    [{ s: "Honestly " }, { s: w, p: true, letters: letterCount(base) }, { s: ` this ${noun}.` }],
    [{ s: "To je " }, { s: w, p: true, letters: letterCount(base) }, { s: "." }],
    [{ s: "Why the " }, { s: w, p: true, letters: letterCount(base) }, { s: ` would they do that?` }],
    [{ s: w, p: true, letters: letterCount(base) }, { s: ` a celý ${noun} k ničemu.` }],
  ]);
}

function gen_punct_glued(rng) {
  const base = pick(rng, [...EN_STRONG, ...CS_STRONG]);
  const g = gluePunct(base, rng);
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  return pick(rng, [
    [{ s: `hello ${noun}, ` }, { s: g, p: true, letters: letterCount(base) }, { s: " later." }],
    [{ s: "Note:" }, { s: g, p: true, letters: letterCount(base) }, { s: ` the ${noun} failed.` }],
    [{ s: "Ahoj, " }, { s: g, p: true, letters: letterCount(base) }, { s: " to je vše." }],
  ]);
}

function gen_code_switch(rng) {
  const cs = pick(rng, [...CS_STRONG, ...CS_STRONG_TEST]);
  const en = pick(rng, [...EN_STRONG, ...EN_STRONG_TEST]);
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  return pick(rng, [
    [{ s: "Ta " }, { s: cs, p: true }, { s: " service was " }, { s: en, p: true }, { s: " awful." }],
    [{ s: "This " }, { s: en, p: true }, { s: " úklid was " }, { s: cs, p: true }, { s: "." }],
    [{ s: "Fakt " }, { s: cs, p: true }, { s: ", the " }, { s: noun }, { s: " is " }, { s: en, p: true }, { s: "." }],
    [{ s: en, p: true }, { s: " off, ty " }, { s: cs, p: true }, { s: " jeden." }],
    [
      { s: "Never again — " }, { s: cs, p: true }, { s: " " }, { s: noun },
      { s: " and " }, { s: en, p: true }, { s: " staff, total " }, { s: pick(rng, EN_STRONG), p: true }, { s: "." },
    ],
  ]);
}

function gen_near_miss_clean(rng) {
  return pick(rng, [
    [{ s: "Hello there, classic assistant class is over." }],
    [{ s: "Pass the glass, the cocktail was excellent." }],
    [{ s: "A Virgin Mary mocktail and a classic soda." }],
    [{ s: "The cockpit of the plane was spotless." }],
    [{ s: "Shiitake mushrooms in the classic pasta." }],
    [{ s: "Kurýr doručil zásilku na adresu včas." }],
    [{ s: "Kundera napsal knihu o Praze." }],
    [{ s: "Písek na podlaze, jinak čisto." }],
    [{ s: "He is an assistant in classic ballet." }],
    [{ s: "The mass was held after class in the hall." }],
    [{ s: "Scunthorpe shipping passed the assessment." }],
    [{ s: "Hello world, helloworld demo, classic pass." }],
    [{ s: "The bass guitar class was phenomenal." }],
    [{ s: "Kůra stromu, písek v botě, nic víc." }],
    [{ s: "Please assess the passage in the classic text." }],
    [{ s: "Cocktail bar, hello bartender, glass of water." }],
    [{ s: "Milan Kundera and the courier (kurýr) arrived." }],
    [{ s: "That was a steep climb — still a beautiful view." }],
    [{ s: "Assumption of risk; assets assessed carefully." }],
    [{ s: "Shellfish platter, classic recipe, no issues." }],
  ]);
}

function gen_mild_interjection_en(rng) {
  const w = pick(rng, EN_MILD);
  const noun = pick(rng, EN_NOUN);
  return pick(rng, [
    [{ s: w, p: true }, { s: `, the ${noun} is late again.` }],
    [{ s: "What the " }, { s: w, p: true }, { s: "?" }],
    [{ s: "Oh " }, { s: w, p: true }, { s: `, I dropped the ${noun}.` }],
    [{ s: w, p: true }, { s: " it, we'll try tomorrow." }],
    [{ s: "A " }, { s: w, p: true }, { s: ` good ${noun}, honestly.` }],
  ]);
}

function gen_strong_cs_compound(rng) {
  const a = pick(rng, [...CS_STRONG, ...CS_STRONG_TEST]);
  let b = pick(rng, [...CS_STRONG, ...CS_STRONG_TEST]);
  if (b === a) b = a === "kurva" ? "kokot" : "kurva";
  const noun = pick(rng, CS_NOUN);
  const name = pick(rng, CS_NAME);
  return pick(rng, [
    [{ s: "Ty " }, { s: a, p: true }, { s: " " }, { s: b, p: true }, { s: " jeden." }],
    [{ s: "To je " }, { s: a, p: true }, { s: " " }, { s: b, p: true }, { s: ` ten ${noun}.` }],
    [{ s: a, p: true }, { s: " " }, { s: b, p: true }, { s: `, ${name} nic neudělal.` }],
    [{ s: "Zas " }, { s: a, p: true }, { s: " a " }, { s: b, p: true }, { s: ` kvůli ${noun}.` }],
    [{ s: "Do prdele, " }, { s: a, p: true }, { s: ", a ještě " }, { s: b, p: true }, { s: "." }],
  ]);
}

function gen_clean_thanks_cs(rng) {
  const adj = pick(rng, CS_PRAISE);
  const noun = pick(rng, CS_NOUN);
  const name = pick(rng, CS_NAME);
  return pick(rng, [
    [{ s: `Děkujeme za ${noun}, vše ${adj}.` }],
    [{ s: `Paní ${name} byla ${adj}, doporučuji.` }],
    [{ s: `Nemám výhrady, ${noun} zvládl ${name}.` }],
    [{ s: `Krásně uklizeno, ${adj} komunikace.` }],
    [{ s: `Objednávka v pořádku, ${noun} dorazil.` }],
    [{ s: `Jen chci pochválit ${name} za ${adj} přístup.` }],
  ]);
}

function gen_clean_thanks_en(rng) {
  const adj = pick(rng, EN_PRAISE);
  const noun = pick(rng, EN_NOUN);
  const name = pick(rng, EN_NAME);
  return pick(rng, [
    [{ s: `We appreciate the ${adj} ${noun}.` }],
    [{ s: `${name} handled everything with care.` }],
    [{ s: `No complaints, the ${noun} was ${adj}.` }],
    [{ s: `Kindly thank ${name}; very ${adj}.` }],
    [{ s: `Booking confirmed, ${noun} looks ${adj}.` }],
    [{ s: `All good here — ${adj} and calm.` }],
  ]);
}

function gen_rude_not_profane_cs(rng) {
  // TEST held-out: family name kept for id continuity; under v2b these are POSITIVE
  // (rude_public_unsafe — demeaning digs unsuitable for a company website).
  const noun = pick(rng, CS_NOUN);
  const name = pick(rng, CS_NAME);
  const who = pick(rng, ["stará bába", "stará kráva", "blbá holka", "hlupák", "líná uklízečka", "starý dědek", "frajer"]);
  return pick(rng, [
    rudeSlotsFromPhrase(`Ta ${who}`, "", ` nic neuklidila u ${noun}.`),
    rudeSlotsFromPhrase("Stará kráva", "", ` z recepce mě odbyla ohledně ${noun}.`),
    rudeSlotsFromPhrase("Blbá holka", "", `, vůbec neposlouchá — ${noun}.`),
    [
      ...rudeSlotsFromPhrase("Ten hlupák", "", " z podpory je "),
      ...rudeSlotsFromPhrase("k ničemu", "", ` (${noun}).`),
    ],
    rudeSlotsFromPhrase("Líná uklízečka", "", `, prach u ${noun} všude.`),
    rudeSlotsFromPhrase("Starý dědek", "", ` zase přišel pozdě na ${noun}.`),
    [{ s: "Pitomá", p: true }, { s: ` aplikace ${noun}, pořád padá.` }],
    [{ s: "Trapný", p: true }, { s: ` výkon u ${noun}, žádné sprosté slovo.` }],
    [
      ...rudeSlotsFromPhrase("Ta ženská", "", ` (${name}) je `),
      { s: "nepříjemná", p: true },
      { s: " a " },
      { s: "arogantní", p: true },
      { s: "." },
    ],
    rudeSlotsFromPhrase("K ničemu", "", ` ten ${noun}, nespokojenost.`),
    rudeSlotsFromPhrase("Useless cleaner", "", ` u ${noun}, dust on every shelf.`),
    [{ s: "Hloupý", p: true }, { s: ` systém ${noun} bez vulgarit.` }],
    rudeSlotsFromPhrase("Stará paní", "", ` ${name} byla neochotná, tečka.`),
    [{ s: "Blbý", p: true }, { s: ` přístup manažera k ${noun}, nic víc.` }],
    [
      { s: "Ten " },
      { s: "frajer", p: true },
      { s: ` z doručení ${noun} je ` },
      { s: "líný", p: true },
      { s: "." },
    ],
    rudeSlotsFromPhrase(who, "", ` zkazila ${noun} — bez vulgarismů.`),
    rudeSlotsFromPhrase("Nepříjemný člověk", "", ` u ${noun}, jen sarkasmus.`),
  ]);
}

function gen_rude_not_profane_en(rng) {
  // TEST held-out: family name kept; v2b POSITIVE (public-unsafe rude).
  const noun = pick(rng, EN_NOUN);
  const name = pick(rng, EN_NAME);
  const dig = pick(rng, ["old hag", "useless cleaner", "silly girl", "pathetic manager", "clown driver", "lazy intern"]);
  return pick(rng, [
    rudeSlotsFromPhrase(`That ${dig}`, "", ` at the desk ignored my ${noun}.`),
    rudeSlotsFromPhrase("Useless cleaner", "", ` left the ${noun} sticky.`),
    [
      { s: "What a " },
      { s: "dumb", p: true },
      { s: ` ${noun} policy — still no swear words.` },
    ],
    rudeSlotsFromPhrase("Silly girl", "", ` at reception mixed the ${noun}.`),
    rudeSlotsFromPhrase("Pathetic manager", "", ` on ${noun}, ageist digs included.`),
    [{ s: "Worthless", p: true }, { s: ` support about ${noun}, never calls back.` }],
    rudeSlotsFromPhrase("That clown driver", "", ` missed three turns to the ${noun}.`),
    [{ s: "Nasty", p: true }, { s: ` attitude on ${noun}, but no taboo words here.` }],
    [{ s: "Foolish", p: true }, { s: ` update broke the ${noun} flow.` }],
    rudeSlotsFromPhrase("Incompetent staff", "", ` ruined the ${noun}.`),
    rudeSlotsFromPhrase("The old lady", "", ` was slow and rude about ${noun}.`),
    [{ s: "Moronic", p: true }, { s: ` ${noun} system, customers wait.` }],
    rudeSlotsFromPhrase("Lazy intern", "", ` forgot the ${noun} entirely.`),
    rudeSlotsFromPhrase("Annoying supervisor", "", ` ${name} with sarcastic digs.`),
    rudeSlotsFromPhrase("Terrible cleaner", "", ` — dust on ${noun}, no profanity.`),
    [
      { s: `${name} was a ` },
      { s: "fool", p: true },
      { s: ` about ${noun}; still clean language.` },
    ],
    rudeSlotsFromPhrase(`That ${dig}`, "", ` spoiled the ${noun} — rude not profane.`),
  ]);
}

function gen_obfuscation_mixed(rng) {
  // separators + leet combined (O-Norm / camouflage)
  const base = pick(rng, ["fuck", "shit", "kurva", "kokot", "bitch", "asshole"]);
  let w = leetify(base, rng, pick(rng, ["vowels", "mixed"]));
  const sep = pick(rng, [".", "_", "-", " "]);
  if (sep === " ") w = spaceify(w);
  else w = sepify(w.replace(/[^a-z0-9@$!]/gi, (c) => c), sep);
  // if leet already has symbols, sepify on original then light leet
  if (rng() < 0.4) {
    w = sepify(base, pick(rng, [".", "_"]));
    w = leetify(w, rng, "vowels");
  }
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  return pick(rng, [
    [{ s: "This " }, { s: noun }, { s: " is " }, { s: w, p: true, letters: letterCount(base) }, { s: "." }],
    [{ s: "To je " }, { s: w, p: true, letters: letterCount(base) }, { s: "." }],
    [{ s: w, p: true, letters: letterCount(base) }, { s: " — unacceptable." }],
  ]);
}

function gen_sep_dot_uscore(rng) {
  const base = pick(rng, ["fuck", "shit", "kurva", "kokot", "prdel", "dick", "cunt"]);
  const sep = pick(rng, [".", "_", "-", "\u00AD"]);
  const w = sep === "\u00AD" ? softHyphenify(base) : sepify(base, sep);
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  return pick(rng, [
    [{ s: "Why " }, { s: w, p: true, letters: letterCount(base) }, { s: ` this ${noun}?` }],
    [{ s: "To je " }, { s: w, p: true, letters: letterCount(base) }, { s: "." }],
    [{ s: w, p: true, letters: letterCount(base) }, { s: " off." }],
  ]);
}

function gen_partial_self_censor(rng) {
  const base = pick(rng, [
    "fuck", "shit", "bitch", "asshole", "kurva", "kokot", "prdel", "damn", "cunt",
  ]);
  const w = partialCensor(base, rng);
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  return pick(rng, [
    [{ s: "What the " }, { s: w, p: true, letters: letterCount(base) }, { s: "?" }],
    [{ s: "This " }, { s: noun }, { s: " is " }, { s: w, p: true, letters: letterCount(base) }, { s: "." }],
    [{ s: w, p: true, letters: letterCount(base) }, { s: `, ${pick(rng, EN_NAME)}.` }],
    [{ s: "Fakt " }, { s: w, p: true, letters: letterCount(base) }, { s: "." }],
  ]);
}

function gen_repeat_padding(rng) {
  const base = pick(rng, [...EN_STRONG, ...CS_STRONG, "fuck", "shit"]);
  const w = repeatPad(base, rng);
  return pick(rng, [
    [{ s: w, p: true, letters: letterCount(w) }, { s: " this mess." }],
    [{ s: "To je " }, { s: w, p: true, letters: letterCount(w) }, { s: "!" }],
    [{ s: "Such " }, { s: w, p: true, letters: letterCount(w) }, { s: "." }],
  ]);
}

function gen_homoglyph_cyrillic(rng) {
  const base = pick(rng, ["fuck", "shit", "bitch", "cock", "ass", "kurva", "kokot"]);
  const w = homoglyphify(base, rng);
  // ensure at least one cyrillic
  const forced = [...base].map((ch, i) =>
    i === 1 && { a: "а", e: "е", o: "о", u: "и" }[ch] ? { a: "а", e: "е", o: "о", u: "у" }[ch] : ch,
  );
  const surface = /\p{Script=Cyrillic}/u.test(w) ? w : forced.join("");
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  return pick(rng, [
    [{ s: "This is " }, { s: surface, p: true, letters: letterCount(base) }, { s: ` ${noun}.` }],
    [{ s: surface, p: true, letters: letterCount(base) }, { s: " you." }],
    [{ s: "To je " }, { s: surface, p: true, letters: letterCount(base) }, { s: "." }],
  ]);
}

function gen_zwsp_invisible(rng) {
  const base = pick(rng, ["fuck", "shit", "kurva", "kokot", "bitch", "damn"]);
  const w = zwspify(base);
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  return pick(rng, [
    [{ s: "Honestly " }, { s: w, p: true, letters: letterCount(base) }, { s: ` this ${noun}.` }],
    [{ s: "To je " }, { s: w, p: true, letters: letterCount(base) }, { s: "." }],
    [{ s: w, p: true, letters: letterCount(base) }, { s: " off." }],
  ]);
}

function gen_typos_adjacency(rng) {
  const base = pick(rng, ["fuck", "shit", "bitch", "kurva", "kokot", "prdel", "asshole"]);
  let w = keyboardTypo(base, rng);
  if (w === base) w = keyboardTypo(base, rng);
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  return pick(rng, [
    [{ s: "This " }, { s: noun }, { s: " is " }, { s: w, p: true, letters: letterCount(w) }, { s: "." }],
    [{ s: w, p: true, letters: letterCount(w) }, { s: ", really." }],
    [{ s: "To je " }, { s: w, p: true, letters: letterCount(w) }, { s: "." }],
  ]);
}

function gen_multi_profanity(rng) {
  const a = pick(rng, [...EN_STRONG, ...CS_STRONG]);
  let b = pick(rng, [...EN_STRONG_TEST, ...CS_STRONG_TEST, ...EN_STRONG]);
  if (b === a) b = "shit";
  const c = pick(rng, ["fuck", "kurva", "crap", "hovno"]);
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  return pick(rng, [
    [
      { s: "What the " }, { s: a, p: true }, { s: " — total " }, { s: b, p: true },
      { s: ` ${noun} and ` }, { s: c, p: true }, { s: "." },
    ],
    [
      { s: a, p: true }, { s: " and " }, { s: b, p: true },
      { s: ", ty " }, { s: c, p: true }, { s: " jeden." },
    ],
    [
      { s: `The ${noun}: ` }, { s: a, p: true }, { s: ", " },
      { s: b, p: true }, { s: ", " }, { s: c, p: true }, { s: "." },
    ],
  ]);
}

function gen_quotes_parens(rng) {
  const base = pick(rng, [...EN_STRONG, ...CS_STRONG, ...EN_STRONG_TEST]);
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  return pick(rng, [
    [{ s: `He said "` }, { s: base, p: true }, { s: `" about the ${noun}.` }],
    [{ s: "Quote: (" }, { s: base, p: true }, { s: `) — regarding ${noun}.` }],
    [{ s: "Called me '" }, { s: base, p: true }, { s: "' in the ticket." }],
    [{ s: `Poznámka: «` }, { s: base, p: true }, { s: `» u ${noun}.` }],
  ]);
}

function gen_glued_affix(rng) {
  const stem = pick(rng, ["čurák", "kurva", "kokot", "fuck", "shit", "prdel"]);
  const prefixes = ["super", "world", "mega", "ultra", "total", "hello"];
  const suffixes = ["ík", "íček", "ový", "áček", "y", "ish"];
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  if (rng() < 0.55) {
    const pref = pick(rng, prefixes);
    // gold spans: clean prefix + profane stem only (world + čurák → world*****)
    return pick(rng, [
      [{ s: "Ty jsi " }, { s: pref }, { s: stem, p: true }, { s: "." }],
      [{ s: pref }, { s: stem, p: true }, { s: ` rozbil ${noun}.` }],
      [{ s: "Hello " }, { s: pref }, { s: stem, p: true }, { s: "." }],
    ]);
  }
  const suf = pick(rng, suffixes);
  const base = stem === "kurva" ? "kurv" + pick(rng, ["ínky", "ák", "ička"]) : stem + suf;
  return pick(rng, [
    [{ s: "To jsou " }, { s: base, p: true }, { s: "." }],
    [{ s: base, p: true }, { s: ` a ${noun}.` }],
  ]);
}

function gen_substring_scunthorpe(rng) {
  // Clean words containing banned substrings — must NOT flag
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  const name = pick(rng, [...EN_NAME, ...CS_NAME]);
  return pick(rng, [
    [{ s: `Scunthorpe shipping of ${noun} passed quality checks.` }],
    [{ s: `The assessment of classic ${noun} assets is done.` }],
    [{ s: `Shiitake and bass in the ${noun} casserole.` }],
    [{ s: `Cockpit instruments looked classic for ${name}.` }],
    [{ s: `Pass the glass of cocktail, bartender — ${noun}.` }],
    [{ s: `Kundera and the kurýr met near Písek about ${noun}.` }],
    [{ s: `Shellfish assumption: classic ${noun} recipe.` }],
    [{ s: `Hello assistant, class homework on ${noun} is ready.` }],
    [{ s: `Document title: Aggregate Passage Analysis (${noun}).` }],
    [{ s: `The therapist assessed the classic ${noun} case.` }],
    [{ s: `Essex and Sussex classic ${noun} tour packages.` }],
    [{ s: `Button attributed; classic UI pass for ${noun}.` }],
    [{ s: `${name} reviewed the classic passage on ${noun}.` }],
    [{ s: `Assumption holds; assets of ${noun} look fine.` }],
  ]);
}

function gen_foreign_phonetic(rng) {
  const base = pick(rng, ["fuck", "shit", "bitch", "asshole", "damn", "cock"]);
  const w = phoneticEn(base, rng);
  const noun = pick(rng, EN_NOUN);
  return pick(rng, [
    [{ s: "This " }, { s: noun }, { s: " is " }, { s: w, p: true, letters: letterCount(w) }, { s: "." }],
    [{ s: w, p: true, letters: letterCount(w) }, { s: " that noise." }],
    [{ s: "Total " }, { s: w, p: true, letters: letterCount(w) }, { s: "." }],
  ]);
}

function gen_word_inversion_light(rng) {
  // light reorder / reversed fragments (optional research family)
  const base = pick(rng, ["fuck", "shit", "kurva"]);
  const mid = Math.floor(base.length / 2);
  const w = base.slice(mid) + base.slice(0, mid); // uckf / itsh / rvaku
  // Only flag if still human-recognizable — we keep gold as POSITIVE for near-reversals
  // that still contain the letter multiset; methods may miss — hard case
  const noun = pick(rng, [...EN_NOUN, ...CS_NOUN]);
  return pick(rng, [
    [{ s: "Coded " }, { s: w, p: true, letters: letterCount(base) }, { s: ` ${noun}.` }],
    [{ s: w, p: true, letters: letterCount(base) }, { s: " (reordered)." }],
  ]);
}

const TRAIN_DEV_FNS = {
  clean_praise_cs: gen_clean_praise_cs,
  clean_praise_en: gen_clean_praise_en,
  strong_cs: gen_strong_cs,
  strong_en: gen_strong_en,
  mild_interjection_cs: gen_mild_interjection_cs,
  obfuscation_leet: gen_obfuscation_leet,
  rude_insult_cs: gen_rude_insult_cs,
  rude_insult_en: gen_rude_insult_en,
  repeat_pad_train: gen_repeat_pad_train,
  partial_censor_train: gen_partial_censor_train,
  sep_space_train: gen_sep_space_train,
  ...V3_TRAIN_DEV_FNS,
};

const TEST_FNS = {
  obfuscation_spaced: gen_obfuscation_spaced,
  punct_glued: gen_punct_glued,
  code_switch: gen_code_switch,
  near_miss_clean: gen_near_miss_clean,
  mild_interjection_en: gen_mild_interjection_en,
  strong_cs_compound: gen_strong_cs_compound,
  clean_thanks_cs: gen_clean_thanks_cs,
  clean_thanks_en: gen_clean_thanks_en,
  rude_not_profane_cs: gen_rude_not_profane_cs,
  rude_not_profane_en: gen_rude_not_profane_en,
  obfuscation_mixed: gen_obfuscation_mixed,
  sep_dot_uscore: gen_sep_dot_uscore,
  partial_self_censor: gen_partial_self_censor,
  repeat_padding: gen_repeat_padding,
  homoglyph_cyrillic: gen_homoglyph_cyrillic,
  zwsp_invisible: gen_zwsp_invisible,
  typos_adjacency: gen_typos_adjacency,
  multi_profanity: gen_multi_profanity,
  quotes_parens: gen_quotes_parens,
  glued_affix: gen_glued_affix,
  substring_scunthorpe: gen_substring_scunthorpe,
  foreign_phonetic: gen_foreign_phonetic,
  word_inversion_light: gen_word_inversion_light,
  ...V3_TEST_FNS,
};

/** Aim ≥1800 total: train~700 / dev~260 / test≥600 / real_clean 200. Czech-first. */
const COUNTS = {
  train: {
    clean_praise_cs: 55,
    clean_praise_en: 12,
    strong_cs: 85,
    strong_en: 18,
    mild_interjection_cs: 40,
    obfuscation_leet: 55,
    rude_insult_cs: 50,
    rude_insult_en: 12,
    repeat_pad_train: 40,
    partial_censor_train: 40,
    sep_space_train: 40,
    // V3 train analogs
    algospeak_train: 40,
    short_code_train: 40,
    semantic_weapon_train: 35,
    coded_hate_train: 28,
    subculture_train: 30,
    coded_hate_trap_train: 20,
    cs_evasion_train: 50,
  },
  dev: {
    clean_praise_cs: 20,
    clean_praise_en: 5,
    strong_cs: 28,
    strong_en: 8,
    mild_interjection_cs: 14,
    obfuscation_leet: 18,
    rude_insult_cs: 18,
    rude_insult_en: 6,
    repeat_pad_train: 14,
    partial_censor_train: 14,
    sep_space_train: 14,
    algospeak_train: 14,
    short_code_train: 14,
    semantic_weapon_train: 12,
    coded_hate_train: 10,
    subculture_train: 12,
    coded_hate_trap_train: 8,
    cs_evasion_train: 18,
  },
  test: {
    // V2 held-out (mostly CS-leaning templates already mixed)
    obfuscation_spaced: 24,
    punct_glued: 18,
    code_switch: 22,
    near_miss_clean: 22,
    mild_interjection_en: 10,
    strong_cs_compound: 28,
    clean_thanks_cs: 24,
    clean_thanks_en: 8,
    rude_not_profane_cs: 32,
    rude_not_profane_en: 12,
    obfuscation_mixed: 22,
    sep_dot_uscore: 22,
    partial_self_censor: 22,
    repeat_padding: 18,
    homoglyph_cyrillic: 18,
    zwsp_invisible: 18,
    typos_adjacency: 16,
    multi_profanity: 20,
    quotes_parens: 14,
    glued_affix: 22,
    substring_scunthorpe: 16,
    foreign_phonetic: 12,
    word_inversion_light: 10,
    // V3 held-out families
    algospeak_hostile: 48,
    short_code_insult: 42,
    subculture_slur: 36,
    semantic_weapon: 40,
    coded_hate: 36,
    coded_hate_trap: 28,
  },
};

function generateFamily(rng, family, split, n, fn) {
  const out = [];
  const seen = new Set();
  let guard = 0;
  while (out.length < n && guard < n * 60) {
    guard++;
    const slots = fn(rng);
    const text = slots.map((s) => s.s).join("");
    if (seen.has(text)) continue;
    seen.add(text);
    const id = `${split}_${family}_${String(out.length).padStart(4, "0")}`;
    out.push(slotsToExample(id, family, split, slots));
  }
  if (out.length < n) {
    console.error(`warn: only ${out.length}/${n} unique for ${split}/${family}`);
  }
  return out;
}

function canonExample() {
  return slotsToExample("test_canon_fuck_shit", "canon_example", "test", [
    { s: "hello world, " },
    { s: "fuck", p: true },
    { s: ", " },
    { s: "shit", p: true },
    { s: ", hello" },
  ]);
}

function loadReviews() {
  const raw = readFileSync(REVIEWS, "utf8");
  const rows = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const t = JSON.parse(line);
      if (typeof t === "string") rows.push(t);
    } catch {
      /* skip */
    }
  }
  return rows;
}

function sampleRealClean(rng, n) {
  const reviews = loadReviews();
  const candidates = reviews.filter((t) => {
    const s = t.replace(/\s+/g, " ").trim();
    return s.length >= 20 && s.length <= 380;
  });
  const idx = candidates.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const out = [];
  for (const i of idx) {
    if (out.length >= n) break;
    const text = candidates[i].replace(/\r\n/g, "\n");
    out.push({
      id: `real_clean_${String(out.length).padStart(4, "0")}`,
      family: "real_clean",
      split: "real_clean",
      text,
      has_profanity: false,
      censored_gold: text,
      spans: null,
    });
  }
  return out;
}

function main() {
  const rng = mulberry32(SEED);
  const all = [];

  for (const split of ["train", "dev"]) {
    for (const [family, n] of Object.entries(COUNTS[split])) {
      all.push(...generateFamily(rng, family, split, n, TRAIN_DEV_FNS[family]));
    }
  }
  for (const [family, n] of Object.entries(COUNTS.test)) {
    all.push(...generateFamily(rng, family, "test", n, TEST_FNS[family]));
  }
  all.push(canonExample());
  all.push(...sampleRealClean(rng, 200));

  const canon = all.find((x) => x.id === "test_canon_fuck_shit");
  if (canon.censored_gold !== "hello world, ****, ****, hello") {
    throw new Error(`canon gold mismatch: ${JSON.stringify(canon.censored_gold)}`);
  }
  if (!canon.has_profanity) throw new Error("canon should be positive");

  // v2b: rude_* families must be POSITIVE; Scunthorpe / near-miss stay negative
  for (const r of all) {
    if (
      (r.family === "rude_not_profane_cs" ||
        r.family === "rude_not_profane_en" ||
        r.family === "rude_insult_cs" ||
        r.family === "rude_insult_en") &&
      !r.has_profanity
    ) {
      throw new Error(`expected rude positive: ${r.id} ${r.family}`);
    }
    if (
      (r.family === "substring_scunthorpe" ||
        r.family === "near_miss_clean" ||
        r.family === "coded_hate_trap" ||
        r.family === "coded_hate_trap_train") &&
      r.has_profanity
    ) {
      throw new Error(`expected negative: ${r.id} ${r.family}`);
    }
    if (
      (r.family === "algospeak_hostile" ||
        r.family === "short_code_insult" ||
        r.family === "subculture_slur" ||
        r.family === "semantic_weapon" ||
        r.family === "coded_hate" ||
        r.family === "algospeak_train" ||
        r.family === "short_code_train" ||
        r.family === "semantic_weapon_train" ||
        r.family === "coded_hate_train" ||
        r.family === "subculture_train") &&
      !r.has_profanity
    ) {
      throw new Error(`expected V3 positive: ${r.id} ${r.family}`);
    }
  }

  const trainDevFam = new Set(
    all.filter((x) => x.split === "train" || x.split === "dev").map((x) => x.family),
  );
  const testFam = new Set(all.filter((x) => x.split === "test").map((x) => x.family));
  for (const f of testFam) {
    if (trainDevFam.has(f)) throw new Error(`test family leaked into train/dev: ${f}`);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, all.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");

  const bySplit = {};
  const byFam = {};
  let pos = 0;
  let neg = 0;
  for (const r of all) {
    bySplit[r.split] = (bySplit[r.split] || 0) + 1;
    byFam[`${r.split}:${r.family}`] = (byFam[`${r.split}:${r.family}`] || 0) + 1;
    if (r.has_profanity) pos++;
    else neg++;
  }
  console.log(
    JSON.stringify(
      { n: all.length, bySplit, pos, neg, seed: SEED, out: OUT },
      null,
      2,
    ),
  );
  console.error("families:", JSON.stringify(byFam, null, 2));
}

main();
