import assert from "node:assert/strict";
import { test } from "node:test";
import type { Entry, Loaded, Topic } from "./data.ts";
import { renderSkillDictionary, skillLines } from "./skill.ts";

const topics: Record<string, Topic> = {
  household: { name: "Đồ trong nhà" },
  "north-south": { name: "Đối chiếu Bắc → Nam" },
  "ns-food": { name: "Ăn uống", parent: "north-south" },
};

const entry = (spelling: string, sense: Partial<Entry["etymologies"][0]["pos"][0]["senses"][0]>): Loaded => ({
  file: `${spelling}.yaml`,
  entry: {
    spelling,
    etymologies: [{ pos: [{ senses: [{ gloss: { vi: "Chăn" }, region: ["south"], topics: ["household"], ...sense }] }] }],
  },
});

test("synonyms that reduce to the same alias are one line, not a duplicate", () => {
  const { lines, problems } = skillLines(
    [entry("mền", { synonyms: ["cái mền"] }), entry("cái mền", { synonyms: ["mền"] })],
    topics,
  );
  assert.deepEqual(problems, []);
  assert.equal(lines.length, 1);
});

test("a line break in a word, gloss or qualifier is a problem, not a broken file", () => {
  for (const sense of [
    { gloss: { vi: "Dòng một\nDòng hai" } },
    { gloss: { vi: "Dòng một\u2028Dòng hai" } },
    { qualifier: "a\u0085b" },
  ]) {
    const { lines, problems } = skillLines([entry("xyz", sense)], topics);
    assert.equal(lines.length, 0);
    assert.equal(problems.length, 1, JSON.stringify(sense));
  }
  const { problems } = skillLines([entry("xyz\u2029abc", {})], topics);
  assert.equal(problems.length, 1);
});

test("a parent topic whose subtopics have no lines is left out", () => {
  const { lines } = skillLines([entry("mền", {})], topics);
  const text = renderSkillDictionary(lines, topics);
  assert.ok(text.includes("Đồ trong nhà:\n  Mền: Chăn\n"), text);
  assert.ok(!text.includes("Đối chiếu"), text);
});

test("senses of one word in different topics share a line, under the first topic", () => {
  const mac: Loaded = {
    file: "mawcs.yaml",
    entry: {
      spelling: "mắc",
      etymologies: [
        { pos: [{ senses: [{ gloss: { vi: "Đắt" }, region: ["south"], topics: ["ns-food"] }] }] },
        { pos: [{ senses: [{ gloss: { vi: "Buồn (đi tiểu)" }, region: ["south"], topics: ["household"] }] }] },
      ],
    },
  };
  const { lines, problems } = skillLines([mac], topics);
  assert.deepEqual(problems, []);
  assert.deepEqual(lines.map((l) => [l.topic, l.key, l.value]), [["ns-food", "Mắc", "Đắt; Buồn (đi tiểu)"]]);
});

test("a clash the lines can't merge names both lines", () => {
  const { problems } = skillLines([entry("mắc", { qualifier: "cũ" }), entry("mắc", { gloss: { vi: "Đắt" } })], topics);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /"Mắc \(cũ\)" \(household\).*"Mắc" \(household\)/);
});
