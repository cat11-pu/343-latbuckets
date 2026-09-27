// latrun.js：按处理预算处理并留账，收尾不限预算补齐
import { bucketOf, slowerThan } from "./latency.js";

function errorCode(spec, key, fallback) {
  const codes = spec && spec.codes ? spec.codes : null;
  if (codes && Object.prototype.hasOwnProperty.call(codes, key)) return codes[key];
  if (spec && Object.prototype.hasOwnProperty.call(spec, key)) return spec[key];
  return fallback;
}

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// 事件结构：必须是对象，kind === "record"，name 为字符串，ms 为整数。
// 结构不合法报 E_BAD_EVENT；结构合法但 ms 为负数报 E_BAD_MS。
function validateEvent(event, spec) {
  if (event === null || typeof event !== "object" || Array.isArray(event)) {
    throw makeError(errorCode(spec, "event_error_code", "E_BAD_EVENT"), "bad event");
  }
  if (event.kind !== "record" || typeof event.name !== "string" || event.name.length === 0) {
    throw makeError(errorCode(spec, "event_error_code", "E_BAD_EVENT"), "bad event");
  }
  if (typeof event.ms !== "number" || !Number.isFinite(event.ms)
      || !Number.isInteger(event.ms) || event.ms < 0) {
    throw makeError(errorCode(spec, "ms_error_code", "E_BAD_MS"), "bad ms");
  }
}

function cloneState(state, bounds) {
  const size = (bounds && bounds.length + 1) || (state && state.buckets ? state.buckets.length : 0);
  const buckets = [];
  for (let i = 0; i < size; i += 1) {
    buckets.push(state && state.buckets && i < state.buckets.length ? state.buckets[i] : 0);
  }
  return {
    buckets,
    slowest: state && state.slowest ? state.slowest.slice() : [],
    names: state && state.names ? state.names.slice() : [],
    ledger: state && state.ledger ? state.ledger.map(function (row) { return row.slice(); }) : [],
    applied: state && state.applied ? state.applied.slice() : []
  };
}

function applyRecord(next, bounds, name, ms) {
  next.buckets[bucketOf(bounds, ms)] += 1;
  if (slowerThan(next.slowest, ms)) next.slowest = [name, ms];
  next.names.push(name);
  next.applied.push(name);
}

// 处理一串 [kind, name, ms] 账项，返回实际处理条数。limit 为预算上限。
function drain(next, bounds, rows, limit, spec) {
  let served = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (served >= limit) break;
    const row = rows[i];
    const name = row[1];
    if (next.applied.indexOf(name) !== -1) {
      // 已处理过（重放）：不再计数、不花预算。
      continue;
    }
    if (next.names.indexOf(name) !== -1) {
      throw makeError("E_DUP_ENTRY", "dup entry");
    }
    applyRecord(next, bounds, name, row[2]);
    served += 1;
  }
  return served;
}

export function step(spec) {
  const bounds = spec.bounds || [];
  const events = spec.events || [];
  const budget = Math.max(0, Number(spec.budget) || 0);

  // 先校验，与预算无关。
  for (let i = 0; i < events.length; i += 1) {
    validateEvent(events[i], spec);
  }

  const next = cloneState(spec.state, bounds);
  const ledgerBefore = next.ledger.length;

  // 上一轮压账的先处理，再接本轮新事件。
  const queue = next.ledger.map(function (row) { return row.slice(); });
  for (let i = 0; i < events.length; i += 1) {
    queue.push(["record", events[i].name, events[i].ms]);
  }
  next.ledger = [];

  let served = 0;
  for (let i = 0; i < queue.length; i += 1) {
    const row = queue[i];
    const name = row[1];
    if (next.applied.indexOf(name) !== -1) {
      // 重放：已在册，静默跳过，不占预算。
      continue;
    }
    if (served >= budget) {
      // 预算用尽：重复按当前在册名单判，撞不上就连着载压账。
      next.ledger.push(row);
      continue;
    }
    if (next.names.indexOf(name) !== -1) {
      throw makeError(errorCode(spec, "dup_error_code", "E_DUP_ENTRY"), "dup entry");
    }
    applyRecord(next, bounds, name, row[2]);
    served += 1;
  }

  const judged = served;
  const judgedBound = ledgerBefore + events.length;

  return {
    state: next,
    served,
    ledger_before: next.ledger.length,
    ledger: next.ledger,
    judged,
    judged_bound: judgedBound
  };
}

export function close(spec) {
  const bounds = spec.bounds || [];
  const next = cloneState(spec.state, bounds);
  const rows = next.ledger.map(function (row) { return row.slice(); });
  next.ledger = [];
  const catchup = drain(next, bounds, rows, Number.POSITIVE_INFINITY, spec);
  return { state: next, catchup };
}
