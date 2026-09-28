// GET /api/findings/duplicates — find findings that appear across multiple
// conversations (the same leaked secret / token / key detected in different
// audits). Returns groups keyed by value, with the conversations each appears in.
//
// This is the "cross-audit secret detection" feature — surfaces secrets that
// keep reappearing, which often indicates an un-rotated credential or a
// systemic exposure.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Fetch all findings with their conversation titles.
  const findings = await db.finding.findMany({
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

  // Group by value (the actual secret). Masked values may collide for different
  // real values, so we group by the real value — only the group with >1
  // distinct conversation is a true cross-audit duplicate.
  const byValue = new Map<string, typeof findings>();
  for (const f of findings) {
    const arr = byValue.get(f.value) || [];
    arr.push(f);
    byValue.set(f.value, arr);
  }

  // Build duplicate groups: value appears in 2+ distinct conversations.
  const groups = [];
  for (const [value, items] of byValue) {
    const convIds = new Set(items.map((f) => f.conversation.id));
    if (convIds.size < 2) continue;
    // Pick the highest severity across all occurrences.
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

  // Sort by conversation count desc, then severity.
  const sevRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  groups.sort((a, b) => (b.conversationCount - a.conversationCount) || (sevRank[a.severity] - sevRank[b.severity]));

  return NextResponse.json({
    groups,
    totalDuplicates: groups.length,
    totalOccurrences: groups.reduce((s, g) => s + g.occurrenceCount, 0),
  });
}
