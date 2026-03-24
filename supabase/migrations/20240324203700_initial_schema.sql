-- Initial schema for LLM Observability Platform
-- Tables: llm_calls, metrics, alerts

CREATE TABLE IF NOT EXISTS llm_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  model TEXT,
  sdk_version TEXT,
  user_id TEXT,
  project TEXT
);

CREATE TABLE IF NOT EXISTS metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID REFERENCES llm_calls(id) ON DELETE CASCADE,
  cosine_similarity FLOAT,
  score FLOAT,
  score_reason TEXT,
  is_regression BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID REFERENCES llm_calls(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_llm_calls_created_at ON llm_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_calls_project ON llm_calls(project);
CREATE INDEX IF NOT EXISTS idx_llm_calls_model ON llm_calls(model);
CREATE INDEX IF NOT EXISTS idx_metrics_call_id ON metrics(call_id);
CREATE INDEX IF NOT EXISTS idx_alerts_call_id ON alerts(call_id);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);

-- Enable Row Level Security (RLS)
ALTER TABLE llm_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for anon key, adjust as needed)
CREATE POLICY "Allow all operations on llm_calls" ON llm_calls FOR ALL USING (true);
CREATE POLICY "Allow all operations on metrics" ON metrics FOR ALL USING (true);
CREATE POLICY "Allow all operations on alerts" ON alerts FOR ALL USING (true);