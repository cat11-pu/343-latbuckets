// latrun.js：按处理预算处理并留账
import { bucketOf, slowerThan } from "./latency.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function codes(spec) {
  return {
    event: spec.event_error_code || "E_BAD_EVENT",
    ms: spec.ms_error_code || "E_BAD_MS",
    dup: spec.dup_error_code || "E_DUP_ENTRY"
  };
}

function cloneState(state) {
  const source = state || {};
  return {
    buckets: (source.buckets || []).slice(),
    slowest: (source.slowest || []).slice(),
    names: (source.names || []).slice(),
    ledger: (source.ledger || []).map(function (event) { return Object.assign({}, event); }),
    applied: (source.applied || []).slice()
  };
}

function checkShape(event, code) {
  if (!event || typeof event !== "object" || event.kind !== "record"
      || typeof event.name !== "string" || typeof event.ms !== "number") {
    fail(code, "事件结构不合法");
  }
}

function applyEvent(state, bounds, event, cs) {
  if (!Number.isInteger(event.ms) || event.ms < 0) fail(cs.ms, "毫秒不是非负整数");
  if (state.names.indexOf(event.name) !== -1) fail(cs.dup, "名字已在册");
  const index = bucketOf(bounds, event.ms);
  state.buckets[index] = (state.buckets[index] || 0) + 1;
  if (slowerThan(state.slowest, event.ms)) state.slowest = [event.name, event.ms];
  state.names.push(event.name);
  if (event.id !== undefined) state.applied.push(event.id);
}

export function step(spec) {
  const state = cloneState(spec.state);
  const events = spec.events || [];
  const bounds = spec.bounds || [];
  const cs = codes(spec);
  let budget = typeof spec.budget === "number" ? spec.budget : 0;
  events.forEach(function (event) { checkShape(event, cs.event); });
  let served = 0;
  let judged = 0;
  while (state.ledger.length > 0 && budget > 0) {
    applyEvent(state, bounds, state.ledger.shift(), cs);
    served += 1;
    judged += 1;
    budget -= 1;
  }
  events.forEach(function (event) {
    if (event.id !== undefined && state.applied.indexOf(event.id) !== -1) return;
    if (budget > 0) {
      applyEvent(state, bounds, event, cs);
      served += 1;
      budget -= 1;
    } else {
      state.ledger.push(Object.assign({}, event));
    }
    judged += 1;
  });
  const pending = (spec.state && spec.state.ledger) || [];
  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (event) { return [event.kind, event.name, event.ms]; }),
    judged: judged,
    judged_bound: events.length + pending.length
  };
}

export function close(spec) {
  const state = cloneState(spec.state);
  const bounds = spec.bounds || [];
  const cs = codes(spec);
  let catchup = 0;
  while (state.ledger.length > 0) {
    applyEvent(state, bounds, state.ledger.shift(), cs);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
