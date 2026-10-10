const empty = () => ({ rxMbps: 0, txMbps: 0, totalMbps: 0, available: false });

/** One counter read at a time; all callers share the same interval and result. */
function createTrafficSampler(readCounters, now = () => performance.now()) {
  let previous = null;
  let pending = null;
  let sampledAt = -Infinity;
  let sample = empty();
  return function readTraffic() {
    if (pending) return pending;
    if (now() - sampledAt < 1000) return Promise.resolve(sample);
    pending = (async () => {
      try {
        const counters = await readCounters();
        const at = now();
        if (!counters || !Number.isFinite(counters.rx) || !Number.isFinite(counters.tx) || counters.rx < 0 || counters.tx < 0) {
          previous = null;
          sample = empty();
        } else {
          const old = previous;
          previous = { ...counters, at };
          const seconds = old ? (at - old.at) / 1000 : 0;
          if (!old || seconds <= 0 || counters.rx < old.rx || counters.tx < old.tx) sample = empty();
          else {
            const rxMbps = (counters.rx - old.rx) * 8 / seconds / 1e6;
            const txMbps = (counters.tx - old.tx) * 8 / seconds / 1e6;
            sample = { rxMbps, txMbps, totalMbps: rxMbps + txMbps, available: true };
          }
        }
        sampledAt = at;
        return sample;
      } catch {
        previous = null;
        sampledAt = now();
        return sample = empty();
      } finally { pending = null; }
    })();
    return pending;
  };
}
module.exports = { createTrafficSampler };
