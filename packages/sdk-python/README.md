# Luminary Python SDK

A Python SDK for the Luminary LLM Observability Platform.

## Installation

```bash
pip install .
```

Or from the monorepo root:

```bash
pip install -e packages/sdk-python
```

## Usage

```python
from luminary import evaluate_call

result = evaluate_call(
    prompt="What is the capital of France?",
    response="The capital of France is Paris.",
    model="gemini-2.5-flash",
    project="test-project",
    api_key="your-api-key"
)

print(result)
```

## API

### `evaluate_call(prompt, response, model, project, api_key, base_url="http://localhost:3000")`

Evaluates an LLM call and returns metrics.

- `prompt`: str - The input prompt.
- `response`: str - The LLM response.
- `model`: str - The model used.
- `project`: str - The project name.
- `api_key`: str - Your API key for authentication.
- `base_url`: str - The base URL of the API server (optional, default: http://localhost:3000).

Returns a dict with evaluation metrics.