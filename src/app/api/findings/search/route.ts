// GET /api/findings/search?q=<query> — search findings across ALL conversations.
// Returns matching findings with their conversation details, so the UI can
// show which audit each finding belongs to.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ results: [] });

  const lowerQ = q.toLowerCase();

  // Fetch all findings with conversation details.
  const findings = await db.finding.findMany({
    where: { falsePositive: false },
    include: { conversation: { select: { id: true, title: true } } },
    orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
    take: 1000,
  });

  // Filter in JS (SQLite LIKE is case-sensitive for non-ASCII).
  const results = findings
    .filter((f) =>
      f.type.toLowerCase().includes(lowerQ) ||
      f.value.toLowerCase().includes(lowerQ) ||
      f.location.toLowerCase().includes(lowerQ) ||
      f.category.toLowerCase().includes(lowerQ) ||
      f.conversation.title.toLowerCase().includes(lowerQ)
    )
    .map((f) => ({
      fingerprint: f.fingerprint,
      conversationId: f.conversation.id,
      conversationTitle: f.conversation.title,
      type: f.type,
      category: f.category,
      severity: f.severity,
      value: f.value,
      masked: f.masked,
      location: f.location,
      sourceTool: f.sourceTool,
      createdAt: f.createdAt,
    }));

  return NextResponse.json({ results, query: q, count: results.length });
}
