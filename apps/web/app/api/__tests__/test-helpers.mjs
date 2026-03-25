/**
 * Mock Supabase Query Builder (JavaScript/CommonJS compatible)
 * Chainable interface matching Supabase client methods
 */
/**
 * Mock Supabase Query Builder (JavaScript/CommonJS compatible)
 * Chainable interface matching Supabase client methods
 */
export class MockQueryBuilder {
  constructor(table, initialData = []) {
    this.table = table;
    this.data = initialData;
    this.selectedColumns = null;
    this.filters = [];
    this.orderBy = null;
    this.rangeStart = null;
    this.rangeEnd = null;
    this.insertData = [];
    this.updateData = null;
  }

  select(columns = "*") {
    this.selectedColumns = columns;
    return this;
  }

  eq(field, value) {
    this.filters.push({ type: "eq", field, value });
    return this;
  }

  gte(field, value) {
    this.filters.push({ type: "gte", field, value });
    return this;
  }

  lte(field, value) {
    this.filters.push({ type: "lte", field, value });
    return this;
  }

  range(from, to) {
    this.rangeStart = from;
    this.rangeEnd = to;
    return this;
  }

  order(field, options = {}) {
    this.orderBy = {
      field,
      ascending: options.ascending ?? true,
    };
    return this;
  }

  insert(values) {
    this.insertData = Array.isArray(values) ? values : [values];
    return this;
  }

  update(values) {
    this.updateData = values;
    return this;
  }

  applyFilters(data) {
    return data.filter((item) => {
      return this.filters.every((filter) => {
        const itemValue = item[filter.field];
        switch (filter.type) {
          case "eq":
            return itemValue === filter.value;
          case "gte":
            return itemValue >= filter.value;
          case "lte":
            return itemValue <= filter.value;
          default:
            return true;
        }
      });
    });
  }

  applySorting(data) {
    if (!this.orderBy) return data;
    return data.sort((a, b) => {
      const aVal = a[this.orderBy.field];
      const bVal = b[this.orderBy.field];
      if (this.orderBy.ascending) {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
  }

  applyRange(data) {
    if (this.rangeStart !== null && this.rangeEnd !== null) {
      return data.slice(this.rangeStart, this.rangeEnd + 1);
    }
    return data;
  }

  then(onFulfilled, onRejected) {
    // Execute the query and return a resolved promise
    let result = this.data;

    if (this.selectedColumns !== null) {
      result = this.applyFilters(result);
      result = this.applySorting(result);
      const ranged = this.applyRange(result);

      const response = {
        data: ranged,
        error: null,
        count: result.length,
      };
      return Promise.resolve(response).then(onFulfilled, onRejected);
    }

    if (this.insertData.length > 0) {
      this.data.push(...this.insertData);
      const response = {
        data: this.insertData,
        error: null,
        count: this.insertData.length,
      };
      return Promise.resolve(response).then(onFulfilled, onRejected);
    }

    if (this.updateData !== null) {
      const filtered = this.applyFilters(this.data);
      filtered.forEach((item) => {
        Object.assign(item, this.updateData);
      });
      const response = {
        data: filtered,
        error: null,
        count: filtered.length,
      };
      return Promise.resolve(response).then(onFulfilled, onRejected);
    }

    const response = {
      data: result,
      error: null,
      count: result.length,
    };
    return Promise.resolve(response).then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }
}

/**
 * Mock Supabase Admin Client
 */
export class MockSupabaseAdmin {
  constructor(initialData) {
    this.tables = new Map();
    if (initialData) {
      for (const [table, data] of Object.entries(initialData)) {
        this.tables.set(table, new MockQueryBuilder(table, data));
      }
    }
  }

  from(table) {
    if (!this.tables.has(table)) {
      this.tables.set(table, new MockQueryBuilder(table, []));
    }
    return this.tables.get(table);
  }

  getTablesData() {
    const result = {};
    for (const [table, builder] of this.tables.entries()) {
      result[table] = builder.data || [];
    }
    return result;
  }
}

/**
 * Test Data Factories
 */

export function createMockLLMCall(overrides = {}) {
  return {
    id: `call-${Math.random().toString(36).slice(2, 9)}`,
    user_id: "user-123",
    project: "prod",
    model: "gpt-4",
    prompt: "What is the capital of France?",
    response: "The capital of France is Paris.",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockMetric(overrides = {}) {
  return {
    id: `metric-${Math.random().toString(36).slice(2, 9)}`,
    user_id: "user-123",
    llm_call_id: `call-${Math.random().toString(36).slice(2, 9)}`,
    project: "prod",
    model: "gpt-4",
    score: 4.5,
    similarity: 0.95,
    bleu_score: 0.85,
    rouge_score: 0.78,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockAlert(overrides = {}) {
  return {
    id: `alert-${Math.random().toString(36).slice(2, 9)}`,
    user_id: "user-123",
    project: "prod",
    model: "gpt-4",
    priority: "high",
    status: "open",
    message: "Drift detected",
    created_at: new Date().toISOString(),
    resolved: false,
    resolved_at: null,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    notification_channels: ["email"],
    notification_sent: false,
    deleted: false,
    deleted_at: null,
    ...overrides,
  };
}

/**
 * Mock Rate Limiter
 */
export class MockRateLimiter {
  constructor() {
    this.limits = new Map();
  }

  checkRateLimit(userId, endpoint) {
    const key = `${userId}:${endpoint}`;
    const config = {
      "/api/evaluate": { maxRequests: 10, windowSeconds: 60 },
      "/api/metrics": { maxRequests: 30, windowSeconds: 60 },
      "/api/calls": { maxRequests: 30, windowSeconds: 60 },
      "/api/alerts": { maxRequests: 20, windowSeconds: 60 },
    };

    const endpointConfig = config[endpoint] || { maxRequests: 100, windowSeconds: 60 };
    const record = this.limits.get(key);
    const now = Date.now();

    if (!record || now > record.resetTime) {
      this.limits.set(key, {
        count: 1,
        resetTime: now + endpointConfig.windowSeconds * 1000,
      });
      return {
        allowed: true,
        remaining: endpointConfig.maxRequests - 1,
        resetIn: endpointConfig.windowSeconds,
      };
    }

    if (record.count < endpointConfig.maxRequests) {
      record.count++;
      return {
        allowed: true,
        remaining: endpointConfig.maxRequests - record.count,
        resetIn: Math.ceil((record.resetTime - now) / 1000),
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((record.resetTime - now) / 1000),
    };
  }

  reset() {
    this.limits.clear();
  }
}

/**
 * Helper to create a dataset for testing
 */
export function createTestDataset() {
  const calls = [
    createMockLLMCall({ project: "prod", model: "gpt-4" }),
    createMockLLMCall({ project: "prod", model: "gemini-2.5-flash" }),
    createMockLLMCall({ project: "staging", model: "gpt-4" }),
  ];

  const metrics = calls.map((call) =>
    createMockMetric({
      llm_call_id: call.id,
      project: call.project,
      model: call.model,
      user_id: call.user_id,
    })
  );

  const alerts = [
    createMockAlert({ project: "prod", model: "gpt-4", status: "open" }),
    createMockAlert({ project: "prod", model: "gpt-4", status: "resolved" }),
    createMockAlert({ project: "staging", model: "gpt-4", status: "open" }),
  ];

  return {
    llm_calls: calls,
    metrics,
    alerts,
  };
}
