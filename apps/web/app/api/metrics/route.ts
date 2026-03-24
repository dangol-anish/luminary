import { NextRequest, NextResponse } from "next/server.js";
import { supabaseAdmin } from "../../../lib/supabase";

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
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Number(searchParams.get("limit") ?? 100);
  const offset = Number(searchParams.get("offset") ?? 0);

  const normalizedLimit = isNaN(limit) || limit <= 0 ? 100 : limit;
  const normalizedOffset = isNaN(offset) || offset < 0 ? 0 : offset;
  const start = normalizedOffset;
  const end = normalizedOffset + normalizedLimit - 1;

  let query = supabaseAdmin
    .from("metrics")
    .select("*, llm_calls(prompt, response, model, project, created_at)")
    .order("created_at", { ascending: false })
    .range(start, end);

  if (project) {
    query = query.eq("llm_calls.project", project);
  }

  if (model) {
    query = query.eq("llm_calls.model", model);
  }

  if (from) {
    query = query.gte("created_at", from);
  }

  if (to) {
    query = query.lte("created_at", to);
  }

  const { data, error } = await query;
  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
