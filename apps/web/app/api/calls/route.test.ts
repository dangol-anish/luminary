import { test } from "node:test";
import assert from "assert";
import { GET } from "./route.ts";

const makeReq = () => ({
  headers: new Map(),
  nextUrl: new URL("http://localhost/api/calls"),
});

test("GET /api/calls returns 401 without auth", async () => {
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
