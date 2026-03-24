import fetch from "cross-fetch";
import { EvaluateInput, EvaluateResult } from "./types";

const DEFAULT_ENDPOINT = "http://localhost:3000/api/evaluate";

let fetchFn = fetch;

export function setFetch(fn: typeof fetch) {
  fetchFn = fn;
}

export async function evaluateCall(input: EvaluateInput): Promise<EvaluateResult> {
  if (!input.prompt || !input.response) {
    throw new Error("prompt and response are required");
  }

  const endpoint = input.endpoint ?? DEFAULT_ENDPOINT;
  const body = {
    prompt: input.prompt,
    response: input.response,
    model: input.model,
    sdk_version: input.sdk_version,
    user_id: input.user_id,
    project: input.project,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (input.api_key) {
    headers.Authorization = `Bearer ${input.api_key}`;
  }

  const response = await fetchFn(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Evaluation API request failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as EvaluateResult;
  return json;
}
