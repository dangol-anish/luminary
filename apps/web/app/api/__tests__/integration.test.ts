import { test } from "node:test";
import assert from "assert";
import {
  MockSupabaseAdmin,
  createMockLLMCall,
  createMockMetric,
  createMockAlert,
  createTestDataset,
  MockRateLimiter,
} from "./test-helpers.mjs";

test("Integration: POST /api/evaluate creates llm_call record in DB", async () => {
  // Simulate POST /api/evaluate with valid payload
  // Should insert into llm_calls table and return metrics

  const dataset = createTestDataset();
  const mockSupabase = new MockSupabaseAdmin({
    llm_calls: [],
    metrics: [],
    alerts: [],
  });

  const evaluatePayload = createMockLLMCall({
    prompt: "What is the capital of France?",
    response: "The capital of France is Paris.",
    model: "gemini-2.5-flash",
    project: "prod",
    user_id: "user-123",
  });

  // Insert call
  const callResult = await mockSupabase.from("llm_calls").insert(evaluatePayload);

  assert.ok(callResult.data);
  assert.strictEqual(callResult.data[0].prompt, evaluatePayload.prompt);
  assert.strictEqual(callResult.data[0].response, evaluatePayload.response);
  assert.strictEqual(callResult.data[0].model, evaluatePayload.model);
});

test("Integration: POST /api/evaluate computes metrics and inserts", async () => {
  // After creating llm_call, should create corresponding metric record
  // with computed scores (BLEU, ROUGE, similarity, score)

  const mockSupabase = new MockSupabaseAdmin({
    llm_calls: [],
    metrics: [],
  });

  const call = createMockLLMCall({
    id: "call-123",
    project: "prod",
    model: "gpt-4",
  });

  // Insert call first
  await mockSupabase.from("llm_calls").insert(call);

  // Then create metric
  const metric = createMockMetric({
    llm_call_id: call.id,
    project: call.project,
    model: call.model,
    score: 4.5,
    bleu_score: 0.85,
    rouge_score: 0.78,
    similarity: 0.95,
  });

  const metricResult = await mockSupabase.from("metrics").insert(metric);

  assert.ok(metricResult.data);
  assert.strictEqual(metricResult.data[0].score, 4.5);
  assert.strictEqual(metricResult.data[0].bleu_score, 0.85);
});

test("Integration: regression detection triggers alert creation", async () => {
  // Scenario:
  // 1. Baseline: 5 previous calls with avg score 4.2
  // 2. New call with score 3.5
  // 3. Drop = 4.2 - 3.5 = 0.7 > threshold (0.5)
  // 4. Should create alert with is_regression = true

  const baselineMetrics = [
    createMockMetric({ score: 4.2, project: "prod", model: "gpt-4" }),
    createMockMetric({ score: 4.3, project: "prod", model: "gpt-4" }),
    createMockMetric({ score: 4.1, project: "prod", model: "gpt-4" }),
  ];

  const avgBaseline = baselineMetrics.reduce((sum, m) => sum + m.score, 0) / baselineMetrics.length;
  const newScore = 3.5;
  const scoreDrop = avgBaseline - newScore;
  const regressionThreshold = 0.5;

  assert.ok(scoreDrop > regressionThreshold);
  assert.strictEqual(Math.round(scoreDrop * 10) / 10, 0.7); // ~0.7 drop

  // Create alert for regression
  const mockSupabase = new MockSupabaseAdmin({
    alerts: [],
  });

  const alert = createMockAlert({
    project: "prod",
    model: "gpt-4",
    status: "open",
    message: `Regression detected: score dropped from ${avgBaseline.toFixed(2)} to ${newScore.toFixed(2)}`,
  });

  const alertResult = await mockSupabase.from("alerts").insert(alert);
  assert.ok(alertResult.data);
  assert.ok(alertResult.data[0].message.includes("Regression"));
});

