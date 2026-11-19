/**
 * File names for entries: the spelling typed in Telex, ASCII only.
 *
 *   biểu    -> bieeur        lẩu mắm -> laaur-mawms
 *   đâu có  -> ddaau-cos     gác-măng-rê -> gacs-mawng-ree
 *
 * Telex is lossless for Vietnamese letters, so words that differ only by tone or
 * vowel mark (lâu, lầu, lẩu, lậu) get different files, and ASCII names avoid the
 * NFC/NFD file-name differences between macOS and Linux. The tone key goes at the
 * end of each syllable, which makes the result canonical.
 */

const TONES: Record<string, string> = {
  "́": "s", // sắc
  "̀": "f", // huyền
  "̉": "r", // hỏi
  "̃": "x", // ngã
  "̣": "j", // nặng
};
const CIRCUMFLEX = "̂";
const BREVE = "̆";
const HORN = "̛";

function syllable(word: string): string {
  let out = "";
  let tone = "";
  const chars = [...word.normalize("NFD")];
  for (let i = 0; i < chars.length; i++) {
    const base = chars[i];
    if (base === "đ") {
      out += "dd";
      continue;
    }
    let marks = "";
    while (i + 1 < chars.length && /\p{M}/u.test(chars[i + 1])) marks += chars[++i];
    let letter = base;
    for (const m of marks) {
      if (m in TONES) {
        if (tone) throw new Error(`two tone marks in "${word}"`);
        tone = TONES[m];
      } else if (m === CIRCUMFLEX) letter += base;
      else if (m === BREVE || m === HORN) letter += "w";
      else throw new Error(`unexpected mark U+${m.codePointAt(0)!.toString(16)} in "${word}"`);
    }
    out += letter;
  }
  return out + tone;
}

export function slug(spelling: string): string {
  const parts = spelling
    .normalize("NFC")
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean)
    .map(syllable);
  const result = parts.join("-");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(result)) {
    throw new Error(`cannot make an ASCII file name for "${spelling}" (got "${result}")`);
  }
  return result;
}

/** Path of the entry file relative to data/entries. */
export function entryRelPath(spelling: string): string {
  const s = slug(spelling);
  return `${s[0]}/${s}.yaml`;
}
