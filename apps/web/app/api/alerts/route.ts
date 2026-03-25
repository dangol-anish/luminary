import { NextRequest, NextResponse } from "next/server.js";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

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

  const rateLimit = checkRateLimit(user.id, "/api/alerts");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Retry in ${rateLimit.resetIn} seconds.` },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimit.resetIn.toString(),
        },
      }
    );
  }

  const { searchParams } = req.nextUrl;
  const project = searchParams.get("project");
  const resolved = searchParams.get("resolved");
  const limit = Number(searchParams.get("limit") ?? 50);
  const offset = Number(searchParams.get("offset") ?? 0);

  const normalizedLimit = isNaN(limit) || limit <= 0 ? 50 : limit;
  const normalizedOffset = isNaN(offset) || offset < 0 ? 0 : offset;
  const start = normalizedOffset;
  const end = normalizedOffset + normalizedLimit - 1;

  let query = supabaseAdmin
    .from("alerts")
    .select("*, llm_calls(prompt, response, model, project)")
    .order("created_at", { ascending: false })
    .range(start, end);

  if (resolved === "true" || resolved === "false") {
    query = query.eq("resolved", resolved === "true");
  }

  if (project) {
    query = query.eq("llm_calls.project", project);
  }

  const { data, error } = await query;
  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(user.id, "/api/alerts");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Retry in ${rateLimit.resetIn} seconds.` },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimit.resetIn.toString(),
        },
      }
    );
  }

  const { id, resolved } = await req.json();

  if (!id || typeof resolved !== "boolean") {
    return NextResponse.json({ error: "id and resolved boolean are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("alerts")
    .update({ resolved })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
