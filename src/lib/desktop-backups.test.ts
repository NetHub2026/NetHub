import { it, expect } from "vitest";
import { createRequire } from "node:module";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const backups = createRequire(import.meta.url)("../../electron/backups.cjs");
it("keeps Windows backup history bounded and safely restores data with a pre-restore copy", () => {
  const directory = mkdtempSync(join(tmpdir(), "nethub-backups-")),
    source = join(directory, "devices-db.json");
  try {
    for (let i = 0; i < 9; i++) {
      writeFileSync(
        source,
        JSON.stringify({
          devices: [
            {
              id: "example",
              name: `Example ${i}`,
              mac: "02:00:00:00:00:02",
              ip: "192.168.50.2",
              tags: [],
            },
          ],
          events: [],
          usage: { devices: {}, lastTick: null },
        }),
      );
      backups.create(directory, source);
    }
    const entries = backups.entries(directory);
    expect(entries).toHaveLength(7);
    const chosen = entries[entries.length - 1];
    const data = backups.read(directory, chosen.id);
    backups.restore(directory, source, chosen.id);
    expect(JSON.parse(readFileSync(source, "utf8"))).toEqual(data);
    expect(backups.entries(directory)).toHaveLength(7);
    expect(
      backups
        .entries(directory)
        .some((e: { id: string }) => backups.read(directory, e.id).devices[0].name === "Example 8"),
    ).toBe(true);
    expect(() => backups.read(directory, "../devices-db.json")).toThrow();
    expect(() => backups.restore(directory, source, "not-a-copy")).toThrow();
    expect(JSON.parse(readFileSync(source, "utf8"))).toEqual(data);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
