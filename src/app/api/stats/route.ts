// GET /api/stats?range=7d|30d|all — aggregate dashboard stats across all conversations.
// The optional `range` param filters findings/exploits/toolCalls/messages by createdAt.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get("range") || "all";
  // Compute the cutoff date for time-range filters.
  let cutoff: Date | null = null;
  if (range === "7d") cutoff = new Date(Date.now() - 7 * 86400000);
  else if (range === "30d") cutoff = new Date(Date.now() - 30 * 86400000);

  // Conversations are always counted regardless of range (they're the container).
  // The child records (messages, findings, exploits, toolCalls) are filtered by range.
  const dateFilter = cutoff ? { createdAt: { gte: cutoff } } : {};

  const [convs, messages, findings, exploits, toolCalls] = await Promise.all([
    db.conversation.count(),
    db.message.count({ where: dateFilter }),
    db.finding.count({ where: dateFilter }),
    db.exploit.count({ where: dateFilter }),
    db.toolCall.count({ where: dateFilter }),
  ]);

  const findingsBySeverity = await db.finding.groupBy({ by: ["severity"], _count: true, where: dateFilter });
  const exploitsBySeverity = await db.exploit.groupBy({ by: ["severity"], _count: true, where: dateFilter });
  const toolUsage = await db.toolCall.groupBy({ by: ["name"], _count: true, where: dateFilter, orderBy: { _count: { name: "desc" } } });
  const findingsByCategory = await db.finding.groupBy({ by: ["category"], _count: true, where: dateFilter });

  const sev = (rows: { severity: string; _count: number }[]) =>
    rows.reduce((acc, r) => { acc[r.severity] = r._count; return acc; }, {} as Record<string, number>);

  // Also compute a daily activity sparkline for the range (count of records per day).
  let activity: { date: string; count: number }[] = [];
  if (range !== "all") {
    const days = range === "7d" ? 7 : 30;
    const buckets: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    // Fetch messages + findings + exploits + toolCalls createdAt in the range.
    const [msgs, finds, expts, tcs] = await Promise.all([
      db.message.findMany({ where: dateFilter, select: { createdAt: true } }),
      db.finding.findMany({ where: dateFilter, select: { createdAt: true } }),
      db.exploit.findMany({ where: dateFilter, select: { createdAt: true } }),
      db.toolCall.findMany({ where: dateFilter, select: { createdAt: true } }),
    ]);
    for (const r of [...msgs, ...finds, ...expts, ...tcs]) {
      const key = r.createdAt.toISOString().slice(0, 10);
      if (key in buckets) buckets[key]++;
    }
    activity = Object.entries(buckets).map(([date, count]) => ({ date, count }));
  }

  return NextResponse.json({
    conversations: convs,
    messages,
    findings,
    exploits,
    toolCalls,
    range,
    findingsBySeverity: sev(findingsBySeverity as any),
    exploitsBySeverity: sev(exploitsBySeverity as any),
    findingsByCategory: findingsByCategory.reduce((acc, r) => { acc[r.category] = r._count; return acc; }, {} as Record<string, number>),
    toolUsage: toolUsage.map((t) => ({ name: t.name, count: t._count })),
    activity,
  });
}
