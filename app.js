// app.js：渲染结果
import { bucketOf, slowerThan } from "./latency.js";
import { step, close } from "./latrun.js";

export function render(spec) {
  const events = spec.events || [];
  const half = Math.ceil(events.length / 2);
  const first = step(spec);
  const closed = close(Object.assign({}, spec, { state: first.state }));
  const r1 = step(Object.assign({}, spec, { events: events.slice(0, half) }));
  const r2 = step(Object.assign({}, spec, { state: r1.state, events: events.slice(half) }));
  const closedTwo = close(Object.assign({}, spec, { state: r2.state }));
  const replay = step(Object.assign({}, spec, { state: closed.state }));
  const wide = step(Object.assign({}, spec, { budget: spec.budget + 2 }));
  const full = step(Object.assign({}, spec, { events: events, budget: events.length + 2 }));
  const fullClosed = close(Object.assign({}, spec, { state: full.state }));
  const fingerprint = function (state) {
    return JSON.stringify({
      buckets: state.buckets, slowest: state.slowest, names: state.names,
      ledger: state.ledger, applied: state.applied.length
    });
  };
  const bounds = spec.bounds || [];
  return { buckets: closed.state.buckets.map(function (count, index) {
             return [index < bounds.length ? "小于" + bounds[index] : "大于等于" + bounds[bounds.length - 1], count];
           }),
           slowest: closed.state.slowest.slice(),
           count: closed.state.names.length,
           served_first: first.served, served_wide: wide.served,
           pair_differs: first.served !== wide.served,
           ledger_before: first.ledger_before, ledger: first.ledger,
           catchup: closed.catchup, ledger_after: closed.state.ledger.length,
           mid_differs: fingerprint(r2.state) !== fingerprint(first.state),
           closed_equal: fingerprint(closedTwo.state) === fingerprint(closed.state),
           replay_new: replay.served, judged: first.judged, judged_bound: first.judged_bound,
           full_diff: fingerprint(closed.state) === fingerprint(fullClosed.state) ? 0 : 1,
           count_events: events.length,
           tail: bucketOf([100], 50) + (slowerThan([0, 0], 5) ? 1 : 0) };
}
