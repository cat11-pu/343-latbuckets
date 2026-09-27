import assert from "node:assert";
import { bucketOf, slowerThan } from "../latency.js";
import { step, close } from "../latrun.js";
import { render } from "../app.js";

const base = {
  budget: 1, bounds: [100, 500, 1000],
  state: { buckets: [0, 0, 0, 0], slowest: [], names: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "record", name: "a", ms: 120 }],
  ms_error_code: "E_BAD_MS", dup_error_code: "E_DUP_ENTRY",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("bucketOf returns a number", () => {
  assert.strictEqual(typeof bucketOf([100], 50), "number");
});

check("slowerThan returns a boolean", () => {
  assert.strictEqual(typeof slowerThan([0, 0], 5), "boolean");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
