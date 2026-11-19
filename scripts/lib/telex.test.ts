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
