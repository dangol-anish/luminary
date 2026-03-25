-- Enforce RLS for multi-tenant isolation
-- Drop permissive policies
DROP POLICY IF EXISTS "Allow all operations on llm_calls" ON llm_calls;
DROP POLICY IF EXISTS "Allow all operations on metrics" ON metrics;
DROP POLICY IF EXISTS "Allow all operations on alerts" ON alerts;

-- Llm_calls policies: users can only see their own calls
CREATE POLICY "Users can view own llm_calls" ON llm_calls
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own llm_calls" ON llm_calls
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Metrics policies: users can view metrics for their own calls
CREATE POLICY "Users can view metrics for own calls" ON metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM llm_calls c
      WHERE c.id = metrics.call_id
      AND c.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert metrics for own calls" ON metrics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM llm_calls c
      WHERE c.id = metrics.call_id
      AND c.user_id = auth.uid()::text
    )
  );

-- Alerts policies: users can view/update alerts for their own calls
CREATE POLICY "Users can view alerts for own calls" ON alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM llm_calls c
      WHERE c.id = alerts.call_id
      AND c.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can update alerts for own calls" ON alerts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM llm_calls c
      WHERE c.id = alerts.call_id
      AND c.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert alerts for own calls" ON alerts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM llm_calls c
      WHERE c.id = alerts.call_id
      AND c.user_id = auth.uid()::text
    )
  );