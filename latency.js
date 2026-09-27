// latency.js：分档与最慢
export function bucketOf(bounds, ms) {
  for (let index = 0; index < bounds.length; index += 1) {
    if (ms < bounds[index]) return index;
  }
  return bounds.length;
}

export function slowerThan(slowest, ms) {
  if (!slowest || slowest.length < 2) return true;
  return ms > slowest[1];
}
