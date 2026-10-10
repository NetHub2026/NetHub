import { afterEach, expect, it } from "vitest";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { resolveIconPath, persistentTaskbarIcon } = createRequire(import.meta.url)("../../electron/icon-path.cjs");
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it("uses the external Windows icon even when app.asar also contains it", () => {
  const root = mkdtempSync(join(tmpdir(), "nethub-icon-"));
  roots.push(root);
  const resourcesPath = join(root, "resources");
  const appPath = join(resourcesPath, "app.asar");
  for (const base of [join(resourcesPath, "icons"), join(appPath, "public")]) {
    mkdirSync(base, { recursive: true });
    for (const file of ["favicon.ico", "app-icon.png"]) writeFileSync(join(base, file), "test");
  }
  for (const file of ["favicon.ico", "app-icon.png"])
    expect(
      resolveIconPath(file, { resourcesPath, appPath, electronDir: join(appPath, "electron") }),
    ).toBe(join(resourcesPath, "icons", file));
});

it("uses public icons in development without a packaged resources folder", () => {
  const root = mkdtempSync(join(tmpdir(), "nethub-icon-"));
  roots.push(root);
  mkdirSync(join(root, "public"));
  writeFileSync(join(root, "public", "favicon.ico"), "test");
  expect(
    resolveIconPath("favicon.ico", { appPath: root, electronDir: join(root, "electron") }),
  ).toBe(join(root, "public", "favicon.ico"));
});


it("keeps taskbar icons outside the temporary payload and refreshes changed assets", () => {
  const root = mkdtempSync(join(tmpdir(), "nethub-icon-")); roots.push(root);
  const payload=join(root,"payload"), cache=join(root,"persistent");
  mkdirSync(payload); const source=join(payload,"favicon.ico");
  writeFileSync(source,"icon-v1"); const first=persistentTaskbarIcon(source,cache);
  expect(first.startsWith(cache)).toBe(true);
  expect(persistentTaskbarIcon(source,cache)).toBe(first);
  writeFileSync(source,"icon-v2"); const second=persistentTaskbarIcon(source,cache);
  expect(second).not.toBe(first);
  rmSync(payload,{recursive:true,force:true});
  expect(readFileSync(first,"utf8")).toBe("icon-v1");
  expect(readFileSync(second,"utf8")).toBe("icon-v2");
});
