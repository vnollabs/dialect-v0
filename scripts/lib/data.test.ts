import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { appendInEntryFile, hasComments, parseYaml, status, toYaml, type Sense, type Source } from "./data.ts";

const sense = (...sources: string[]): Sense => ({ gloss: { vi: "x" }, region: ["south"], sources });

test("status: copies count as their original, provenance-only sources never count", () => {
  const registry: Record<string, Source> = {
    a: { name: "A", kind: "dictionary" },
    b: { name: "B", kind: "dictionary" },
    copy: { name: "Copy of A", kind: "website", same_as: "a" },
    old: { name: "Old scrape", kind: "provenance", counts: false, same_as: "a" },
    prov: { name: "Provenance", kind: "provenance", counts: false },
  };
  assert.equal(status(sense("a", "b"), registry), "verified");
  assert.equal(status(sense("a", "copy"), registry), "pending");
  assert.equal(status(sense("copy", "b"), registry), "verified");
  assert.equal(status(sense("old", "b"), registry), "pending");
  assert.equal(status(sense("old"), registry), "unsourced");
  assert.equal(status(sense("prov", "a"), registry), "pending");
});

test("toYaml quotes strings a YAML 1.1 reader would not read back as strings", () => {
  const tricky = ["no", "On", "~", "1:20", "1_000", "0b11", "0x1f", "017", "1.5", ".5", "1e3", ".inf", "2024-01-01", "<<", "="];
  const plain = ["coi", "1 chút", "a:b", "x-1"];
  const text = toYaml({ a: [...tricky, ...plain] });
  for (const s of tricky) assert.ok(text.includes(`"${s}"`), `${s} not quoted in ${text}`);
  for (const s of plain) assert.ok(!text.includes(`"${s}"`), `${s} quoted needlessly in ${text}`);
  assert.deepEqual(parseYaml(text, "test"), { a: [...tricky, ...plain] });
});

test("hasComments finds comments but not # inside text", () => {
  assert.ok(hasComments("a: 1 # note\n"));
  assert.ok(hasComments("# top\na: 1\n"));
  assert.ok(!hasComments('a: "x # y"\nb: c#d\n'));
});

test("appendInEntryFile keeps comments and the rest of the file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dialect-"));
  const file = path.join(dir, "x.yaml");
  const before = [
    "spelling: x",
    "etymologies:",
    "  - pos:",
    "      - senses:",
    "          # hỏi lại người Cần Thơ",
    "          - gloss:",
    "              vi: Một",
    "            region: [south]",
    "",
  ].join("\n");
  fs.writeFileSync(file, before);
  appendInEntryFile(file, ["etymologies", 0, "pos", 0, "senses"], { gloss: { vi: "Hai" }, region: ["south", "mekong-delta"] });
  const after = fs.readFileSync(file, "utf8");
  fs.rmSync(dir, { recursive: true });
  assert.ok(after.startsWith(before), after);
  assert.ok(after.endsWith("          - gloss:\n              vi: Hai\n            region: [south, mekong-delta]\n"), after);
});
