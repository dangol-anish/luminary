import { NextRequest, NextResponse } from "next/server";
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
  const limit = Number(searchParams.get("limit") ?? 50);
  const offset = Number(searchParams.get("offset") ?? 0);

  const normalizedLimit = isNaN(limit) || limit <= 0 ? 50 : limit;
  const normalizedOffset = isNaN(offset) || offset < 0 ? 0 : offset;
  const start = normalizedOffset;
  const end = normalizedOffset + normalizedLimit - 1;

  let query = supabaseAdmin
    .from("llm_calls")
    .select("*, metrics(cosine_similarity, score, score_reason, is_regression, bleu_score, rouge_score)")
    .order("created_at", { ascending: false })
    .range(start, end);

  if (project) {
    query = query.eq("project", project);
  }

  if (model) {
    query = query.eq("model", model);
  }

  const { data, error } = await query;
  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
