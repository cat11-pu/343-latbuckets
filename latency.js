// latency.js：分档与最慢
export function bucketOf(bounds, ms) {
  for (let i = 0; i < bounds.length; i += 1) {
    if (ms < bounds[i]) return i;
  }
  return bounds.length;
}

export function slowerThan(slowest, ms) {
  if (!slowest || slowest.length === 0) return true;
  return ms > slowest[1];
}
