"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

type Call = {
  id: string;
  created_at: string;
  prompt: string;
  response: string;
  model: string;
  project: string;
  metrics: {
    cosine_similarity: number;
    score: number;
    score_reason: string;
    is_regression: boolean;
    bleu_score: number;
    rouge_score: number;
  }[];
};

type Metric = {
  id: string;
  call_id: string;
  cosine_similarity: number;
  score: number;
  score_reason: string;
  is_regression: boolean;
  bleu_score: number;
  rouge_score: number;
  created_at: string;
  llm_calls?: {
    prompt: string;
    response: string;
    model: string;
    project: string;
    created_at: string;
  };
};

export default function Dashboard() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(true);

  const [newPrompt, setNewPrompt] = useState("");
  const [newModel, setNewModel] = useState("gemini-2.5-flash");
  const [newProject, setNewProject] = useState("default");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeResolved, setIncludeResolved] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "custom">("24h");
  const [groupBy, setGroupBy] = useState<"hour" | "day" | "week">("hour");
  const [aggregatedMetrics, setAggregatedMetrics] = useState<any[]>([]);
  const [aggregatedLoading, setAggregatedLoading] = useState(false);
  const [breakdownMetrics, setBreakdownMetrics] = useState<any[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  async function fetchAggregatedMetrics() {
    setAggregatedLoading(true);
    const token = await supabase.auth.getSession();
    const accessToken = token.data.session?.access_token;
    if (!accessToken) {
      setAggregatedLoading(false);
      return;
    }

    const params = new URLSearchParams();
    params.set("range", timeRange === "custom" ? "custom" : timeRange);
    params.set("groupBy", groupBy);
    if (timeRange === "custom") {
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
    }
    if (newProject) params.set("project", newProject);
    if (newModel) params.set("model", newModel);

    const res = await fetch(`/api/metrics/aggregated?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.ok) {
      const json = await res.json();
      setAggregatedMetrics(json.data || []);
    }
    setAggregatedLoading(false);
  }

  async function fetchBreakdownMetrics() {
    setBreakdownLoading(true);
    const token = await supabase.auth.getSession();
    const accessToken = token.data.session?.access_token;
    if (!accessToken) {
      setBreakdownLoading(false);
      return;
    }

    const params = new URLSearchParams();
    params.set("range", timeRange === "custom" ? "custom" : timeRange);
    params.set("groupBy", "project");
    if (timeRange === "custom") {
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
    }

    const res = await fetch(`/api/metrics/breakdown?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.ok) {
      const json = await res.json();
      setBreakdownMetrics(json.data || []);
    }
    setBreakdownLoading(false);
  }

  async function fetchCalls() {
    setLoading(true);
    const token = await supabase.auth.getSession();
    const accessToken = token.data.session?.access_token;
    if (!accessToken) {
      setSubmitError("User is not authenticated.");
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    if (newProject) params.set("project", newProject);
    if (newModel) params.set("model", newModel);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    params.set("limit", "50");

    const res = await fetch(`/api/calls?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const json = await res.json();
      setSubmitError(json.error || "Failed to load calls");
      setLoading(false);
      return;
    }

    const json = await res.json();
    setCalls(json.data || []);
    setLoading(false);
  }

  async function submitPrompt() {
    if (!newPrompt.trim()) {
      setSubmitError("Please enter a prompt.");
      return;
    }

    const token = await supabase.auth.getSession();
    const accessToken = token.data.session?.access_token;
    if (!accessToken) {
      setSubmitError("User is not authenticated.");
      return;
    }

    setSubmitLoading(true);
    setSubmitError(null);
    setSubmitResult(null);

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          prompt: newPrompt,
          model: newModel,
          project: newProject,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to evaluate prompt.");
      }

      const json = await res.json();
      setSubmitResult(
        `Score: ${json.score}/5 | BLEU: ${json.bleu} | ROUGE: ${json.rouge}`,
      );
      setNewPrompt("");
      await fetchCalls();
      await fetchAlerts();
    } catch (err: any) {
      setSubmitError(err.message || "Error submitting prompt.");
    } finally {
      setSubmitLoading(false);
    }
  }

  async function fetchAlerts() {
    setAlertsLoading(true);
    const token = await supabase.auth.getSession();
    const accessToken = token.data.session?.access_token;
    if (!accessToken) {
      setAlertsError("User is not authenticated.");
      setAlertsLoading(false);
      return;
    }

    const params = new URLSearchParams();
    if (newProject) params.set("project", newProject);
    if (newModel) params.set("model", newModel);
    params.set("resolved", includeResolved ? "true" : "false");
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);

    const res = await fetch(`/api/alerts?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const json = await res.json();
      setAlertsError(json.error || "Failed to load alerts");
      setAlertsLoading(false);
      return;
    }

    const json = await res.json();
    setAlerts(json.data || []);
    setAlertsLoading(false);
  }

  async function fetchMetrics() {
    setMetricsLoading(true);
    const token = await supabase.auth.getSession();
    const accessToken = token.data.session?.access_token;
    if (!accessToken) {
      setMetricsError("User is not authenticated.");
      setMetricsLoading(false);
      return;
    }

    const params = new URLSearchParams();
    if (newProject) params.set("project", newProject);
    if (newModel) params.set("model", newModel);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    params.set("limit", "200");

    const res = await fetch(`/api/metrics?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const json = await res.json();
      setMetricsError(json.error || "Failed to load metrics");
      setMetricsLoading(false);
      return;
    }

    const json = await res.json();
    setMetrics(json.data || []);
    setMetricsLoading(false);
  }

  async function resolveAlert(id: string) {
    const token = await supabase.auth.getSession();
    const accessToken = token.data.session?.access_token;
    if (!accessToken) {
      setAlertsError("User is not authenticated.");
      return;
    }

    const res = await fetch("/api/alerts", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ id, resolved: true }),
    });

    if (!res.ok) {
      const json = await res.json();
      setAlertsError(json.error || "Failed to resolve alert");
      return;
    }

    await fetchAlerts();
    await fetchCalls();
  }

  useEffect(() => {
    // Expose supabase to browser console for debugging
    if (typeof window !== "undefined") {
      (window as any).supabase = supabase;
    }

    const setupAuth = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setAuthLoading(false);

      const { data: authListener } = supabase.auth.onAuthStateChange(
        (_, session) => {
          setSession(session);
        },
      );

      return () => {
        authListener.subscription?.unsubscribe();
      };
    };

    setupAuth();

    fetchCalls();
    fetchAlerts();
    fetchMetrics();
    fetchAggregatedMetrics();
    fetchBreakdownMetrics();

    const channel = supabase
      .channel("realtime-calls")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "llm_calls" },
        () => {
          fetchCalls();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Refetch aggregated metrics when filters change
  useEffect(() => {
    if (!session) return;
    fetchAggregatedMetrics();
    fetchBreakdownMetrics();
  }, [timeRange, groupBy, dateFrom, dateTo, newProject, newModel, session]);

  const chartData = [...calls].reverse().map((c, i) => ({
    index: i + 1,
    score: c.metrics?.[0]?.score ?? null,
    similarity: parseFloat((c.metrics?.[0]?.cosine_similarity ?? 0).toFixed(3)),
    bleu: parseFloat((c.metrics?.[0]?.bleu_score ?? 0).toFixed(3)),
    rouge: parseFloat((c.metrics?.[0]?.rouge_score ?? 0).toFixed(3)),
  }));

  const signIn = async () => {
    if (!email) {
      alert("Please enter your email");
      return;
    }

    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setAuthLoading(false);

    if (error) {
      alert(error.message);
    } else {
      alert("Magic link sent. Check your email.");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (authLoading) {
    return <main className="min-h-screen p-8">Loading auth...</main>;
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-4">Sign in to Luminary</h1>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 rounded-md mb-2 bg-gray-900 border border-gray-700"
          />
          <button
            onClick={signIn}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-2 rounded-md"
          >
            Send magic link
          </button>
        </div>
      </main>
    );
  }

  const regressions = calls.filter((c) => c.metrics?.[0]?.is_regression);
  const avgScore = calls.length
    ? (
        calls.reduce((sum, c) => sum + (c.metrics?.[0]?.score ?? 0), 0) /
        calls.length
      ).toFixed(2)
    : "—";

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Luminary</h1>
            <p className="text-gray-400 mt-1">LLM Observability Dashboard</p>
          </div>
          <button
            onClick={signOut}
            className="px-4 py-2 rounded-md bg-red-700 hover:bg-red-600"
          >
            Sign out
          </button>
        </div>

        {/* Prompt submission */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <p className="text-sm text-gray-400 mb-4">Run prompt and evaluate</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
              placeholder="Project"
              className="p-2 rounded-md bg-gray-800 border border-gray-700 text-sm"
            />
            <input
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              placeholder="Model (gemini-2.5-flash)"
              className="p-2 rounded-md bg-gray-800 border border-gray-700 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="p-2 rounded-md bg-gray-800 border border-gray-700 text-sm"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="p-2 rounded-md bg-gray-800 border border-gray-700 text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <label className="text-xs text-gray-400 flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeResolved}
                onChange={(e) => setIncludeResolved(e.target.checked)}
                className="w-4 h-4"
              />
              Include resolved alerts
            </label>
            <button
              onClick={() => {
                fetchAlerts();
                fetchMetrics();
                fetchCalls();
              }}
              className="px-3 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-xs"
            >
              Refresh filters
            </button>
          </div>
          <textarea
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            placeholder="Enter prompt to send to LLM"
            className="w-full min-h-[90px] mt-3 p-3 rounded-md bg-gray-800 border border-gray-700 text-sm"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={submitPrompt}
              disabled={submitLoading}
              className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
            >
              {submitLoading ? "Submitting..." : "Run and Evaluate"}
            </button>
            {submitResult && (
              <span className="text-sm text-emerald-300">{submitResult}</span>
            )}
            {submitError && (
              <span className="text-sm text-red-300">{submitError}</span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-400 text-sm">Total calls</p>
            <p className="text-3xl font-semibold mt-1">{calls.length}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-400 text-sm">Avg quality score</p>
            <p className="text-3xl font-semibold mt-1">
              {avgScore}
              <span className="text-gray-500 text-lg">/5</span>
            </p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-400 text-sm">Regressions</p>
            <p
              className={`text-3xl font-semibold mt-1 ${regressions.length > 0 ? "text-red-400" : "text-green-400"}`}
            >
              {regressions.length}
            </p>
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <p className="text-sm text-gray-400 mb-4">Active regression alerts</p>
          {alertsLoading ? (
            <div className="text-gray-400">Loading alerts...</div>
          ) : alertsError ? (
            <div className="text-red-300">{alertsError}</div>
          ) : alerts.length === 0 ? (
            <div className="text-gray-400">No active regression alerts.</div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 rounded-md bg-gray-800 border border-gray-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 font-medium">
                      {alert.type}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {alert.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {alert.llm_calls?.project} / {alert.llm_calls?.model}
                    </p>
                  </div>
                  <button
                    onClick={() => resolveAlert(alert.id)}
                    className="px-3 py-1 text-xs rounded-md bg-emerald-700 hover:bg-emerald-600"
                  >
                    Mark resolved
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filter controls for time series */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <p className="text-sm text-gray-400 mb-4">Time series filters</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs text-gray-400 block mb-2">Time Range</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-sm"
              >
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7d</option>
                <option value="30d">Last 30d</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-2">Group By</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-sm"
              >
                <option value="hour">Hour</option>
                <option value="day">Day</option>
                <option value="week">Week</option>
              </select>
            </div>
            {timeRange === "custom" && (
              <>
                <div>
                  <label className="text-xs text-gray-400 block mb-2">From</label>
                  <input
                    type="datetime-local"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-2">To</label>
                  <input
                    type="datetime-local"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-sm"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Metrics history */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <p className="text-sm text-gray-400 mb-4">Metrics history</p>
          {metricsLoading ? (
            <div className="text-gray-400">Loading metrics...</div>
          ) : metricsError ? (
            <div className="text-red-300">{metricsError}</div>
          ) : metrics.length === 0 ? (
            <div className="text-gray-400">No metrics found.</div>
          ) : (
            <div className="text-sm text-gray-300 space-y-2 max-h-48 overflow-y-auto">
              {metrics.slice(0, 20).map((m) => (
                <div
                  key={m.id}
                  className="p-2 border border-gray-800 rounded-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {m.llm_calls?.project || "unknown"}
                    </span>
                    <span>{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Score: {m.score} | BLEU: {(m.bleu_score ?? 0).toFixed(4)} |
                    ROUGE: {(m.rouge_score ?? 0).toFixed(4)} | Similarity:{" "}
                    {(m.cosine_similarity ?? 0).toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <p className="text-sm text-gray-400 mb-4">Quality score over time</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="index" stroke="#6b7280" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 5]} stroke="#6b7280" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: "#111827",
                  border: "1px solid #374151",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "#9ca3af" }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#818cf8"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="similarity"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="bleu"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="rouge"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-6 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-indigo-400 inline-block" /> Quality
              score
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-emerald-400 inline-block" /> Cosine
              similarity
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-amber-400 inline-block" /> BLEU
              score
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-red-400 inline-block" /> ROUGE score
            </span>
          </div>
        </div>

        {/* Time Series Chart */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <p className="text-sm text-gray-400 mb-4">Metrics time series</p>
          {aggregatedLoading ? (
            <div className="text-gray-400">Loading...</div>
          ) : aggregatedMetrics.length === 0 ? (
            <div className="text-gray-400">No data available.</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={aggregatedMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="time"
                  stroke="#6b7280"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid #374151",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "#9ca3af" }}
                  formatter={(value) => (typeof value === "number" ? value.toFixed(3) : value)}
                />
                <Legend wrapperStyle={{ paddingTop: 16 }} />
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  stroke="#818cf8"
                  strokeWidth={2}
                  dot={false}
                  name="Avg Score"
                />
                <Line
                  type="monotone"
                  dataKey="avgSimilarity"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={false}
                  name="Avg Similarity"
                />
                <Line
                  type="monotone"
                  dataKey="avgBleu"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  name="Avg BLEU"
                />
                <Line
                  type="monotone"
                  dataKey="avgRouge"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  name="Avg ROUGE"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Project/Model Breakdown */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <p className="text-sm text-gray-400 mb-4">Performance by project</p>
          {breakdownLoading ? (
            <div className="text-gray-400">Loading...</div>
          ) : breakdownMetrics.length === 0 ? (
            <div className="text-gray-400">No data available.</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={breakdownMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 12 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid #374151",
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: "#9ca3af" }}
                  formatter={(value) => (typeof value === "number" ? value.toFixed(3) : value)}
                />
                <Legend wrapperStyle={{ paddingTop: 16 }} />
                <Bar dataKey="avgScore" fill="#818cf8" name="Avg Score" />
                <Bar dataKey="avgSimilarity" fill="#34d399" name="Avg Similarity" />
                <Bar dataKey="avgBleu" fill="#f59e0b" name="Avg BLEU" />
                <Bar dataKey="avgRouge" fill="#ef4444" name="Avg ROUGE" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Calls table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <p className="font-medium">Recent calls</p>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : (
            <div className="divide-y divide-gray-800">
              {calls.map((call) => {
                const m = call.metrics?.[0];
                return (
                  <div
                    key={call.id}
                    className="px-6 py-4 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {call.prompt}
                        </p>
                        <p className="text-sm text-gray-400 truncate mt-0.5">
                          {call.response}
                        </p>
                        {m?.score_reason && (
                          <p className="text-xs text-gray-500 mt-1 italic">
                            {m.score_reason}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {m?.is_regression && (
                          <span className="text-xs bg-red-900/50 text-red-400 border border-red-800 px-2 py-0.5 rounded-full">
                            regression
                          </span>
                        )}
                        <span
                          className={`text-sm font-semibold ${
                            (m?.score ?? 0) >= 4
                              ? "text-green-400"
                              : (m?.score ?? 0) >= 3
                                ? "text-yellow-400"
                                : "text-red-400"
                          }`}
                        >
                          {m?.score ?? "—"}/5
                        </span>
                        <div className="text-xs text-gray-500">
                          BLEU: {m?.bleu_score?.toFixed(3) ?? "—"} | ROUGE:{" "}
                          {m?.rouge_score?.toFixed(3) ?? "—"}
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(call.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
