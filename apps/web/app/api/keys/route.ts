import { NextRequest, NextResponse } from "next/server.js";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.split(" ")[1];
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error: keysError } = await supabaseAdmin
    .from("api_keys")
    .select("id, name, created_at, key_preview")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (keysError) return NextResponse.json({ error: keysError.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.split(" ")[1];
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const newKey = "lum_" + crypto.randomBytes(32).toString("hex");
  const keyHash = crypto.createHash("sha256").update(newKey).digest("hex");
  const keyPreview = newKey.slice(0, 8) + "..." + newKey.slice(-4);

  const { data, error: insertError } = await supabaseAdmin
    .from("api_keys")
    .insert({ user_id: user.id, name, key_hash: keyHash, key_preview: keyPreview })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  
  // Return the plaintext key exactly ONCE
  return NextResponse.json({ data: { ...data, plainTextKey: newKey } });
}

export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.split(" ")[1];
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const { error: deleteError } = await supabaseAdmin
    .from("api_keys")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
