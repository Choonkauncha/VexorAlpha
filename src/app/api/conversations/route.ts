// GET  /api/conversations          — list summaries
// POST /api/conversations          — create { title? }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withJsonErrors } from "@/lib/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withJsonErrors(async function GET(req: NextRequest) {
  // `?includeArchived=1` shows archived convs too; by default they're hidden.
  const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "1";
  const convs = await db.conversation.findMany({
    where: includeArchived ? {} : { archived: false },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    include: {
      _count: { select: { messages: true, findings: true, exploits: true } },
      tags: true,
    },
  });
  return NextResponse.json(
    convs.map((c) => ({
      id: c.id,
      title: c.title,
      pinned: c.pinned,
      favorited: c.favorited,
      archived: c.archived,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: c._count.messages,
      findingCount: c._count.findings,
      exploitCount: c._count.exploits,
      tags: c.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    })),
  );
});

export const POST = withJsonErrors(async function POST(req: NextRequest) {
  let title = "New conversation";
  try {
    const body = await req.json();
    if (body && typeof body.title === "string" && body.title.trim()) title = body.title.trim().slice(0, 120);
  } catch {
    /* empty body is fine */
  }
  const conv = await db.conversation.create({ data: { title } });
  return NextResponse.json({ id: conv.id, title: conv.title, pinned: conv.pinned, createdAt: conv.createdAt, updatedAt: conv.updatedAt });
});
