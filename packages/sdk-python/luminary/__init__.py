import requests
from typing import Dict, Any

def evaluate_call(
    prompt: str,
    response: str,
    model: str,
    project: str,
    api_key: str,
    base_url: str = "http://localhost:3000"
) -> Dict[str, Any]:
    """
    Evaluate an LLM call with metrics.

    Args:
        prompt: The input prompt.
        response: The LLM response.
        model: The model used.
        project: The project name.
        api_key: The API key for authentication.
        base_url: The base URL of the API (default: http://localhost:3000).

    Returns:
        A dictionary with the evaluation results.

    Raises:
        requests.RequestException: If the request fails.
    """
    url = f"{base_url}/api/evaluate"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    data = {
        "prompt": prompt,
        "response": response,
        "model": model,
        "project": project,
    }
    response = requests.post(url, json=data, headers=headers)
    response.raise_for_status()
    return response.json()