import test from "node:test";
import assert from "node:assert/strict";
import { splitEventContent } from "../src/lib/event-content.ts";

test("empty event content renders no sections", () => {
  assert.deepEqual(splitEventContent(null), []);
  assert.deepEqual(splitEventContent("## Empty\n\n## Also empty"), []);
});
test("existing plain descriptions remain intact", () => {
  assert.deepEqual(splitEventContent("First paragraph.\n\nSecond paragraph."), [
    { title: null, body: "First paragraph.\n\nSecond paragraph." },
  ]);
});
test("optional sections preserve Czech headings and bullet content", () => {
  assert.deepEqual(
    splitEventContent("Introduction\r\n## Pro koho?\r\n- Členové\r\n## Programme\r\nAgenda"),
    [
      { title: null, body: "Introduction" },
      { title: "Pro koho?", body: "- Členové" },
      { title: "Programme", body: "Agenda" },
    ],
  );
});
test("HTML remains plain content, not parsed markup", () => {
  assert.deepEqual(splitEventContent("<script>alert(1)</script>"), [
    { title: null, body: "<script>alert(1)</script>" },
  ]);
});
