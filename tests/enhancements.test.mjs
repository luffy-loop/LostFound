import test from "node:test";
import assert from "node:assert/strict";
import { archiveStaleItems, scoreMatch } from "../js/enhancements.js";

test("archives unresolved reports older than 90 days", () => {
  const now = Date.parse("2026-10-14T00:00:00Z");
  const items = [
    { id: 1, status: "Searching", createdAt: "2026-07-01T00:00:00Z" },
    { id: 2, status: "Returned", createdAt: "2026-01-01T00:00:00Z" },
    { id: 3, status: "Searching", createdAt: "2026-10-01T00:00:00Z" }
  ];
  const result = archiveStaleItems(items, { now, days: 90 });
  assert.equal(result[0].archived, true);
  assert.equal(result[1].archived, undefined);
  assert.equal(result[2].archived, undefined);
});
test("keeps already archived records unchanged", () => {
  const item = { archived: true, archivedAt: "2026-01-01T00:00:00Z" };
  assert.equal(archiveStaleItems([item])[0], item);
});
test("ranks likely matches using category, location, description, and date", () => {
  const lost = { type:"Lost", itemName:"Black water bottle", description:"Steel bottle", category:"Accessories", location:"Library", occurredAt:"2026-10-10" };
  const likely = { type:"Found", itemName:"Black bottle", description:"Steel water bottle", category:"Accessories", location:"Library", occurredAt:"2026-10-10" };
  const unlikely = { ...likely, location:"Canteen", itemName:"Blue notebook", category:"Books", occurredAt:"2026-08-01" };
  assert.ok(scoreMatch(lost, likely) > scoreMatch(lost, unlikely));
});
test("does not match reports with the same type", () => {
  assert.equal(scoreMatch({ type:"Lost" }, { type:"Lost" }), 0);
});
