import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/lib/supabase";
import * as natural from "natural";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

function bleuScore(candidate: string, reference: string): number {
  // Placeholder: BLEU implementation requires additional setup
  return 0; // TODO: implement proper BLEU
}

function rouge1(candidate: string, reference: string): number {
  const candTokens = candidate.toLowerCase().split(/\s+/);
  const refTokens = reference.toLowerCase().split(/\s+/);
  const candSet = new Set(candTokens);
  const refSet = new Set(refTokens);
  const intersection = new Set([...candSet].filter(x => refSet.has(x)));
  const precision = intersection.size / candSet.size;
  const recall = intersection.size / refSet.size;
  return 2 * (precision * recall) / (precision + recall) || 0;
}

async function getBaselineScore(project: string, model: string): Promise<number> {
  const { data } = await supabase
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
    const { prompt, response, model, sdk_version, user_id, project } =
      await req.json();

    if (!prompt || !response) {
      return NextResponse.json(
        { error: "prompt and response are required" },
        { status: 400 },
      );
    }

    // Save the LLM call
    const { data: callData, error: callError } = await supabase
      .from("llm_calls")
      .insert({ prompt, response, model, sdk_version, user_id, project })
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
    const { error: metricsError } = await supabase.from("metrics").insert({
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
      await supabase.from("alerts").insert({
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
