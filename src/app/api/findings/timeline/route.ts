// GET /api/findings/timeline?range=7d|30d|90d|all — daily finding counts by
// severity, for the severity-over-time chart.
//
// Returns a per-day breakdown of findings filed, grouped by severity, so the
// UI can render a stacked area / bar chart showing severity trends over time.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEVERITIES = ["critical", "high", "medium", "low", "info"];

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get("range") || "30d";
  let cutoff: Date | null = null;
  if (range === "7d") cutoff = new Date(Date.now() - 7 * 86400000);
  else if (range === "30d") cutoff = new Date(Date.now() - 30 * 86400000);
  else if (range === "90d") cutoff = new Date(Date.now() - 90 * 86400000);

  const where = cutoff ? { createdAt: { gte: cutoff } } : {};

  // Fetch findings in the range with their createdAt + severity.
  const findings = await db.finding.findMany({
    where,
    select: { severity: true, createdAt: true, falsePositive: true },
    orderBy: { createdAt: "asc" },
  });

  // Determine the date range (number of days to show).
  let days = 30;
  if (range === "7d") days = 7;
  else if (range === "90d") days = 90;
  else if (range === "all") {
    // For "all", use the span from the first finding to today (max 365 days).
    if (findings.length === 0) {
      return NextResponse.json({ range, days: 0, timeline: [], totals: {} });
    }
    const first = findings[0].createdAt.getTime();
    days = Math.min(365, Math.max(1, Math.ceil((Date.now() - first) / 86400000) + 1));
  }

  // Build per-day buckets keyed by YYYY-MM-DD.
  const buckets: Record<string, { critical: number; high: number; medium: number; low: number; info: number; total: number }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };
  }

  for (const f of findings) {
    const key = f.createdAt.toISOString().slice(0, 10);
    if (key in buckets) {
      const sev = SEVERITIES.includes(f.severity) ? f.severity : "info";
      buckets[key][sev as keyof typeof buckets[string]]++;
      buckets[key].total++;
    }
  }

  const timeline = Object.entries(buckets).map(([date, counts]) => ({ date, ...counts }));

  // Totals across the whole range.
  const totals = SEVERITIES.reduce((acc, sev) => {
    acc[sev] = findings.filter((f) => f.severity === sev).length;
    return acc;
  }, {} as Record<string, number>);
  totals.total = findings.length;

  return NextResponse.json({ range, days, timeline, totals });
}
