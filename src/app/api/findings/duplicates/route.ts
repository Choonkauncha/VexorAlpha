// GET /api/findings/duplicates — cross-audit duplicates within the caller's workspace.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSessionUser, requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!isSessionUser(user)) return user;

  const findings = await db.finding.findMany({
    where: { conversation: { userId: user.id } },
    select: {
      id: true,
      fingerprint: true,
      category: true,
      type: true,
      value: true,
      masked: true,
      severity: true,
      location: true,
      sourceTool: true,
      createdAt: true,
      conversation: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const byValue = new Map<string, typeof findings>();
  for (const f of findings) {
    const arr = byValue.get(f.value) || [];
    arr.push(f);
    byValue.set(f.value, arr);
  }

  const groups: {
    value: string; masked: string; type: string; category: string; severity: string;
    occurrenceCount: number; conversationCount: number;
    occurrences: { findingId: string; conversationId: string; conversationTitle: string;
      location: string; sourceTool: string; severity: string; createdAt: Date }[];
  }[] = [];
  for (const [value, items] of byValue) {
    const convIds = new Set(items.map((f) => f.conversation.id));
    if (convIds.size < 2) continue;
    const sevRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    const topSev = items.reduce((min, f) => (sevRank[f.severity] < sevRank[min] ? f.severity : min), "info");
    groups.push({
      value,
      masked: items[0].masked,
      type: items[0].type,
      category: items[0].category,
      severity: topSev,
      occurrenceCount: items.length,
      conversationCount: convIds.size,
      occurrences: items.map((f) => ({
        findingId: f.fingerprint,
        conversationId: f.conversation.id,
        conversationTitle: f.conversation.title,
        location: f.location,
        sourceTool: f.sourceTool,
        severity: f.severity,
        createdAt: f.createdAt,
      })),
    });
  }

  const sevRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  groups.sort((a, b) => (b.conversationCount - a.conversationCount) || (sevRank[a.severity] - sevRank[b.severity]));

  return NextResponse.json({
    groups,
    totalDuplicates: groups.length,
    totalOccurrences: groups.reduce((s, g) => s + g.occurrenceCount, 0),
  });
}
