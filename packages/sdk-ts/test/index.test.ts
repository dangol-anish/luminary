const assert = require("assert");
const { test } = require("node:test");
const { evaluateCall, setFetch } = require("../dist/index.js");

// Mock network call to avoid needing live backend
class MockResponse {
  constructor(status, jsonData) {
    this.status = status;
    this.ok = status >= 200 && status < 300;
    this._json = jsonData;
  }
  async json() {
    return this._json;
  }
  async text() {
    return JSON.stringify(this._json);
  }
}

test("evaluateCall can call the API and parse response", async () => {
  setFetch(async (url, options) => {
    assert.strictEqual(url, "http://localhost:3000/api/evaluate");
    assert.strictEqual(options.headers["Content-Type"], "application/json");
    assert.strictEqual(options.headers.Authorization, "Bearer api_token_123");
    const body = JSON.parse(options.body);
    assert.strictEqual(body.prompt, "What is the capital of France?");
    return new MockResponse(200, {
      call_id: "abc123",
      similarity: "0.9000",
      score: 5,
      reason: "Great",
      is_regression: false,
      bleu: "0.0000",
      rouge: "0.5000",
      baseline_score: "3.00",
    });
  });

  const result = await evaluateCall({
    prompt: "What is the capital of France?",
    response: "The capital of France is Paris.",
    model: "gemini-2.5-flash",
    project: "test-project",
    sdk_version: "0.1.0",
    user_id: "test-user",
    api_key: "api_token_123",
    endpoint: "http://localhost:3000/api/evaluate",
  });

  assert.ok(result.call_id);
  assert.strictEqual(result.score, 5);
});
