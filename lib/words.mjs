import { fold } from "./text.mjs";

/** Curated English swears (no identity slurs). Includes mild (damn/hell/crap). */
export const EN_WORDS = [
  "fuck",
  "fucks",
  "fucked",
  "fucking",
  "fucker",
  "fuckers",
  "motherfucker",
  "motherfuckers",
  "shit",
  "shits",
  "shitty",
  "shitting",
  "bullshit",
  "horseshit",
  "apeshit",
  "shithead",
  "dipshit",
  "piss",
  "pissed",
  "pisser",
  "asshole",
  "assholes",
  "ass",
  "asses",
  "asswipe",
  "dumbass",
  "jackass",
  "bitch",
  "bitches",
  "bitchy",
  "damn",
  "damned",
  "dammit",
  "hell",
  "cock",
  "cocks",
  "cocksucker",
  "dick",
  "dicks",
  "dickhead",
  "pussy",
  "pussies",
  "cunt",
  "cunts",
  "bastard",
  "bastards",
  "slut",
  "sluts",
  "whore",
  "whores",
  "crap",
  "crappy",
  "twat",
  "wanker",
  "bollocks",
  "bugger",
  "bloody",
  // v2 expansions (true swears / strong invective)
  "fuckwit",
  "fuckface",
  "shitface",
  "shitbag",
  "pisshead",
  "arsehole",
  "arse",
  "tosser",
  "prick",
  "pricks",
  "minge",
  "knobhead",
  "bellend",
];

/**
 * Common Czech vulgarities + frequent inflections (folded forms also stored).
 * V2b: classic swears stay; train-derived rude-insult singles may be added
 * via TRAIN_RUDE_WORDS import below. Do NOT add test-only phrases
 * (stará bába, stará kráva, old hag, Moronic, …).
 */
export const CS_WORDS = [
  "kurva",
  "kurvy",
  "kurvu",
  "kurvo",
  "kurvou",
  "kurvin",
  "kurvinsky",
  "kurviny",
  "kurevsky",
  "kurevska",
  "kurevske",
  "zkurveny",
  "zkurvena",
  "zkurvene",
  "zkurvenej",
  "zkurvenych",
  "zkurvenec",
  "pica",
  "picu",
  "pici",
  "picovina",
  "picoviny",
  "picus",
  "prdel",
  "prdele",
  "prdeli",
  "kokot",
  "kokote",
  "kokoti",
  "kokota",
  "kokotina",
  "kokotiny",
  "kokotin",
  "kunda",
  "kundu",
  "kundy",
  "curak",
  "curaka",
  "curaci",
  "curaky",
  "zmrd",
  "zmrde",
  "zmrdi",
  "hovno",
  "hovna",
  "hovny",
  "hovnem",
  "sracka",
  "sracky",
  "jebat",
  "jebnu",
  "jebnuty",
  "jebany",
  "jebana",
  "zasrany",
  "zasrana",
  "zasranej",
  "zasrane",
  "posrany",
  "posrana",
  "seru",
  "sere",
  "serou",
  "nasrat",
  "vysrat",
  "posrat",
  "debil",
  "debile",
  "debilove",
  "kreten",
  "kretene",
  "blbec",
  "blbce",
  "blbci",
  "kurvak",
  "svinstvo",
  "chuj",
  "chuje",
  "do prdele",
  "sakra",
  "kruci",
  // v2 expansions
  "kurvit",
  "okurvit",
  "zkurvit",
  "zkurvena",
  "picusek",
  "hajzl",
  "hajzle",
  "hajzli",
  "srat",
  "srackovej",
  "mrdka",
  "mrdky",
  "mrdat",
  "zmrdina",
];

/**
 * Optional multiword swear phrases (truly swear phrases only).
 * Matched as contiguous folded token sequences by lexicon/token_scorer.
 */
export const MULTIWORD_SWEARS = [
  "do prdele",
  "what the fuck",
  "son of a bitch",
  "piece of shit",
];

/** Train/dev-derived rude multiword digs (v2b). No test-only strings. */
export const TRAIN_RUDE_MULTIWORD = [
  "blba holka",
  "blbá holka",
  "stary dedek",
  "starý dědek",
  "stara pani",
  "stará paní",
  "stary pan",
  "starý pán",
  "ta zenska",
  "ta ženská",
  "ten chlap",
  "trapny typ",
  "trapný typ",
  "neochotny clovek",
  "neochotný člověk",
  "pomalej kluk",
  "k nicemu",
  "k ničemu",
  "useless cleaner",
  "old lady",
  "silly manager",
  "clown of a driver",
  "incompetent clerk",
  "liny brigadnik",
  "líný brigádník",
  "useless pristup",
  "useless přístup",
  "dumb decision",
  "nasty attitude",
  "incompetent staff",
  "lazy intern",
];

