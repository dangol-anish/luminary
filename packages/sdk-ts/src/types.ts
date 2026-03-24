export interface EvaluateInput {
  prompt: string;
  response: string;
  model?: string;
  sdk_version?: string;
  user_id?: string;
  project?: string;
  endpoint?: string;
}

export interface EvaluateResult {
  call_id: string;
  similarity: string;
  score: number;
  reason: string;
  is_regression: boolean;
  bleu: string;
  rouge: string;
  baseline_score: string;
}

export interface EvaluateOptions extends EvaluateInput {
  endpoint?: string;
}
