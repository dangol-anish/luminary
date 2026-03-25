import { NextRequest } from "next/server";

/**
 * Mock Supabase Query Builder
 * Chainable interface matching Supabase client methods
 */
export class MockQueryBuilder {
  private table: string;
  private selectedColumns: string[] | string | null = null;
  private filters: Array<{ type: string; field: string; value: any }> = [];
  private orderBy: { field: string; ascending: boolean } | null = null;
  private rangeStart: number | null = null;
  private rangeEnd: number | null = null;
  private data: any[] = [];
  private insertData: any[] = [];
  private updateData: any = null;

  constructor(table: string, initialData: any[] = []) {
    this.table = table;
    this.data = initialData;
  }

  select(columns: string = "*"): this {
    this.selectedColumns = columns;
    return this;
  }

  eq(field: string, value: any): this {
    this.filters.push({ type: "eq", field, value });
    return this;
  }

  gte(field: string, value: any): this {
    this.filters.push({ type: "gte", field, value });
    return this;
  }

  lte(field: string, value: any): this {
    this.filters.push({ type: "lte", field, value });
    return this;
  }

  range(from: number, to: number): this {
    this.rangeStart = from;
    this.rangeEnd = to;
    return this;
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.orderBy = {
      field,
      ascending: options?.ascending ?? true,
    };
    return this;
  }

  insert(values: any): this {
    this.insertData = Array.isArray(values) ? values : [values];
    return this;
  }

  update(values: any): this {
    this.updateData = values;
    return this;
  }

  private applyFilters(data: any[]): any[] {
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

  private applySorting(data: any[]): any[] {
    if (!this.orderBy) return data;
    return data.sort((a, b) => {
      const aVal = a[this.orderBy!.field];
      const bVal = b[this.orderBy!.field];
      if (this.orderBy!.ascending) {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
  }

  private applyRange(data: any[]): any[] {
    if (this.rangeStart !== null && this.rangeEnd !== null) {
      return data.slice(this.rangeStart, this.rangeEnd + 1);
    }
    return data;
  }

  async then(callback?: any): Promise<any> {
    let result = this.data;

    // For select operations
    if (this.selectedColumns !== null) {
      result = this.applyFilters(result);
      result = this.applySorting(result);
      const ranged = this.applyRange(result);

      return Promise.resolve({
        data: ranged,
        error: null,
        count: result.length, // Total count before pagination
      });
    }

    // For insert operations
    if (this.insertData.length > 0) {
      this.data.push(...this.insertData);
      return Promise.resolve({
        data: this.insertData,
        error: null,
        count: this.insertData.length,
      });
    }

    // For update operations
    if (this.updateData !== null) {
      const filtered = this.applyFilters(this.data);
      filtered.forEach((item) => {
        Object.assign(item, this.updateData);
      });
      return Promise.resolve({
        data: filtered,
        error: null,
        count: filtered.length,
      });
    }

    return Promise.resolve({
      data: result,
      error: null,
      count: result.length,
    });
  }

  async catch(callback: any): Promise<any> {
    return Promise.reject(new Error("Query failed"));
  }

  // Add optional select() method for explicit column selection
  async select(): Promise<any> {
    return this.then();
  }
}

/**
 * Mock Supabase Admin Client
 */
export class MockSupabaseAdmin {
  private tables: Map<string, MockQueryBuilder> = new Map();

  constructor(initialData?: Record<string, any[]>) {
    if (initialData) {
      for (const [table, data] of Object.entries(initialData)) {
        this.tables.set(table, new MockQueryBuilder(table, data));
      }
    }
  }

  from(table: string): MockQueryBuilder {
    if (!this.tables.has(table)) {
      this.tables.set(table, new MockQueryBuilder(table, []));
    }
    return this.tables.get(table)!;
  }

  getTablesData(): Record<string, any[]> {
    const result: Record<string, any[]> = {};
    for (const [table, builder] of this.tables.entries()) {
      result[table] = (builder as any).data || [];
    }
    return result;
  }
}

/**
 * Test Data Factories
 */

export function createMockLLMCall(overrides?: Partial<any>) {
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

export function createMockMetric(overrides?: Partial<any>) {
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

export function createMockAlert(overrides?: Partial<any>) {
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
 * Mock Request Builder
 */
export function createMockRequest(
  overrides?: Partial<{
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    url?: string;
    searchParams?: Record<string, string>;
  }>
): NextRequest {
  const method = overrides?.method || "GET";
  const headers = new Map(Object.entries(overrides?.headers || {}));
  const url = overrides?.url || "http://localhost:3000/api/test";

  const request = {
    method,
    headers,
    url,
    nextUrl: {
      searchParams: new URLSearchParams(overrides?.searchParams || {}),
    },
    json: async () => overrides?.body || {},
    text: async () => JSON.stringify(overrides?.body || {}),
  } as any as NextRequest;

  return request;
}

/**
 * Mock Auth Context
 */
export function createMockAuthContext(userId: string = "user-123") {
  return {
    user: {
      id: userId,
      email: "test@example.com",
      aud: "authenticated",
    },
  };
}

/**
 * Mock Rate Limiter
 */
export class MockRateLimiter {
  private limits: Map<string, { count: number; resetTime: number }> = new Map();

  checkRateLimit(userId: string, endpoint: string) {
    const key = `${userId}:${endpoint}`;
    const config = {
      "/api/evaluate": { maxRequests: 10, windowSeconds: 60 },
      "/api/metrics": { maxRequests: 30, windowSeconds: 60 },
      "/api/calls": { maxRequests: 30, windowSeconds: 60 },
      "/api/alerts": { maxRequests: 20, windowSeconds: 60 },
    } as Record<string, { maxRequests: number; windowSeconds: number }>;

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
