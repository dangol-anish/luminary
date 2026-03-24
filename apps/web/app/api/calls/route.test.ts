import { test } from "node:test";
import assert from "assert";

test("GET /api/calls returns 401 without auth", async () => {
  const imported = await import("../../../.next/server/app/api/calls/route.js");
  const { GET } = imported.default.routeModule.userland;

  const req: any = {
    headers: {
      get: () => null,
    },
    nextUrl: new URL("http://localhost/api/calls"),
  };

  const result = await GET(req);
  assert.strictEqual(result.status, 401);
  const body = await result.json();
  assert.strictEqual(body.error, "Unauthorized");
});
