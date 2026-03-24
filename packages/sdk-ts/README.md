# @luminary/sdk-ts

A small TypeScript SDK for Luminary LLM observability endpoint.

## Install

```bash
cd /Users/anishdangol/Documents/work/luminary/packages/sdk-ts
npm install
```

## Usage

```ts
import { evaluateCall } from "@luminary/sdk-ts";

(async () => {
  const result = await evaluateCall({
    prompt: "What is the capital of France?",
    response: "The capital of France is Paris.",
    model: "gemini-2.5-flash",
    project: "test-project",
  });

  console.log(result);
})();
```

## API

- `evaluateCall(input: EvaluateInput): Promise<EvaluateResult>`

### EvaluateInput
- `prompt` (string, required)
- `response` (string, required)
- `model` (string, optional)
- `sdk_version` (string, optional)
- `user_id` (string, optional)
- `project` (string, optional)
- `endpoint` (string, optional, default `http://localhost:3000/api/evaluate`)
