import assert from "assert";
import { test } from "node:test";
import { cosineSimilarity, rouge1, bleuScore } from "./utils.ts";

test("cosineSimilarity returns 0 for orthogonal vectors", () => {
  const a = [1, 0, 0];
  const b = [0, 1, 0];
  assert.strictEqual(cosineSimilarity(a, b), 0);
});

test("cosineSimilarity returns 1 for identical vectors", () => {
  const a = [1, 2, 3];
  const b = [1, 2, 3];
  assert.ok(Math.abs(cosineSimilarity(a, b) - 1) < 1e-6);
});

test("rouge1 computes recall/precision harmonics", () => {
  const score = rouge1("hello world", "hello");
  assert.ok(score > 0);
});

test("bleuScore placeholder returns 0", () => {
  assert.strictEqual(bleuScore("foo", "bar"), 0);
});
