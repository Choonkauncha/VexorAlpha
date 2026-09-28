// GET /api/search?q=<query> — full-text search across all conversations'
// messages + titles. Returns matching conversation summaries with highlighted
// snippets so the sidebar can show why each conversation matched.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ results: [] });

  // SQLite is case-sensitive by default for non-ASCII, but for ASCII we use
  // lowercased comparison. Fetch all messages + conversations and filter in
  // JS to keep it simple and correct (the dataset is small).
  const lowerQ = q.toLowerCase();

  const allMsgs = await db.message.findMany({
    include: { conversation: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // Group by conversation, capture the first matching snippet per conv.
  const byConv = new Map<string, { conv: typeof allMsgs[number]["conversation"]; snippet: string; matchCount: number }>();
  for (const m of allMsgs) {
    const lower = m.content.toLowerCase();
    if (!lower.includes(lowerQ)) continue;
    const existing = byConv.get(m.conversationId);
    if (existing) {
      existing.matchCount++;
      continue;
    }
    // Extract a snippet around the first match.
    const idx = lower.indexOf(lowerQ);
    const start = Math.max(0, idx - 40);
    const end = Math.min(m.content.length, idx + q.length + 60);
    const snippet = (start > 0 ? "…" : "") + m.content.slice(start, end) + (end < m.content.length ? "…" : "");
    byConv.set(m.conversationId, { conv: m.conversation, snippet, matchCount: 1 });
  }

  // Also match by title (not already in the map).
  const allConvs = await db.conversation.findMany({ orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }] });
  for (const c of allConvs) {
    if (byConv.has(c.id)) continue;
    if (c.title.toLowerCase().includes(lowerQ)) {
      byConv.set(c.id, { conv: c, snippet: "(title match)", matchCount: 0 });
    }
  }

  const results = Array.from(byConv.values()).map(({ conv, snippet, matchCount }) => ({
    id: conv.id,
    title: conv.title,
    pinned: conv.pinned,
    updatedAt: conv.updatedAt,
    snippet,
    matchCount,
  }));

  // Sort: pinned first, then most recent.
  results.sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (b.updatedAt.getTime() - a.updatedAt.getTime()));

  return NextResponse.json({ results, query: q });
}
