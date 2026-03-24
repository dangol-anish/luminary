import { test } from "node:test";
import assert from "assert";

test("GET /api/metrics returns 401 without auth", async () => {
  const imported = await import("../../../.next/server/app/api/metrics/route.js");
  const { GET } = imported.default.routeModule.userland;
  const result = await GET({
    headers: { get: () => null },
    nextUrl: new URL("http://localhost/api/metrics"),
  } as any);

  assert.strictEqual(result.status, 401);
  const body = await result.json();
  assert.strictEqual(body.error, "Unauthorized");
});
