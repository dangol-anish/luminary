import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/lib/supabase";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
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

    // Score with LLM-as-judge
    const { score, reason } = await scoreWithLLM(prompt, response);

    const isRegression = score < 3;

    // Save metrics
    const { error: metricsError } = await supabase.from("metrics").insert({
      call_id: callData.id,
      cosine_similarity: similarity,
      score,
      score_reason: reason,
      is_regression: isRegression,
    });

    if (metricsError) throw metricsError;

    // Create alert if regression detected
    if (isRegression) {
      await supabase.from("alerts").insert({
        call_id: callData.id,
        type: "regression",
        message: `Low quality score (${score}/5): ${reason}`,
      });
    }

    return NextResponse.json({
      call_id: callData.id,
      similarity: similarity.toFixed(4),
      score,
      reason,
      is_regression: isRegression,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
