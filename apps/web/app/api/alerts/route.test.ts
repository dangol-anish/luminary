import { test } from "node:test";
import assert from "assert";

test("GET /api/alerts returns 401 without auth", async () => {
  const imported = await import("../../../.next/server/app/api/alerts/route.js");
  const { GET } = imported.default.routeModule.userland;

  const result = await GET({
    headers: { get: () => null },
    nextUrl: new URL("http://localhost/api/alerts"),
  } as any);

  assert.strictEqual(result.status, 401);
  const body = await result.json();
  assert.strictEqual(body.error, "Unauthorized");
});

test("PATCH /api/alerts returns 401 without auth", async () => {
  const imported = await import("../../../.next/server/app/api/alerts/route.js");
  const { PATCH } = imported.default.routeModule.userland;

  const result = await PATCH({
    headers: { get: () => null },
    json: async () => ({ id: "x", resolved: true }),
  } as any);

  assert.strictEqual(result.status, 401);
  const body = await result.json();
  assert.strictEqual(body.error, "Unauthorized");
});
