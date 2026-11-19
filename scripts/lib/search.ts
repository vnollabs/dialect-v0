/**
 * Reference search over api/v1/index.json. No dependencies: consumers (the dialect.vnol.net site, the MCP
 * server) can copy this file as is. Ranking, best first:
 *   100  exact spelling or form, alternative forms included (quíu -> quýu)
 *    90  exact standard word, in reverse (bố -> ba, đắt -> mắc)
 *    80  the same letters without marks (mac -> mắc, mác, mặc), or Telex (mawcs, mawsc, mawcs coong)
 *    60  prefix of a form, for autocomplete
 *    45  a standard word without marks (dat -> mắc)
 *    20  every query word is a word of some gloss, for queries of 3+ letters (pineapple -> thơm).
 *        A query word typed with marks must match them (đắt doesn't find đất); one typed without matches any.
 */
export type SearchRecord = {
  id: string;
  word: string;
  forms: string[];
  keys: string[];
  standard: string[];
  gloss_words: string[];
};

/** Lowercase, no tone or vowel marks, đ -> d, punctuation -> space. Same as the index's `keys`. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const lower = (text: string) => text.normalize("NFC").toLowerCase();

/** Lowercase NFC words, marks kept. Same as the index's `gloss_words`. */
export function words(text: string): string[] {
  return lower(text).split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/; // as in the ids: con -> con_

/**
 * The entry ids a query typed in Telex without a Vietnamese keyboard may mean: as typed, syllables joined
 * with "-" (mawcs coong -> mawcs-coong), and with each tone key moved to the end (mawsc -> mawcs).
 * Telex keyboards accept the tone key (s f r x j) anywhere after the first vowel; ids put it last. Only
 * initial consonants (s, r, x, tr) use those letters, so any of them after the first vowel is a tone key.
 */
function telexIds(query: string): Set<string> {
  const syllables = query.toLowerCase().split(/[\s-]+/).filter(Boolean);
  if (!syllables.length || !syllables.every((s) => /^[a-z0-9_]+$/.test(s))) return new Set();
  const toneLast = syllables.map((s) => {
    const m = /^([^aeiouy]*[aeiouy])(.*)$/.exec(s);
    return m ? m[1] + m[2].replace(/[sfrxj]/g, "") + m[2].replace(/[^sfrxj]/g, "") : s;
  });
  const ids = new Set([syllables.join("-"), toneLast.join("-")]);
  for (const id of [...ids]) if (WINDOWS_RESERVED.test(id)) ids.add(`${id}_`);
  return ids;
}

// Per-record lookups, computed once per record rather than on every keystroke.
type Prepared = { forms: Set<string>; standard: Set<string>; standardFolded: Set<string>; gloss: Set<string>; glossFolded: Set<string> };
const prepared = new WeakMap<SearchRecord, Prepared>();
function prepare(r: SearchRecord): Prepared {
  let p = prepared.get(r);
  if (!p) {
    p = {
      forms: new Set([r.word, ...r.forms].map(lower)),
      standard: new Set(r.standard.map(lower)),
      standardFolded: new Set(r.standard.map(fold)),
      gloss: new Set(r.gloss_words),
      glossFolded: new Set(r.gloss_words.map(fold)),
    };
    prepared.set(r, p);
  }
  return p;
}

export function search<T extends SearchRecord>(index: T[], query: string, limit = 20): T[] {
  const exact = lower(query).trim();
  const q = fold(query);
  if (!q) return [];
  const ids = telexIds(query);
  // Gloss words only for longer queries, or "an" would match half the dictionary.
  const glossQuery =
    q.length >= 3 ? words(query).map((w) => ({ w, folded: fold(w), marked: fold(w) !== w })) : [];
  const score = (r: T): number => {
    const p = prepare(r);
    if (p.forms.has(exact)) return 100;
    if (p.standard.has(exact)) return 90;
    if (r.keys.includes(q) || ids.has(r.id)) return 80;
    if (r.keys.some((k) => k.startsWith(q))) return 60;
    if (p.standardFolded.has(q)) return 45;
    if (glossQuery.length && glossQuery.every(({ w, folded, marked }) => (marked ? p.gloss.has(w) : p.glossFolded.has(folded))))
      return 20;
    return 0;
  };
  return index
    .map((r) => ({ r, s: score(r) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.r.word.localeCompare(b.r.word, "vi"))
    .slice(0, limit)
    .map((x) => x.r);
}
