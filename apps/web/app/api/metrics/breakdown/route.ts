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
  const rangePreset = searchParams.get("range") ?? "24h"; // 24h, 7d, 30d
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const groupByField = searchParams.get("groupBy") ?? "project"; // project or model

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

  // Query metrics with project/model info
  const { data, error } = await supabaseAdmin
    .from("metrics")
    .select("score, cosine_similarity, bleu_score, rouge_score, llm_calls(project, model)")
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString());

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate by project or model
  const aggregated = aggregateByField(data || [], groupByField);

  return NextResponse.json({
    data: aggregated,
    range: { start: startDate.toISOString(), end: endDate.toISOString() },
    groupBy: groupByField,
  });
}

function aggregateByField(
  metrics: any[],
  field: string
): { name: string; avgScore: number; avgSimilarity: number; avgBleu: number; avgRouge: number; count: number }[] {
  const groups: Record<string, any[]> = {};

  for (const metric of metrics) {
    const key = field === "project" ? metric.llm_calls?.project || "unknown" : metric.llm_calls?.model || "unknown";

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(metric);
  }

  const result = Object.entries(groups)
    .map(([name, metricsInGroup]) => {
      const scores = metricsInGroup.map((m) => m.score).filter((s) => s !== null);
      const similarities = metricsInGroup.map((m) => m.cosine_similarity).filter((s) => s !== null);
      const bleus = metricsInGroup.map((m) => m.bleu_score).filter((b) => b !== null);
      const rouges = metricsInGroup.map((m) => m.rouge_score).filter((r) => r !== null);

      return {
        name,
        avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        avgSimilarity: similarities.length > 0 ? similarities.reduce((a, b) => a + b, 0) / similarities.length : 0,
        avgBleu: bleus.length > 0 ? bleus.reduce((a, b) => a + b, 0) / bleus.length : 0,
        avgRouge: rouges.length > 0 ? rouges.reduce((a, b) => a + b, 0) / rouges.length : 0,
        count: metricsInGroup.length,
      };
    })
    .sort((a, b) => b.count - a.count);

  return result;
}