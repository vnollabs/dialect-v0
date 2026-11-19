import assert from "node:assert/strict";
import { test } from "node:test";
import { entryRelPath, slug } from "./telex.ts";

test("encodes vowel marks and tones", () => {
  assert.equal(slug("biểu"), "bieeur");
  assert.equal(slug("mắc"), "mawcs");
  assert.equal(slug("lẩu mắm"), "laaur-mawms");
  assert.equal(slug("cười"), "cuwowif");
  assert.equal(slug("đâu có"), "ddaau-cos");
  assert.equal(slug("ệ"), "eej");
});

test("words that differ only by marks get different names", () => {
  const names = ["lâu", "lầu", "lẩu", "lậu", "lau", "làu"].map(slug);
  assert.equal(new Set(names).size, names.length);
});

test("NFC and NFD spellings give the same name", () => {
  assert.equal(slug("biểu".normalize("NFD")), slug("biểu".normalize("NFC")));
});

test("punctuation, hyphens and case collapse to one separator", () => {
  assert.equal(slug("Gác-măng-rê"), "gacs-mawng-ree");
  assert.equal(slug("… coi"), "coi");
  assert.equal(slug("có… đâu"), "cos-ddaau");
});

test("entry path is sharded by first letter", () => {
  assert.equal(entryRelPath("đâu có"), "d/ddaau-cos.yaml");
});

test("rejects scripts that Telex cannot represent", () => {
  assert.throws(() => slug("巴黎"));
});

test("a literal double vowel or a final tone-key letter doesn't collide with a mark", () => {
  for (const [a, b] of [
    ["xoong", "xông"], ["boong", "bông"], ["moóc", "mốc"], ["soóc", "sốc"], ["goòng", "gồng"],
    ["bas", "bá"], ["jazz", "jaz"], ["show", "shơ"], ["oô", "ôo"], ["dđ", "đd"],
  ])
    assert.notEqual(slug(a), slug(b), `${a} vs ${b}`);
  assert.equal(slug("xoong"), "xo_ong");
  assert.equal(slug("soóc"), "so_ocs");
  assert.equal(slug("bas"), "basz");
});

test("rejects marks Vietnamese doesn't put on that letter", () => {
  assert.throws(() => slug("ŝ")); // circumflex on s would read as "ss"
  assert.throws(() => slug("ü"));
});

// Reads a name back to each syllable's letters and tone. If every name reads back to the
// spelling it came from, no two different spellings can share a file.
const TONE_KEY: Record<string, string> = { s: "́", f: "̀", r: "̉", x: "̃", j: "̣", z: "" };
const MARKED: Record<string, string> = { aa: "â", ee: "ê", oo: "ô", dd: "đ", aw: "ă", ow: "ơ", uw: "ư" };
const TONE_MARKS = /[̣̀́̃̉]/g;

function decode(name: string): string[] {
  // A trailing "_" only marks a name Windows reserves (con_, aux_), so it comes off first.
  return name.replace(/_$/, "").split("-").map((syl) => {
    let tone = "";
    if (/[sfrxjz]$/.test(syl)) [tone, syl] = [TONE_KEY[syl.at(-1)!], syl.slice(0, -1)];
    let letters = "";
    for (let i = 0; i < syl.length; i++) {
      if (syl[i] === "_") continue;
      const pair = MARKED[syl.slice(i, i + 2)];
      letters += pair ?? syl[i];
      if (pair) i++;
    }
    return `${letters}|${tone}`;
  });
}

function lettersAndTones(spelling: string): string[] {
  return spelling
    .normalize("NFC")
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean)
    .map((syl) => {
      const nfd = syl.normalize("NFD");
      return `${nfd.replace(TONE_MARKS, "").normalize("NFC")}|${nfd.match(TONE_MARKS)?.[0] ?? ""}`;
    });
}

test("every name reads back to its spelling (no two words share a file)", () => {
  const letters = ["a", "â", "ă", "e", "ê", "o", "ô", "ơ", "u", "ư", "d", "đ", "w", "s", "f", "r", "x", "j", "z", "n"];
  const tones = ["", "́", "̀", "̉", "̃", "̣"];
  const words: string[] = [];
  for (const a of letters)
    for (const b of ["", ...letters])
      for (const c of ["", ...letters]) for (const t of tones) words.push((a + b + c + t).normalize("NFC"));
  const byName = new Map<string, string>();
  for (const w of words) {
    const name = slug(w);
    assert.deepEqual(decode(name), lettersAndTones(w), `${w} -> ${name}`);
    const prev = byName.get(name);
    if (prev !== undefined) assert.deepEqual(lettersAndTones(prev), lettersAndTones(w), `${prev} and ${w} -> ${name}`);
    byName.set(name, w);
  }
  for (const w of ["cười", "biểu", "nhựt", "thuở", "khuya", "gác-măng-rê", "lẩu mắm"])
    assert.deepEqual(decode(slug(w)), lettersAndTones(w), w);
});

test("names Windows reserves for devices get a trailing _", () => {
  assert.equal(entryRelPath("con"), "c/con_.yaml");
  assert.equal(slug("aũ"), "aux_"); // ngã is x
  assert.equal(slug("aux"), "auxz"); // the literal word is not reserved
  for (const w of ["Con", "nul", "prn", "com1", "lpt9"]) assert.ok(slug(w).endsWith("_"), w);
  for (const w of ["con nít", "côn", "còn", "cong", "com"]) assert.ok(!slug(w).endsWith("_"), w);
  for (const w of ["con", "aũ", "aux", "nul"]) assert.deepEqual(decode(slug(w)), lettersAndTones(w), w);
});