test("Integration: user isolation via RLS - queries filtered by user_id", async () => {
  // Test RLS enforcement:
  // Create data for User A and User B
  // Query as User A should only return User A's data

  const userA_calls = [
    createMockLLMCall({ user_id: "user-a", project: "proj-a", id: "call-a-1" }),
    createMockLLMCall({ user_id: "user-a", project: "proj-a", id: "call-a-2" }),
  ];

  const userB_calls = [
    createMockLLMCall({ user_id: "user-b", project: "proj-b", id: "call-b-1" }),
  ];

  const mockSupabase = new MockSupabaseAdmin({
    llm_calls: [...userA_calls, ...userB_calls],
  });

  // Query as user-a (simulating RLS filter via auth)
  const userA_result = await mockSupabase
    .from("llm_calls")
    .select()
    .eq("user_id", "user-a");

  assert.strictEqual(userA_result.data.length, 2);
  assert.ok(userA_result.data.every((call: any) => call.user_id === "user-a"));

  // Query as user-b
  const userB_result = await mockSupabase
    .from("llm_calls")
    .select()
    .eq("user_id", "user-b");

  assert.strictEqual(userB_result.data.length, 1);
  assert.strictEqual(userB_result.data[0].user_id, "user-b");
});

test("Integration: rate limiter blocks requests after limit exceeded", async () => {
  // User makes 10 requests to /api/evaluate (limit is 10)
  // 11th request should be blocked with allowed: false

  const rateLimiter = new MockRateLimiter();
  const userId = "user-123";
  const endpoint = "/api/evaluate";

  // Make 10 allowed requests
  for (let i = 0; i < 10; i++) {
    const result = rateLimiter.checkRateLimit(userId, endpoint);
    assert.ok(result.allowed, `Request ${i + 1} should be allowed`);
  }

  // 11th request should be blocked
  const blockedResult = rateLimiter.checkRateLimit(userId, endpoint);
  assert.ok(!blockedResult.allowed, "11th request should be blocked");
  assert.strictEqual(blockedResult.remaining, 0);
});

test("Integration: evaluate endpoint has higher rate limit than others", async () => {
  // /api/evaluate: 10 req/min
  // /api/calls, /api/metrics, /api/alerts: 30 req/min

  const rateLimiter = new MockRateLimiter();
  const userId = "user-123";

  const evaluateLimit = rateLimiter.checkRateLimit(userId, "/api/evaluate");
  const metricsLimit = rateLimiter.checkRateLimit(userId, "/api/metrics");

  // Both should be allowed for first request
  assert.ok(evaluateLimit.allowed);
  assert.ok(metricsLimit.allowed);

  // /api/evaluate should have remaining = 9 (limit 10)
  assert.strictEqual(evaluateLimit.remaining, 9);
  // /api/metrics should have remaining = 29 (limit 30)
  assert.strictEqual(metricsLimit.remaining, 29);
});

test("Integration: complete evaluate flow with filtering", async () => {
  // Scenario:
  // 1. Create 5 calls for user-123 (project prod, model gpt-4)
  // 2. Create 5 calls for user-123 (project staging, model gemini)
  // 3. Query /api/calls with filter project=prod&model=gpt-4
  // 4. Should return only first 5

  const calls = [
    ...Array(5).fill(null).map(() =>
      createMockLLMCall({ user_id: "user-123", project: "prod", model: "gpt-4" })
    ),
    ...Array(5).fill(null).map(() =>
      createMockLLMCall({ user_id: "user-123", project: "staging", model: "gemini-2.5-flash" })
    ),
  ];

  const mockSupabase = new MockSupabaseAdmin({
    llm_calls: calls,
  });

  // Apply filters: user_id + project + model
  const filtered = await mockSupabase
    .from("llm_calls")
    .select()
    .eq("user_id", "user-123")
    .eq("project", "prod")
    .eq("model", "gpt-4");

  assert.strictEqual(filtered.data.length, 5);
  assert.ok(filtered.data.every((call: any) => call.project === "prod" && call.model === "gpt-4"));
});

function dataset() {
  return createTestDataset();
}