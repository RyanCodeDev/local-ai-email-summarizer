import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEmailResult, resultMarkdown } from "../src/lib/results.ts";

const result = {
  summary: "The project is ready. Review is needed by Friday.",
  action_items: ["Alex: Review by Friday."],
  replies: [
    { title: "Confirm", body: "Hi Jamie,\n\nThanks for the update.\n\nAlex" },
    { title: "Clarify", body: "Hi Jamie,\n\nCould you confirm the deadline?" },
  ],
};
test("parses separate sections while preserving reply paragraphs exactly", () => {
  assert.deepEqual(parseEmailResult(JSON.stringify(result)), result);
});
test("accepts an empty action list and fenced compatibility JSON", () => {
  const noActions = { ...result, action_items: [] };
  assert.deepEqual(
    parseEmailResult("```json\n" + JSON.stringify(noActions) + "\n```"),
    noActions,
  );
  assert.match(resultMarkdown(noActions), /No action items identified/);
});
test("rejects malformed JSON and incorrect response shapes without leaking contents", () => {
  for (const invalid of [
    "PRIVATE_EMAIL",
    "null",
    "[]",
    JSON.stringify({ summary: "PRIVATE_EMAIL" }),
  ]) {
    assert.throws(
      () => parseEmailResult(invalid),
      (error) => !error.message.includes("PRIVATE_EMAIL"),
    );
  }
});
test("rejects missing, empty, wrongly typed, extra, or incomplete fields", () => {
  for (const invalid of [
    { ...result, summary: " " },
    { ...result, summary: 3 },
    { ...result, action_items: "none" },
    { ...result, action_items: [null] },
    { ...result, action_items: [" "] },
    { ...result, replies: [] },
    { ...result, replies: [result.replies[0]] },
    { ...result, replies: [{ title: "x", body: " " }, result.replies[1]] },
    { ...result, replies: [{ title: "x", body: 7 }, result.replies[1]] },
    { ...result, replies: [null, result.replies[1]] },
    {
      ...result,
      replies: [{ ...result.replies[0], extra: true }, result.replies[1]],
    },
    { ...result, extra: true },
  ])
    assert.throws(
      () => parseEmailResult(JSON.stringify(invalid)),
      /invalid result structure/,
    );
});
test("exports all structured sections as Markdown without UI copy instructions", () => {
  const markdown = resultMarkdown(result);
  assert.match(markdown, /## Summary/);
  assert.match(markdown, /- Alex: Review by Friday/);
  assert.match(markdown, /### Confirm\n\nHi Jamie,\n\nThanks/);
  assert.match(markdown, /### Clarify/);
  assert.ok(!markdown.includes("Copy reply"));
});
