import { expect, it } from "vitest";
import { emptyPatternState, evaluatePatterns, reviewAnomaly, sanitizePatterns } from "./patterns";

const now = new Date(2026, 0, 10, 10);
const initial = () => {
  const state = emptyPatternState();
  state.observed.fill(10);
  state.devices["example"] = { hours: Array(24).fill(0), lastKey: null };
  return evaluatePatterns(
    state,
    [{ id: "example", name: "Equipo de prueba", ip: "192.0.2.1", status: "online" }],
    null,
    now,
  ).state;
};
it("preserves a review through storage and allows reopening without erasing evidence", () => {
  const state = initial();
  const anomaly = state.anomalies[0]!;
  const reviewed = reviewAnomaly(state, anomaly.id, true, now);
  expect(state.anomalies[0]!.reviewedAt).toBeUndefined();
  const loaded = sanitizePatterns(JSON.parse(JSON.stringify(reviewed)));
  expect(loaded.anomalies[0]!.reviewedAt).toBe(now.toISOString());
  expect(reviewAnomaly(loaded, anomaly.id, false).anomalies[0]).toEqual(anomaly);
  expect(loaded.devices).toEqual(state.devices);
});
it("keeps new events pending after an earlier event was reviewed", () => {
  const state = initial();
  const reviewed = reviewAnomaly(state, state.anomalies[0]!.id, true, now);
  const result = evaluatePatterns(
    reviewed,
    [{ id: "example", name: "Equipo de prueba", ip: "192.0.2.1", status: "online" }],
    null,
    new Date(2026, 0, 10, 11),
  );
  expect(result.fresh).toHaveLength(1);
  expect(result.fresh[0]!.reviewedAt).toBeUndefined();
  expect(result.state.anomalies.find((a) => a.id === reviewed.anomalies[0]!.id)?.reviewedAt).toBe(
    now.toISOString(),
  );
});
it("loads legacy anomalies as pending and rejects invalid review dates", () => {
  const state = initial();
  expect(sanitizePatterns(state).anomalies[0]!.reviewedAt).toBeUndefined();
  state.anomalies[0]!.reviewedAt = "invalid";
  expect(sanitizePatterns(state).anomalies[0]!.reviewedAt).toBeUndefined();
});
