import { test } from "node:test";
import assert from "assert";
import { GET, PATCH } from "./route.ts";

const makeReq = () => ({
  headers: {
    get: () => null,
  },
  nextUrl: new URL("http://localhost/api/alerts"),
});

test("GET /api/alerts returns 401 without auth", async () => {
  const result = await GET(makeReq() as any);
  assert.strictEqual(result.status, 401);
  const body = await result.json();
  assert.strictEqual(body.error, "Unauthorized");
});

test("PATCH /api/alerts returns 401 without auth", async () => {
  const result = await PATCH({
    headers: { get: () => null },
    json: async () => ({ id: "x", resolved: true }),
  } as any);
  assert.strictEqual(result.status, 401);
  const body = await result.json();
  assert.strictEqual(body.error, "Unauthorized");
});
