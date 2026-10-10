import assert from "node:assert/strict";
const base = "http://127.0.0.1:8080";
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(base + "/healthz")).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 100));
}
assert.equal((await fetch(base + "/api/state")).status, 401);
const login = await fetch(base + "/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: "synthetic-container-password-2026" }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie").split(";")[0],
  { csrf } = await login.json();
const headers = { cookie, "Content-Type": "application/json", "X-NetHub-CSRF": csrf };
const state = await (await fetch(base + "/api/state", { headers })).json();
assert.equal(state.server.demo, true);
if (process.env.EXPECT_RESTORED === "true") assert.equal(state.settings.contractedMbps, 1234);
else {
  assert.equal(
    (
      await fetch(base + "/api/settings", {
        method: "POST",
        headers,
        body: JSON.stringify({ contractedMbps: 1234 }),
      })
    ).status,
    200,
  );
  for (let i = 0; i < 50; i++) {
    const current = await (await fetch(base + "/api/state", { headers })).json();
    if (current.devices.length === 3 && current.health.length) {
      console.log("Authentication, browser-independent monitor and durable settings verified.");
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Monitor did not collect data without a browser");
}
console.log("Data survived container restart.");
