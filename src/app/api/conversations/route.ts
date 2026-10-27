// GET  /api/conversations          — list summaries (scoped to caller)
// POST /api/conversations          — create { title? }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withJsonErrors } from "@/lib/api-utils";
import { isSessionUser, requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withJsonErrors(async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!isSessionUser(user)) return user;
  const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "1";
  const convs = await db.conversation.findMany({
    where: { userId: user.id, ...(includeArchived ? {} : { archived: false }) },
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
  const user = requireUser(req);
  if (!isSessionUser(user)) return user;
  let title = "New conversation";
  try {
    const body = await req.json();
    if (body && typeof body.title === "string" && body.title.trim()) title = body.title.trim().slice(0, 120);
  } catch {
    /* empty body is fine */
  }
  const conv = await db.conversation.create({ data: { title, userId: user.id } });
  return NextResponse.json({ id: conv.id, title: conv.title, pinned: conv.pinned, createdAt: conv.createdAt, updatedAt: conv.updatedAt });
});
