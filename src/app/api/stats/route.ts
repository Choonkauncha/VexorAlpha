// GET /api/stats?range=7d|30d|all — aggregate dashboard stats for the caller's workspace.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSessionUser, requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!isSessionUser(user)) return user;

  const range = req.nextUrl.searchParams.get("range") || "all";
  let cutoff: Date | null = null;
  if (range === "7d") cutoff = new Date(Date.now() - 7 * 86400000);
  else if (range === "30d") cutoff = new Date(Date.now() - 30 * 86400000);

  const dateFilter = cutoff ? { createdAt: { gte: cutoff } } : {};
  const owned = { conversation: { userId: user.id } };

  const [convs, messages, findings, exploits, toolCalls] = await Promise.all([
    db.conversation.count({ where: { userId: user.id } }),
    db.message.count({ where: { ...dateFilter, ...owned } }),
    db.finding.count({ where: { ...dateFilter, ...owned } }),
    db.exploit.count({ where: { ...dateFilter, ...owned } }),
    db.toolCall.count({ where: { ...dateFilter, ...owned } }),
  ]);

  const findingsBySeverity = await db.finding.groupBy({ by: ["severity"], _count: true, where: { ...dateFilter, ...owned } });
  const exploitsBySeverity = await db.exploit.groupBy({ by: ["severity"], _count: true, where: { ...dateFilter, ...owned } });
  const toolUsage = await db.toolCall.groupBy({ by: ["name"], _count: true, where: { ...dateFilter, ...owned }, orderBy: { _count: { name: "desc" } } });
  const findingsByCategory = await db.finding.groupBy({ by: ["category"], _count: true, where: { ...dateFilter, ...owned } });

  const sev = (rows: { severity: string; _count: number }[]) =>
    rows.reduce((acc, r) => { acc[r.severity] = r._count; return acc; }, {} as Record<string, number>);

  let activity: { date: string; count: number }[] = [];
  if (range !== "all") {
    const days = range === "7d" ? 7 : 30;
    const buckets: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    const [msgs, finds, expts, tcs] = await Promise.all([
      db.message.findMany({ where: { ...dateFilter, ...owned }, select: { createdAt: true } }),
      db.finding.findMany({ where: { ...dateFilter, ...owned }, select: { createdAt: true } }),
      db.exploit.findMany({ where: { ...dateFilter, ...owned }, select: { createdAt: true } }),
      db.toolCall.findMany({ where: { ...dateFilter, ...owned }, select: { createdAt: true } }),
    ]);
    for (const r of [...msgs, ...finds, ...expts, ...tcs]) {
      const key = r.createdAt.toISOString().slice(0, 10);
      if (key in buckets) buckets[key]++;
    }
    activity = Object.entries(buckets).map(([date, count]) => ({ date, count }));
  }

  return NextResponse.json({
    range,
    conversations: convs,
    messages,
    findings,
    exploits,
    toolCalls,
    findingsBySeverity: sev(findingsBySeverity),
    exploitsBySeverity: sev(exploitsBySeverity),
    findingsByCategory: findingsByCategory.reduce((acc, r) => { acc[r.category] = r._count; return acc; }, {} as Record<string, number>),
    toolUsage: toolUsage.map((t) => ({ name: t.name, count: t._count })),
    activity,
  });
}
