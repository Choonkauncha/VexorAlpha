// /api/conversations/[id]/tags
// POST   { name, color? } — add a tag to a conversation
// DELETE { name }         — remove a tag by name
// GET    — list all distinct tag names + colors across all conversations
//          (for the tag filter chips in the sidebar)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_COLORS = ["accent", "cyan", "warn", "danger", "ok"];

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // If id is "all", return all distinct tags across conversations.
  if (id === "all") {
    const tags = await db.conversationTag.findMany({
      select: { name: true, color: true },
      distinct: ["name"],
      orderBy: { name: "asc" },
    });
    // Also get the count of conversations per tag.
    const counts = await db.conversationTag.groupBy({
      by: ["name"],
      _count: true,
    });
    const countMap = new Map(counts.map((c) => [c.name, c._count]));
    return NextResponse.json({
      tags: tags.map((t) => ({ name: t.name, color: t.color, count: countMap.get(t.name) || 0 })),
    });
  }
  // Otherwise return tags for a specific conversation.
  const tags = await db.conversationTag.findMany({ where: { conversationId: id }, orderBy: { name: "asc" } });
  return NextResponse.json({ tags });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24);
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const color = VALID_COLORS.includes(body.color) ? body.color : "accent";
  try {
    const tag = await db.conversationTag.create({
      data: { conversationId: id, name, color },
    });
    return NextResponse.json({ ok: true, tag });
  } catch (e: any) {
    // unique constraint → tag already exists on this conversation
    if (String(e?.code || "").includes("P2002")) {
      return NextResponse.json({ ok: true, error: "already tagged" });
    }
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name query param required" }, { status: 400 });
  await db.conversationTag.deleteMany({ where: { conversationId: id, name } });
  return NextResponse.json({ ok: true });
}
