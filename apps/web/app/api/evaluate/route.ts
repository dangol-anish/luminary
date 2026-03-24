import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { cosineSimilarity, rouge1, bleuScore } from "./utils";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function getBaselineScore(
  project: string,
  model: string,
): Promise<number> {
  const { data } = await supabaseAdmin
    .from("metrics")
    .select("score, llm_calls!inner(project, model)")
    .eq("llm_calls.project", project)
    .eq("llm_calls.model", model)
    .order("metrics.created_at", { ascending: false })
    .limit(50);
  if (!data || data.length === 0) return 3; // default
  const avg = data.reduce((sum, m) => sum + (m.score || 0), 0) / data.length;
  return avg;
}

async function getEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

async function scoreWithLLM(
  prompt: string,
  response: string,
): Promise<{ score: number; reason: string }> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const scoringPrompt = `
You are an LLM output quality evaluator.
Given a prompt and a response, score the response from 1 to 5.
Return ONLY valid JSON in this exact format: {"score": <number>, "reason": "<one sentence>"}

Prompt: ${prompt}
Response: ${response}
`;
  const result = await model.generateContent(scoringPrompt);
  const text = result.response.text().trim();
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.split(" ")[1] ?? null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let { prompt, response, model, sdk_version, project } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 },
      );
    }

    const modelName = model || "gemini-2.5-flash";

    if (!response) {
      const modelHandle = genAI.getGenerativeModel({ model: modelName });
      const generation = await modelHandle.generateContent(prompt);
      response = generation.response.text().trim();
    }

    // Save the LLM call under admin access
    const { data: callData, error: callError } = await supabaseAdmin
      .from("llm_calls")
      .insert({ prompt, response, model: modelName, sdk_version, user_id: user.id, project })
      .select()
      .single();

    if (callError) throw callError;

    // Compute embeddings and similarity
    const [promptEmbedding, responseEmbedding] = await Promise.all([
      getEmbedding(prompt),
      getEmbedding(response),
    ]);
    const similarity = cosineSimilarity(promptEmbedding, responseEmbedding);

    // Compute text quality metrics
    const bleu = bleuScore(response, prompt);
    const rouge = rouge1(response, prompt);

    // Score with LLM-as-judge
    const { score, reason } = await scoreWithLLM(prompt, response);

    // Get baseline score for regression detection
    const baselineScore = await getBaselineScore(project || "", model || "");
    const isRegression = score < baselineScore - 0.5; // threshold

    // Save metrics
    const { error: metricsError } = await supabaseAdmin.from("metrics").insert({
      call_id: callData.id,
      cosine_similarity: similarity,
      score,
      score_reason: reason,
      is_regression: isRegression,
      bleu_score: bleu,
      rouge_score: rouge,
    });

    if (metricsError) throw metricsError;

    // Create alert if regression detected
    if (isRegression) {
      await supabaseAdmin.from("alerts").insert({
        call_id: callData.id,
        type: "regression",
        message: `Regression detected: score ${score} below baseline ${baselineScore.toFixed(2)} - ${reason}`,
      });
    }

    return NextResponse.json({
      call_id: callData.id,
      similarity: similarity.toFixed(4),
      score,
      reason,
      is_regression: isRegression,
      bleu: bleu.toFixed(4),
      rouge: rouge.toFixed(4),
      baseline_score: baselineScore.toFixed(2),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