/** Train/dev-derived single rude digs (v2b). No test-only strings. */
export const TRAIN_RUDE_WORDS = [
  "hlupak",
  "hlupák",
  "linoch",
  "líňoch",
  "pitomy",
  "pitomý",
  "trapny",
  "trapný",
  "liny",
  "líný",
  "useless",
  "dumb",
  "silly",
  "pathetic",
  "worthless",
  "nasty",
  "foolish",
  "incompetent",
  "lazy",
  "fool",
  "clown",
];

/**
 * V3 train/dev-derived short insult codes (NOT test-only ky$/kmn surfaces).
 * Safe for lexicon/token_scorer. Bare numeric hate codes (14/88) intentionally
 * omitted — context-only (Jev); traps like "sleva 14%" must stay clean.
 */
export const TRAIN_SHORT_CODES = [
  "kys",
  "kms",
  "tvl",
  "twl",
];

/**
 * V3 train/dev algospeak / euphemism surfaces (hostile-use positives).
 * Test-only Czech mirrors (neživý, sebe-odinstalování, kukuřice) omitted.
 * Do NOT add bare "corn"/"grape"/"SA"/"14"/"88" (high clean FP risk).
 */
export const TRAIN_ALGOSPEAK = [
  "unalive",
  "seggs",
];

export const TRAIN_ALGOSPEAK_MULTIWORD = [
  "sewer slide",
  "le dollar bean",
  "dollar bean",
];

/** Train subculture flame tokens (synthetic). Test-only (šoupák, …) omitted. */
export const TRAIN_SUBCULTURE = [
  "ultrasaku",
  "ultrásáku",
  "pako",
  "chuligan",
  "chuligán",
  "banikarsky",
  "baníkářský",
];

/** Semantic-weapon train cue phrases (multiword). Test-only templates omitted. */
export const TRAIN_SEMANTIC_MULTIWORD = [
  "uzitecna jako dira v bote",
  "užitečná jako díra v botě",
  "sikovny na svuj vek",
  "šikovný na svůj věk",
  "delightfully inept",
  "skvely pokud nemate oci",
  "skvělý pokud nemáte oči",
  "mila jako danova kontrola",
  "milá jako daňová kontrola",
];


/** Multi-char / safe inflectional suffixes only (never single letters — avoids hello→hell). */
const SUFFIXES = [
  "ing",
  "ers",
  "er",
  "ed",
  "ies",
  "es",
  "ty",
  "ove",
  "ovi",
  "ama",
  "ach",
  "ech",
  "ich",
  "em",
  "ou",
  "ej",
  "ny",
  "na",
  "ne",
  "ky",
  "ek",
  "ik",
  "y",
  "i",
  "u",
  "a",
];

/**
 * Stems used for glued prefix/suffix detection (mask only the swear morpheme).
 * Longer stems preferred; must be true swear cores.
 */
export const GLUE_STEMS = [
  "motherfucker",
  "bullshit",
  "horseshit",
  "shithead",
  "dickhead",
  "asshole",
  "fuckwit",
  "fuckface",
  "pičovina",
  "picovina",
  "kokotina",
  "zkurveny",
  "zkurvena",
  "zkurvene",
  "zkurvenej",
  "zasrany",
  "zasrana",
  "zasranej",
  "kurva",
  "kokot",
  "píča",
  "pica",
  "prdel",
  "čurák",
  "curak",
  "hovno",
  "zmrd",
  "kunda",
  "sračka",
  "sracka",
  "hajzl",
  "debil",
  "kretén",
  "kreten",
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "dick",
  "piss",
  "crap",
  "whore",
  "slut",
]
  .map((s) => fold(s))
  .filter((s) => s.length >= 4)
  .sort((a, b) => b.length - a.length);

function buildSet(words) {
  const set = new Set();
  for (const w of words) {
    const f = fold(w.trim());
    if (f) set.add(f);
  }
  return set;
}

export const LEXICON_SET = buildSet([
  ...EN_WORDS,
  ...CS_WORDS,
  ...TRAIN_RUDE_WORDS,
  ...TRAIN_SHORT_CODES,
  ...TRAIN_ALGOSPEAK,
  ...TRAIN_SUBCULTURE,
]);

/** Multiword phrases for lexicon/token_scorer (swears + train rude). */
export const MULTIWORD_ALL = [
  ...MULTIWORD_SWEARS,
  ...TRAIN_RUDE_MULTIWORD,
  ...TRAIN_ALGOSPEAK_MULTIWORD,
  ...TRAIN_SEMANTIC_MULTIWORD,
];

