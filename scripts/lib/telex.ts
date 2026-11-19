/**
 * File names for entries: the spelling typed in Telex, ASCII only.
 *
 *   biểu    -> bieeur        lẩu mắm -> laaur-mawms
 *   đâu có  -> ddaau-cos     gác-măng-rê -> gacs-mawng-ree
 *
 * Telex keeps words that differ only by tone or vowel mark (lâu, lầu, lẩu, lậu) apart, and
 * ASCII names avoid the NFC/NFD file-name differences between macOS and Linux. The tone key goes
 * at the end of each syllable, which makes the result canonical.
 *
 * Two rules keep the name one-to-one with the letters of the spelling, so two different words
 * never share a file:
 *   - A letter that Telex would read as a mark on the unmarked letter before it (a, e, o, d after
 *     itself; w after a, o, u) is written after "_": xoong -> xo_ong, because xông is xoong.
 *   - A syllable without a tone that ends in a tone key (s, f, r, x, j) or z gets Telex's
 *     "no tone" key z: bas -> basz, because bá is bas.
 * Case and punctuation are not kept: "Nhựt" and "nhựt", "… coi" and "coi" share a file, and the
 * entry tells them apart with `head`.
 */

const TONES: Record<string, string> = {
  "́": "s", // sắc
  "̀": "f", // huyền
  "̉": "r", // hỏi
  "̃": "x", // ngã
  "̣": "j", // nặng
};
const TONE_KEYS = /[sfrxjz]$/;
const CIRCUMFLEX = "̂";
const BREVE = "̆";
const HORN = "̛";

/** The key Telex types after `letter` for `mark`, or undefined when Vietnamese has no such letter. */
function markKey(letter: string, mark: string): string | undefined {
  if (mark === CIRCUMFLEX && "aeo".includes(letter)) return letter;
  if (mark === BREVE && letter === "a") return "w";
  if (mark === HORN && "ou".includes(letter)) return "w";
  return undefined;
}

/** Whether Telex would read `key` typed right after the unmarked `letter` as a mark on it. */
const isMarkKey = (letter: string, key: string) =>
  key === letter ? "aeod".includes(letter) : key === "w" && "aou".includes(letter);

function syllable(word: string): string {
  let out = "";
  let tone = "";
  let bare = ""; // the previous letter if it was written without a mark, else ""
  const chars = [...word.normalize("NFD")];
  for (let i = 0; i < chars.length; i++) {
    let letter = chars[i];
    let key = "";
    if (letter === "đ") [letter, key] = ["d", "d"];
    while (i + 1 < chars.length && /\p{M}/u.test(chars[i + 1])) {
      const m = chars[++i];
      if (m in TONES) {
        if (tone) throw new Error(`two tone marks in "${word}"`);
        tone = TONES[m];
        continue;
      }
      const k = markKey(letter, m);
      if (!k || key) throw new Error(`unexpected mark U+${m.codePointAt(0)!.toString(16)} on "${letter}" in "${word}"`);
      key = k;
    }
    if (bare && isMarkKey(bare, letter)) out += "_";
    out += letter + key;
    bare = key ? "" : letter;
  }
  if (tone) return out + tone;
  return TONE_KEYS.test(out) ? out + "z" : out;
}

export function slug(spelling: string): string {
  const parts = spelling
    .normalize("NFC")
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean)
    .map(syllable);
  const result = parts.join("-");
  if (!/^[a-z0-9_]+(-[a-z0-9_]+)*$/.test(result)) {
    throw new Error(`cannot make an ASCII file name for "${spelling}" (got "${result}")`);
  }
  return result;
}

/** Path of the entry file relative to data/entries. */
export function entryRelPath(spelling: string): string {
  const s = slug(spelling);
  return `${s[0]}/${s}.yaml`;
}
