// /api/conversations/[id]/tags
// POST   { name, color? } — add a tag to a conversation
// DELETE { name }         — remove a tag by name
// GET    — list tags (id=all → distinct tags across THIS user's conversations)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSessionUser, ownedConversation, requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_COLORS = ["accent", "cyan", "warn", "danger", "ok"];

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = requireUser(req);
  if (!isSessionUser(user)) return user;
  const { id } = await ctx.params;
  if (id === "all") {
    const tags = await db.conversationTag.findMany({
      where: { conversation: { userId: user.id } },
      select: { name: true, color: true },
      distinct: ["name"],
      orderBy: { name: "asc" },
    });
    const counts = await db.conversationTag.groupBy({
      by: ["name"],
      where: { conversation: { userId: user.id } },
      _count: true,
    });
    const countMap = new Map(counts.map((c) => [c.name, c._count]));
    return NextResponse.json({
      tags: tags.map((t) => ({ name: t.name, color: t.color, count: countMap.get(t.name) || 0 })),
    });
  }
  const owned = await ownedConversation(user.id, id);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });
  const tags = await db.conversationTag.findMany({ where: { conversationId: id }, orderBy: { name: "asc" } });
  return NextResponse.json({ tags });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = requireUser(req);
  if (!isSessionUser(user)) return user;
  const { id } = await ctx.params;
  const owned = await ownedConversation(user.id, id);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });
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
    if (String(e?.code || "").includes("P2002")) {
      return NextResponse.json({ ok: true, error: "already tagged" });
    }
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = requireUser(req);
  if (!isSessionUser(user)) return user;
  const { id } = await ctx.params;
  const owned = await ownedConversation(user.id, id);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });
  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name query param required" }, { status: 400 });
  await db.conversationTag.deleteMany({ where: { conversationId: id, name } });
  return NextResponse.json({ ok: true });
}
