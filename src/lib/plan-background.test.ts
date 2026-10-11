import { expect, it } from "vitest";
import { clearPlanMargins } from "./plan-background";

it("clears white margins while keeping walls, colored floors and enclosed white rooms", () => {
  const size = 7;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 1; y < 6; y++) for (let x = 1; x < 6; x++) {
    if (x === 1 || x === 5 || y === 1 || y === 5) pixels.set([40, 50, 60, 255], (y * size + x) * 4);
  }
  pixels.set([220, 180, 140, 255], (3 * size + 4) * 4);
  clearPlanMargins(pixels, size, size);
  expect(pixels[3]).toBe(0);
  expect(pixels[(3 * size + 3) * 4 + 3]).toBe(255);
  expect(Array.from(pixels.slice((3 * size + 4) * 4, (3 * size + 4) * 4 + 4))).toEqual([220, 180, 140, 255]);
  expect(pixels[(size + 1) * 4 + 3]).toBe(255);
});

it("preserves existing transparency and removes background connected through transparent pixels", () => {
  const pixels = new Uint8ClampedArray([0,0,0,0, 255,255,255,255, 80,120,160,255]);
  clearPlanMargins(pixels, 3, 1);
  expect(Array.from(pixels)).toEqual([0,0,0,0, 255,255,255,0, 80,120,160,255]);
});
