"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
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

export default function Dashboard() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchCalls() {
    const { data } = await supabase
      .from("llm_calls")
      .select(
        `*, metrics(cosine_similarity, score, score_reason, is_regression, bleu_score, rouge_score)`,
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setCalls(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchCalls();

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

  const chartData = [...calls].reverse().map((c, i) => ({
    index: i + 1,
    score: c.metrics?.[0]?.score ?? null,
    similarity: parseFloat((c.metrics?.[0]?.cosine_similarity ?? 0).toFixed(3)),
    bleu: parseFloat((c.metrics?.[0]?.bleu_score ?? 0).toFixed(3)),
    rouge: parseFloat((c.metrics?.[0]?.rouge_score ?? 0).toFixed(3)),
  }));

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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Luminary</h1>
          <p className="text-gray-400 mt-1">LLM Observability Dashboard</p>
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
              <span className="w-3 h-0.5 bg-amber-400 inline-block" /> BLEU score
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-0.5 bg-red-400 inline-block" /> ROUGE score
            </span>
          </div>
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
                          BLEU: {m?.bleu_score?.toFixed(3) ?? "—"} | ROUGE: {m?.rouge_score?.toFixed(3) ?? "—"}
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
