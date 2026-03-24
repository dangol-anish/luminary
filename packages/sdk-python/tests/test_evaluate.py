import requests
from luminary import evaluate_call

class DummyResponse:
    def __init__(self, json_data, status_code=200):
        self._json = json_data
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code}")

    def json(self):
        return self._json


def test_evaluate_call_success(monkeypatch):
    def mock_post(url, json, headers):
        return DummyResponse({
            "call_id": "abc123",
            "similarity": "0.9000",
            "score": 5,
            "reason": "Great",
            "is_regression": False,
            "bleu": "0.0000",
            "rouge": "0.5000",
            "baseline_score": "3.00",
        }, 200)

    monkeypatch.setattr(requests, "post", mock_post)

    result = evaluate_call(
        prompt="What is the capital of France?",
        response="The capital of France is Paris.",
        model="gemini-2.5-flash",
        project="test-project",
        api_key="fake-key",
    )

    assert result["score"] == 5
    assert result["call_id"] == "abc123"
