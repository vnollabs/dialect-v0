/**
 * Reference search over api/v1/index.json. No dependencies: consumers (the dialect.vnol.net site, the MCP
 * server) can copy this file as is. Ranking, best first:
 *   exact spelling > tone-free or Telex match > prefix > standard word (đắt -> mắc) > gloss words
 */
export type SearchRecord = {
  id: string;
  word: string;
  keys: string[];
  standard: string[];
  gloss?: string;
  gloss_en?: string;
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

export function search<T extends SearchRecord>(index: T[], query: string, limit = 20): T[] {
  const exact = query.normalize("NFC").trim().toLowerCase();
  const q = fold(query);
  if (!q) return [];
  const score = (r: T): number => {
    if (r.word.toLowerCase() === exact) return 100;
    if (r.keys.includes(q) || r.id === exact) return 80;
    if (r.keys.some((k) => k.startsWith(q))) return 60;
    if (r.standard.some((s) => s.toLowerCase() === exact)) return 50;
    if (r.standard.some((s) => fold(s) === q)) return 45;
    // Gloss words only for longer queries, or "an" would match half the dictionary.
    if (q.length >= 3 && new RegExp(`(^| )${q}( |$)`).test(fold(`${r.gloss ?? ""} ${r.gloss_en ?? ""}`))) return 20;
    return 0;
  };
  return index
    .map((r) => ({ r, s: score(r) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.r.word.localeCompare(b.r.word, "vi"))
    .slice(0, limit)
    .map((x) => x.r);
}
