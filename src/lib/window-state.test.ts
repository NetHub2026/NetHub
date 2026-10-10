import { expect, it } from "vitest";
import { createRequire } from "node:module";
const { readWindowState, windowSize, mergeWindowState } = createRequire(import.meta.url)(
  "../../electron/window-state.cjs",
);

it("keeps native size when renderer preferences are saved", () => {
  const state = { width: 1300, height: 800, maximized: true };
  const json = mergeWindowState(JSON.stringify({ theme: "dark", inventorySort: "name" }), state);
  expect(JSON.parse(json)).toEqual({ theme: "dark", inventorySort: "name", windowState: state });
  const next = mergeWindowState(JSON.stringify({ theme: "light" }), readWindowState(json));
  expect(readWindowState(next)).toEqual(state);
});
it("restores saved size while respecting the current screen", () => {
  expect(windowSize({ width: 1300, height: 800 }, { width: 1920, height: 1080 })).toMatchObject({
    width: 1300,
    height: 800,
  });
  expect(windowSize({ width: 3000, height: 2000 }, { width: 1366, height: 768 })).toMatchObject({
    width: 1366,
    height: 768,
  });
  expect(windowSize(null, { width: 800, height: 600 })).toEqual({
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 600,
  });
});
it("falls back for old or corrupt settings and invalid geometry", () => {
  for (const json of [null, "broken", "{}", '{"windowState":{"width":0,"height":-1}}'])
    expect(readWindowState(json)).toBeNull();
});
