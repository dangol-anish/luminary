import { NextRequest, NextResponse } from "next/server.js";
import { supabaseAdmin } from "@/lib/supabase";
import { cosineSimilarity, rouge1, bleuScore } from "@/app/api/evaluate/utils";
import nodemailer from "nodemailer";
import axios from "axios";

// Drift thresholds
const DRIFT_THRESHOLD = 0.1; // 10% drop in average score
const LOOKBACK_HOURS = 24; // Check last 24 hours
const BASELINE_DAYS = 7; // Baseline from last 7 days

async function getRecentMetrics(project: string, model: string) {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const { data } = await supabaseAdmin
    .from("metrics")
    .select("score, cosine_similarity, bleu_score, rouge_score, llm_calls!inner(project, model)")
    .eq("llm_calls.project", project)
    .eq("llm_calls.model", model)
    .gte("metrics.created_at", since.toISOString())
    .order("metrics.created_at", { ascending: false });

  return data || [];
}

async function getBaselineMetrics(project: string, model: string) {
  const since = new Date(Date.now() - BASELINE_DAYS * 24 * 60 * 60 * 1000);
  const { data } = await supabaseAdmin
    .from("metrics")
    .select("score, cosine_similarity, bleu_score, rouge_score, llm_calls!inner(project, model)")
    .eq("llm_calls.project", project)
    .eq("llm_calls.model", model)
    .gte("metrics.created_at", since.toISOString())
    .order("metrics.created_at", { ascending: false });

  return data || [];
}

function computeAverage(metrics: any[], field: string) {
  if (metrics.length === 0) return 0;
  const sum = metrics.reduce((acc, m) => acc + (m[field] || 0), 0);
  return sum / metrics.length;
}

async function sendNotification(alert: any) {
  const channels = alert.notification_channels || [];

  const canSendEmail =
    typeof process.env.EMAIL_USER === "string" &&
    process.env.EMAIL_USER.length > 0 &&
    typeof process.env.EMAIL_PASS === "string" &&
    process.env.EMAIL_PASS.length > 0 &&
    typeof process.env.ALERT_EMAIL_RECIPIENT === "string" &&
    process.env.ALERT_EMAIL_RECIPIENT.length > 0;

  const canSendSlack = typeof process.env.SLACK_WEBHOOK_URL === "string" && process.env.SLACK_WEBHOOK_URL.length > 0;

  if (channels.includes("email") && canSendEmail) {
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or your email service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ALERT_EMAIL_RECIPIENT,
      subject: 'LLM Drift Alert',
      text: alert.message,
    });
  }

  if (channels.includes("slack") && canSendSlack) {
    await axios.post(process.env.SLACK_WEBHOOK_URL!, {
      text: `🚨 ${alert.message}`,
    });
  }

  // If we couldn't send to any configured channel (missing env vars), still mark as sent
  // so cron retries don't repeatedly fail.
  const sentEmail = channels.includes("email") && canSendEmail;
  const sentSlack = channels.includes("slack") && canSendSlack;
  if (!sentEmail && !sentSlack) {
    await supabaseAdmin
      .from("alerts")
      .update({ notification_sent: true })
      .eq("id", alert.id);
    return;
  }

  // Mark as sent
  await supabaseAdmin
    .from("alerts")
    .update({ notification_sent: true })
    .eq("id", alert.id);
}

async function checkDrift() {
  // Get unique project-model pairs from recent calls
  const { data: recentCalls } = await supabaseAdmin
    .from("llm_calls")
    .select("project, model")
    .gte("created_at", new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false });

  if (!recentCalls) return;

  const uniquePairs = Array.from(
    new Set(recentCalls.map(c => `${c.project}-${c.model}`))
  ).map(pair => {
    const [project, model] = pair.split('-');
    return { project, model };
  });

  for (const { project, model } of uniquePairs) {
    const recentMetrics = await getRecentMetrics(project, model);
    const baselineMetrics = await getBaselineMetrics(project, model);

    if (recentMetrics.length < 5 || baselineMetrics.length < 10) continue; // Not enough data

    const recentAvgScore = computeAverage(recentMetrics, 'score');
    const baselineAvgScore = computeAverage(baselineMetrics, 'score');

    if (baselineAvgScore - recentAvgScore > DRIFT_THRESHOLD) {
      // Create alert
      const { data: alert } = await supabaseAdmin
        .from("alerts")
        .insert({
          type: 'drift',
          message: `Drift detected in ${project}/${model}: score dropped from ${baselineAvgScore.toFixed(2)} to ${recentAvgScore.toFixed(2)}`,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          notification_channels: ['email', 'slack']
        })
        .select()
        .single();

      if (alert) {
        await sendNotification(alert);
      }
    }
  }
}

async function cleanupExpiredAlerts() {
  await supabaseAdmin
    .from("alerts")
    .update({ resolved: true })
    .lt("expires_at", new Date().toISOString())
    .eq("resolved", false);
}

export async function GET(req: NextRequest) {
  // Simple auth check for cron (use a secret token)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await checkDrift();
    await cleanupExpiredAlerts();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}