/**
 * V3 held-out + train-analog generators for Youklid external-comms filter.
 * Test families are DISJOINT from train/dev (different surfaces/templates).
 * Czech-first hostile review tone by default.
 */
import { letterCount } from "../lib/text.mjs";

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function rudeSlotsFromPhrase(phrase, restPrefix = "", restSuffix = "") {
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

const CS_NOUN = [
  "úklid", "objednávka", "řidič", "balík", "aplikace", "refundace",
  "fronta", "servis", "účet", "podpora", "uklízečka", "recepce",
];
const EN_NOUN = [
  "service", "order", "driver", "app", "refund", "package", "manager",
  "queue", "ticket", "delivery", "cleaner", "support",
];
const CS_NAME = ["Petr", "Jana", "Martin", "Eva", "Tomáš", "Lucie", "Honza", "Klára"];
const EN_NAME = ["Sam", "Alex", "Jordan", "Chris", "Taylor", "Morgan"];

// ---------- TRAIN/DEV analogs (surfaces OK for lexicon maps) ----------

/** Train algospeak: EN-leaning + a few CS mirrors; hostile review. */
export function gen_algospeak_train(rng) {
  const noun = pick(rng, [...CS_NOUN, ...EN_NOUN]);
  const name = pick(rng, [...CS_NAME, ...EN_NAME]);
  return pick(rng, [
    [
      { s: `Po tom ${noun} bych se radši ` },
      { s: "unalive", p: true },
      { s: `, říká ${name} v recenzi.` },
    ],
    [
      { s: "Ten servis je na " },
      { s: "sewer", p: true },
      { s: " " },
      { s: "slide", p: true },
      { s: `, fakt k ničemu (${noun}).` },
    ],
    [
      { s: "V téhle aplikaci jen " },
      { s: "seggs", p: true },
      { s: " reklamy a žádný " },
      { s: noun },
      { s: "." },
    ],
    [
      { s: "Review: full of " },
      { s: "corn", p: true },
      { s: ` ads, zero real ${noun}.` },
    ],
    [
      { s: "Po tomhle " },
      { s: noun },
      { s: " — " },
      { s: "le", p: true },
      { s: " " },
      { s: "dollar", p: true },
      { s: " " },
      { s: "bean", p: true },
      { s: " vibes, zero help." },
    ],
    [
      { s: "Ta " },
      { s: noun },
      { s: " zkušenost byla " },
      { s: "SA", p: true, letters: 2 },
      { s: "-coded trauma, not okay." },
    ],
    [
      { s: "Hezky řečeno: " },
      { s: "grape", p: true },
      { s: ` situation with ${name} at ${noun} — hostile.` },
    ],
    [
      { s: "Po ${noun} chci " },
      { s: "unalive", p: true },
      { s: " button v UI, sarkasmus." },
    ],
  ]);
}

/** Train short codes: kys/kms + Czech TVL/TWL + dollar leet of CS swears. */
export function gen_short_code_train(rng) {
  const noun = pick(rng, CS_NOUN);
  const name = pick(rng, CS_NAME);
  return pick(rng, [
    [
      { s: "Po tomhle " },
      { s: noun },
      { s: " fakt " },
      { s: "kys", p: true, letters: 3 },
      { s: `, ${name}.` },
    ],
    [
      { s: "Support chat: " },
      { s: "kms", p: true, letters: 3 },
      { s: ` after waiting on ${noun}.` },
    ],
    [
      { s: "Ty " },
      { s: "tvl", p: true, letters: 3 },
      { s: `, ten ${noun} je tragédie.` },
    ],
    [
      { s: "No " },
      { s: "twl", p: true, letters: 3 },
      { s: `, zase pozdní ${noun}.` },
    ],
    [
      { s: "Recenze: " },
      { s: "kv*", p: true, letters: 5 },
      { s: ` ten ${noun} (kurva-leet).` },
    ],
    [
      { s: "Chat: " },
      { s: "k$$ot", p: true, letters: 5 },
      { s: ` za ${noun}.` },
    ],
    [
      { s: name },
      { s: " napsal " },
      { s: "kys", p: true, letters: 3 },
      { s: " do ticketu o " },
      { s: noun },
      { s: "." },
    ],
    [
      { s: "Za ten " },
      { s: noun },
      { s: " — " },
      { s: "kms", p: true, letters: 3 },
      { s: " vibes." },
    ],
  ]);
}

/** Train semantic weaponization (polite surface, demeaning intent). */
export function gen_semantic_weapon_train(rng) {
  const noun = pick(rng, CS_NOUN);
  const name = pick(rng, CS_NAME);
  return pick(rng, [
    [
      { s: "Paní " },
      { s: name },
      { s: " je " },
      { s: "užitečná", p: true },
      { s: " " },
      { s: "jako", p: true },
      { s: " " },
      { s: "díra", p: true },
      { s: " " },
      { s: "v", p: true },
      { s: " " },
      { s: "botě", p: true },
      { s: ` u ${noun}.` },
    ],
    [
      { s: "Moc " },
      { s: "šikovný", p: true },
      { s: " " },
      { s: "na", p: true },
      { s: " " },
      { s: "svůj", p: true },
      { s: " " },
      { s: "věk", p: true },
      { s: `, říkám sarkasticky o ${noun}.` },
    ],
    [
      { s: "Asistent byl " },
      { s: "překvapivě", p: true },
      { s: " " },
      { s: "kompetentní", p: true },
      { s: " " },
      { s: "na", p: true },
      { s: " " },
      { s: "brigádníka", p: true },
      { s: ` — dig u ${noun}.` },
    ],
    [
      { s: "Your " },
      { s: noun },
      { s: " team is " },
      { s: "delightfully", p: true },
      { s: " " },
      { s: "inept", p: true },
      { s: "." },
    ],
    [
      { s: "Ten " },
      { s: noun },
      { s: " je " },
      { s: "skvělý", p: true },
      { s: " " },
      { s: "pokud", p: true },
      { s: " " },
      { s: "nemáte", p: true },
      { s: " " },
      { s: "oči", p: true },
      { s: "." },
    ],
    [
      { s: name },
      { s: " u " },
      { s: noun },
      { s: " — " },
      { s: "milá", p: true },
      { s: " " },
      { s: "jako", p: true },
      { s: " " },
      { s: "daňová", p: true },
      { s: " " },
      { s: "kontrola", p: true },
      { s: "." },
    ],
  ]);
}

/** Train coded hate in clearly hateful review sentences (not bare numbers). */
export function gen_coded_hate_train(rng) {
  const noun = pick(rng, CS_NOUN);
  return pick(rng, [
    [
      { s: "Recenze plná " },
      { s: "14", p: true, letters: 2 },
      { s: " " },
      { s: "words", p: true },
      { s: ` a nenávisti kvůli ${noun}.` },
    ],
    [
      { s: "Hate sig: " },
      { s: "88", p: true, letters: 2 },
      { s: ` crew hates your ${noun}.` },
    ],
    [
      { s: "Ten tiket: heil " },
      { s: "88", p: true, letters: 2 },
      { s: ` — smazat, ${noun}.` },
    ],
    [
      { s: "Fanoušek napsal " },
      { s: "14", p: true, letters: 2 },
      { s: " jako dogwhistle u " },
      { s: noun },
      { s: "." },
    ],
    [
      { s: "Komentář: white " },
      { s: "14", p: true, letters: 2 },
      { s: " power vibe, ban " },
      { s: noun },
      { s: "." },
    ],
  ]);
}

/** Train subculture insults (football/gaming flame) — synthetic labels. */
export function gen_subculture_train(rng) {
  const noun = pick(rng, CS_NOUN);
  const name = pick(rng, CS_NAME);
  return pick(rng, [
    [
      { s: "Ty " },
      { s: "ultrásáku", p: true },
      { s: `, ten ${noun} jsi pokazil.` },
    ],
    [
      { s: "Chat flame: " },
      { s: "noob", p: true },
      { s: " " },
      { s: "trash", p: true },
      { s: ` ${name} na ${noun}.` },
    ],
    [
      { s: "Sektor volá " },
      { s: "pako", p: true },
      { s: ` na ${name} kvůli ${noun}.` },
    ],
    [
      { s: "Gaming: " },
      { s: "ez", p: true },
      { s: " " },
      { s: "diff", p: true },
      { s: `, ${name} je ` },
      { s: "bot", p: true },
      { s: ` u ${noun}.` },
    ],
    [
      { s: "Fotbal dig: " },
      { s: "chuligán", p: true },
      { s: ` z tribuny nadával u ${noun}.` },
    ],
    [
      { s: "Ty " },
      { s: "baníkářský", p: true },
      { s: " " },
      { s: "fanoušku", p: true },
      { s: ` — synthetic slur dig u ${noun}.` },
    ],
  ]);
}

/** Train clean traps for numeric codes (negative). */
export function gen_coded_hate_trap_train(rng) {
  const noun = pick(rng, CS_NOUN);
  return pick(rng, [
    [{ s: `Sleva 14% na ${noun} platí do pátku.` }],
    [{ s: `Autobusová linka 88 jede kolem skladu.` }],
    [{ s: `Účetní položka 14 Kč za ${noun}.` }],
    [{ s: `Byt číslo 88, třetí patro, ${noun} OK.` }],
    [{ s: `Článek 14 obchodních podmínek o ${noun}.` }],
    [{ s: `Open from 8 to 14, ${noun} desk.` }],
  ]);
}

// ---------- TEST held-out (DISJOINT surfaces/templates) ----------

/** Test algospeak — Czech mirrors + hostile review; different from train. */
export function gen_algospeak_hostile(rng) {
  const noun = pick(rng, CS_NOUN);
  const name = pick(rng, CS_NAME);
  return pick(rng, [
    [
      { s: `Po tomhle ${noun} jsem skoro ` },
      { s: "neživý", p: true },
      { s: `, píše ${name}.` },
    ],
    [
      { s: "Recenze: po " },
      { s: noun },
      { s: " zvažuju " },
      { s: "sebe-odinstalování", p: true },
      { s: "." },
    ],
    [
      { s: "Váš " },
      { s: noun },
      { s: " je samá " },
      { s: "kukuřice", p: true },
      { s: " (corn-porn narážka), nula práce." },
    ],
    [
      { s: "Aplikace plná " },
      { s: "kukuřice", p: true },
      { s: ` místo ${noun} — hostile corn joke.` },
    ],
    [
      { s: "Ticket: almost " },
      { s: "unalive", p: true },
      { s: `d myself waiting for ${noun} — customer rage.` },
    ],
    [
      { s: "Po " },
      { s: noun },
      { s: " jen " },
      { s: "seggs", p: true },
      { s: " spam v notifikacích." },
    ],
    [
      { s: name },
      { s: ": that " },
      { s: noun },
      { s: " felt like a " },
      { s: "grape", p: true },
      { s: " story (SA-code), delete." },
    ],
    [
      { s: "CS review: " },
      { s: "neživá", p: true },
      { s: ` atmosféra u ${noun}, chci pryč.` },
    ],
    [
      { s: "Sewer-" },
      { s: "slide", p: true },
      { s: ` energy after ${noun} — never again.` },
    ],
    [
      { s: "Le$" },
      { s: "bean", p: true },
      { s: ` moment with ${name} at ${noun}.` },
    ],
  ]);
}

/** Test short codes — ky$/kmn + CS shortenings disjoint from train. */
export function gen_short_code_insult(rng) {
  const noun = pick(rng, CS_NOUN);
  const name = pick(rng, CS_NAME);
  return pick(rng, [
    [
      { s: `Po ${noun} fakt ` },
      { s: "ky$", p: true, letters: 3 },
      { s: `, ${name}.` },
    ],
    [
      { s: "Chat: " },
      { s: "kmn", p: true, letters: 3 },
      { s: ` this ${noun} wait.` },
    ],
    [
      { s: "Ticket reply " },
      { s: "kys", p: true, letters: 3 },
      { s: " from troll on " },
      { s: noun },
      { s: "." },
    ],
    [
      { s: "Ty " },
      { s: "twl", p: true, letters: 3 },
      { s: ` jeden, ${noun} znova pozdě.` },
    ],
    [
      { s: "Recenze: " },
      { s: "tvl", p: true, letters: 3 },
      { s: ` s tím ${noun}.` },
    ],
    [
      { s: "Dollar-leet: " },
      { s: "prd$l", p: true, letters: 5 },
      { s: ` ten ${noun}.` },
    ],
    [
      { s: "Zkratka " },
      { s: "kms", p: true, letters: 3 },
      { s: ` v komentáři u ${noun}.` },
    ],
    [
      { s: name },
      { s: " napsal " },
      { s: "ky$", p: true, letters: 3 },
      { s: " pod " },
      { s: noun },
      { s: "." },
    ],
    [
      { s: "Flame: " },
      { s: "kmn", p: true, letters: 3 },
      { s: " / " },
      { s: "kys", p: true, letters: 3 },
      { s: ` po ${noun}.` },
    ],
  ]);
}

/** Test subculture — disjoint football/gaming labels. */
export function gen_subculture_slur(rng) {
  const noun = pick(rng, CS_NOUN);
  const name = pick(rng, CS_NAME);
  return pick(rng, [
    [
      { s: "Ty " },
      { s: "šoupáku", p: true },
      { s: ` z kotle, ${noun} jsi zničil.` },
    ],
    [
      { s: "Gaming flame: " },
      { s: "inting", p: true },
      { s: " " },
      { s: name },
      { s: " is " },
      { s: "hardstuck", p: true },
      { s: ` trash on ${noun}.` },
    ],
    [
      { s: "Ultras dig: " },
      { s: "vlezdoprdelka", p: true },
      { s: ` z tribuny na ${name} (${noun}).` },
    ],
    [
      { s: "Lokální dig: " },
      { s: "píchej", p: true },
      { s: " " },
      { s: "domů", p: true },
      { s: ` — demeaning group yell u ${noun}.` },
    ],
    [
      { s: "Recenze: " },
      { s: "feeder", p: true },
      { s: " " },
      { s: name },
      { s: ` zabil ${noun} run.` },
    ],
    [
      { s: "Kotel: " },
      { s: "slávistickej", p: true },
      { s: " " },
      { s: "mizera", p: true },
      { s: ` (synthetic) u ${noun}.` },
    ],
    [
      { s: "GG " },
      { s: "ez", p: true },
      { s: ", ty " },
      { s: "noobe", p: true },
      { s: ` z ${noun}.` },
    ],
    [
      { s: "Ty " },
      { s: "skalní", p: true },
      { s: " " },
      { s: "hulváte", p: true },
      { s: ` z fanouškovské sekce — ${noun}.` },
    ],
  ]);
}

/** Test semantic weaponization — held-out templates. */
export function gen_semantic_weapon(rng) {
  const noun = pick(rng, CS_NOUN);
  const name = pick(rng, CS_NAME);
  return pick(rng, [
    [
      { s: "Moc " },
      { s: "milá", p: true },
      { s: " " },
      { s: "paní", p: true },
      { s: " " },
      { s: "na", p: true },
      { s: " " },
      { s: "svůj", p: true },
      { s: " " },
      { s: "věk", p: true },
      { s: ` u ${noun} — ageist dig.` },
    ],
    [
      { s: name },
      { s: " je " },
      { s: "užitečný", p: true },
      { s: " " },
      { s: "jako", p: true },
      { s: " " },
      { s: "deštník", p: true },
      { s: " " },
      { s: "v", p: true },
      { s: " " },
      { s: "ponorce", p: true },
      { s: ` (${noun}).` },
    ],
    [
      { s: "Úžasně " },
      { s: "rychlá", p: true },
      { s: " " },
      { s: "jako", p: true },
      { s: " " },
      { s: "ledovec", p: true },
      { s: ` ta ${noun}.` },
    ],
    [
      { s: "How " },
      { s: "refreshingly", p: true },
      { s: " " },
      { s: "mediocre", p: true },
      { s: ` your ${noun} is.` },
    ],
    [
      { s: "Pan " },
      { s: name },
      { s: " — " },
      { s: "talent", p: true },
      { s: " " },
      { s: "na", p: true },
      { s: " " },
      { s: "úroveň", p: true },
      { s: " " },
      { s: "školky", p: true },
      { s: ` u ${noun}.` },
    ],
    [
      { s: "Vaše " },
      { s: noun },
      { s: " je " },
      { s: "perfektní", p: true },
      { s: " " },
      { s: "pro", p: true },
      { s: " " },
      { s: "někoho", p: true },
      { s: " " },
      { s: "bez", p: true },
      { s: " " },
      { s: "standardů", p: true },
      { s: "." },
    ],
    [
      { s: "Such a " },
      { s: "brave", p: true },
      { s: " " },
      { s: "choice", p: true },
      { s: ` of ${noun} staff — thinly veiled.` },
    ],
    [
      { s: "Paní z " },
      { s: noun },
      { s: " je " },
      { s: "charismatická", p: true },
      { s: " " },
      { s: "jako", p: true },
      { s: " " },
      { s: "čekání", p: true },
      { s: " " },
      { s: "na", p: true },
      { s: " " },
      { s: "úřadě", p: true },
      { s: "." },
    ],
  ]);
}

/** Test coded hate — 14/88 in clearly hateful Czech review sentences. */
export function gen_coded_hate(rng) {
  const noun = pick(rng, CS_NOUN);
  const name = pick(rng, CS_NAME);
  return pick(rng, [
    [
      { s: "Nenávistný komentář: " },
      { s: "14/88", p: true, letters: 4 },
      { s: ` u ${noun}, smazat.` },
    ],
    [
      { s: "Recenze s " },
      { s: "14", p: true, letters: 2 },
      { s: "/" },
      { s: "88", p: true, letters: 2 },
      { s: ` dogwhistle proti ${name} (${noun}).` },
    ],
    [
      { s: "Hate review ends with " },
      { s: "88", p: true, letters: 2 },
      { s: ` — ban from ${noun}.` },
    ],
    [
      { s: "Psal " },
      { s: "14", p: true, letters: 2 },
      { s: " words of hate o " },
      { s: noun },
      { s: "." },
    ],
    [
      { s: "Koment: heilige " },
      { s: "88", p: true, letters: 2 },
      { s: ` crew vs ${noun}.` },
    ],
    [
      { s: "Ticket subject: " },
      { s: "14", p: true, letters: 2 },
      { s: " " },
      { s: "words", p: true },
      { s: ` forever — hate on ${noun}.` },
    ],
    [
      { s: name },
      { s: " přidal " },
      { s: "14/88", p: true, letters: 4 },
      { s: ` do hodnocení ${noun}.` },
    ],
    [
      { s: "Extrém: čísla " },
      { s: "14", p: true, letters: 2 },
      { s: " a " },
      { s: "88", p: true, letters: 2 },
      { s: ` jako hate kód u ${noun}.` },
    ],
  ]);
}

/** Test negative traps — sleva 14%, linka 88, etc. MUST stay clean. */
export function gen_coded_hate_trap(rng) {
  const noun = pick(rng, CS_NOUN);
  const name = pick(rng, CS_NAME);
  return pick(rng, [
    [{ s: `Aktuální sleva 14% na ${noun} do neděle.` }],
    [{ s: `Linka 88 MHD zastavuje u skladu ${noun}.` }],
    [{ s: `Faktura: položka 14, cena 88 Kč za ${noun}.` }],
    [{ s: `Schůzka v místnosti 14, patro 2, ${name}.` }],
    [{ s: `Autobus 88 přijel včas s balíkem ${noun}.` }],
    [{ s: `Sleva 14 procent — běžná marketingová akce.` }],
    [{ s: `Open 08–14 daily; ${noun} counter staffed.` }],
    [{ s: `Článek 14 smlouvy o ${noun} je v pořádku.` }],
    [{ s: `Byt 88, ulice Nová, ${name} převzal ${noun}.` }],
    [{ s: `Kapitola 14 příručky popisuje ${noun} postup.` }],
  ]);
}

/** Extra Czech-heavy evasion carry-forward for train (leet/spaced mostly CS). */
export function gen_cs_evasion_train(rng) {
  const bases = ["kurva", "kokot", "prdel", "hovno", "zmrd", "debil", "čurák"];
  const base = pick(rng, bases);
  const noun = pick(rng, CS_NOUN);
  const mode = pick(rng, ["leet", "space", "zwsp", "partial", "glue"]);
  let w = base;
  let letters = letterCount(base);
  if (mode === "leet") {
    w = base
      .replace(/a/gi, "@")
      .replace(/o/gi, "0")
      .replace(/e/gi, "3")
      .replace(/i/gi, "1");
  } else if (mode === "space") {
    w = base.split("").join(" ");
  } else if (mode === "zwsp") {
    w = base.split("").join("\u200B");
  } else if (mode === "partial") {
    w = base[0] + "*" + base.slice(2);
  } else {
    return [
      { s: "Ty jsi mega" },
      { s: base, p: true },
      { s: ` u ${noun}.` },
    ];
  }
  return pick(rng, [
    [{ s: "To je " }, { s: w, p: true, letters }, { s: ` ${noun}.` }],
    [{ s: w, p: true, letters }, { s: `, ten ${noun} je tragédie.` }],
    [{ s: "Fakt " }, { s: w, p: true, letters }, { s: ` s ${noun}.` }],
  ]);
}

export const V3_TRAIN_DEV_FNS = {
  algospeak_train: gen_algospeak_train,
  short_code_train: gen_short_code_train,
  semantic_weapon_train: gen_semantic_weapon_train,
  coded_hate_train: gen_coded_hate_train,
  subculture_train: gen_subculture_train,
  coded_hate_trap_train: gen_coded_hate_trap_train,
  cs_evasion_train: gen_cs_evasion_train,
};

export const V3_TEST_FNS = {
  algospeak_hostile: gen_algospeak_hostile,
  short_code_insult: gen_short_code_insult,
  subculture_slur: gen_subculture_slur,
  semantic_weapon: gen_semantic_weapon,
  coded_hate: gen_coded_hate,
  coded_hate_trap: gen_coded_hate_trap,
};

/** Documentation of synthetic subculture terms (not targeting real people). */
export const V3_SUBCULTURE_DOC = `
Synthetic football/ultras-adjacent and gaming flame labels used as attacks:
train: ultrásák, pako, noob trash, bot, chuligán, baníkářský fanoušek (label only)
test: šoupák, inting/hardstuck, vlezdoprdelka, píchej domů, feeder, slávistickej mizera, noobe, skalní hulvát
All synthetic hostile-review framing; no real individuals.
`;
