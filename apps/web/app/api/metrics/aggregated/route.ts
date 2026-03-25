import { NextRequest, NextResponse } from "next/server.js";
import { supabaseAdmin } from "@/lib/supabase";

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.split(" ")[1] ?? null;

  if (!token) {
    return null;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const project = searchParams.get("project");
  const model = searchParams.get("model");
  const rangePreset = searchParams.get("range") ?? "24h"; // 24h, 7d, 30d, custom
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const groupBy = searchParams.get("groupBy") ?? "hour"; // hour, day, week

  // Calculate date range
  const now = new Date();
  let startDate: Date;

  switch (rangePreset) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "custom":
      startDate = from ? new Date(from) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "24h":
    default:
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const endDate = to ? new Date(to) : now;

  // Query raw metrics data
  let query = supabaseAdmin
    .from("metrics")
    .select("score, cosine_similarity, bleu_score, rouge_score, created_at, llm_calls(project, model)")
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString());

  if (project) {
    query = query.eq("llm_calls.project", project);
  }

  if (model) {
    query = query.eq("llm_calls.model", model);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate data by time bucket
  const aggregated = aggregateMetrics(data || [], groupBy);

  return NextResponse.json({
    data: aggregated,
    range: { start: startDate.toISOString(), end: endDate.toISOString() },
    groupBy,
  });
}

function aggregateMetrics(
  metrics: any[],
  groupBy: string
): { time: string; avgScore: number; avgSimilarity: number; avgBleu: number; avgRouge: number; count: number }[] {
  const buckets: Record<string, any[]> = {};

  for (const metric of metrics) {
    const date = new Date(metric.created_at);
    let key: string;

    switch (groupBy) {
      case "day":
        key = date.toISOString().split("T")[0];
        break;
      case "week":
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        key = weekStart.toISOString().split("T")[0];
        break;
      case "hour":
      default:
        key = date.toISOString().slice(0, 13) + ":00"; // YYYY-MM-DDTHH:00
    }

    if (!buckets[key]) {
      buckets[key] = [];
    }
    buckets[key].push(metric);
  }

  const result = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, metricsInBucket]) => {
      const scores = metricsInBucket.map((m) => m.score).filter((s) => s !== null);
      const similarities = metricsInBucket.map((m) => m.cosine_similarity).filter((s) => s !== null);
      const bleus = metricsInBucket.map((m) => m.bleu_score).filter((b) => b !== null);
      const rouges = metricsInBucket.map((m) => m.rouge_score).filter((r) => r !== null);

      return {
        time,
        avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        avgSimilarity: similarities.length > 0 ? similarities.reduce((a, b) => a + b, 0) / similarities.length : 0,
        avgBleu: bleus.length > 0 ? bleus.reduce((a, b) => a + b, 0) / bleus.length : 0,
        avgRouge: rouges.length > 0 ? rouges.reduce((a, b) => a + b, 0) / rouges.length : 0,
        count: metricsInBucket.length,
      };
    });

  return result;
}