/** Longest-first suffixes for token_scorer stem match (not used by exact lexicon). */
export const STEM_SUFFIXES = [...SUFFIXES].sort((a, b) => b.length - a.length);

export function inLexiconExact(norm) {
  return LEXICON_SET.has(norm);
}

/**
 * Method-3 only: exact OR known-inflection stem (remaining stem length >= 4
 * and the stem itself is in the lexicon). Never substring / contains().
 */
export function inLexiconStem(norm) {
  if (!norm) return false;
  if (LEXICON_SET.has(norm)) return true;
  for (const suf of STEM_SUFFIXES) {
    if (suf.length >= 2 && norm.length - suf.length >= 4 && norm.endsWith(suf)) {
      const stem = norm.slice(0, -suf.length);
      if (LEXICON_SET.has(stem)) return true;
    }
  }
  return false;
}

/**
 * Find longest glue stem as suffix or prefix of a folded token.
 * Returns { kind:'suffix'|'prefix', stem, stemStart, stemEnd } in *folded letter* coords
 * relative to the folded core, or null.
 */
export function findGluedStem(foldedCore) {
  if (!foldedCore || foldedCore.length < 5) return null;
  for (const stem of GLUE_STEMS) {
    if (foldedCore.length <= stem.length) continue;
    if (foldedCore.endsWith(stem)) {
      // require a non-empty non-stem prefix with ≥2 letters (e.g. world+curak)
      const pref = foldedCore.slice(0, -stem.length);
      if (pref.length >= 2 && !LEXICON_SET.has(pref)) {
        return {
          kind: "suffix",
          stem,
          stemStart: pref.length,
          stemEnd: foldedCore.length,
        };
      }
    }
    if (foldedCore.startsWith(stem)) {
      const suf = foldedCore.slice(stem.length);
      if (suf.length >= 2 && !LEXICON_SET.has(suf)) {
        return {
          kind: "prefix",
          stem,
          stemStart: 0,
          stemEnd: stem.length,
        };
      }
    }
  }
  return null;
}

export const STOPWORDS = new Set(
  [
    // EN
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "to",
    "of",
    "and",
    "or",
    "in",
    "on",
    "for",
    "with",
    "at",
    "by",
    "from",
    "this",
    "that",
    "it",
    "its",
    "as",
    "but",
    "not",
    "you",
    "your",
    "we",
    "they",
    "he",
    "she",
    "i",
    "me",
    "my",
    "our",
    "their",
    "have",
    "has",
    "had",
    "do",
    "did",
    "will",
    "would",
    "can",
    "just",
    "so",
    "if",
    "about",
    "what",
    "when",
    "who",
    "how",
    "which",
    "there",
    "here",
    "very",
    "really",
    "please",
    "thanks",
    "thank",
    "hello",
    "ok",
    "okay",
    "yes",
    "no",
    "good",
    "great",
    "nice",
    "well",
    "one",
    "all",
    "also",
    "too",
    "than",
    "then",
    "out",
    "up",
    "down",
    "over",
    "after",
    "before",
    "into",
    "more",
    "some",
    "any",
    "been",
    // CS function words
    "a",
    "i",
    "v",
    "ve",
    "na",
    "je",
    "jsem",
    "jsi",
    "jsme",
    "jste",
    "jsou",
    "se",
    "si",
    "to",
    "ta",
    "ten",
    "tu",
    "ty",
    "s",
    "z",
    "ze",
    "do",
    "od",
    "za",
    "po",
    "pro",
    "pri",
    "o",
    "u",
    "k",
    "ke",
    "ale",
    "nebo",
    "jak",
    "co",
    "kdyz",
    "protoze",
    "tak",
    "uz",
    "az",
    "jen",
    "jeste",
    "by",
    "bych",
    "bys",
    "bychom",
    "byste",
    "mne",
    "me",
    "mi",
    "mu",
    "ho",
    "ji",
    "jej",
    "nam",
    "vas",
    "jim",
    "tady",
    "tam",
    "dnes",
    "moc",
    "velmi",
    "fakt",
    "proste",
    "dekuji",
    "diky",
    "prosim",
    "ano",
    "ne",
    "jo",
    "no",
    "bylo",
    "byla",
    "byly",
    "byl",
    "byli",
    "ma",
    "mam",
    "mas",
    "maji",
    "jako",
    "nez",
    "pak",
    "ted",
    "tenhle",
    "tahle",
    "tohle",
    "bez",
    "mezi",
    "pred",
    "pres",
    "pod",
    "nad",
    "stara",
    "stary",
    "baba",
    "hlupak",
    "cleaner",
    "useless",
  ].map(fold),
);
