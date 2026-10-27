// DELETE /api/conversations/[id]/messages/[msgId] — delete a single message.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSessionUser, ownedConversation, requireUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; msgId: string }> }) {
  const user = requireUser(req);
  if (!isSessionUser(user)) return user;
  const { id, msgId } = await ctx.params;
  const owned = await ownedConversation(user.id, id);
  if (!owned) return NextResponse.json({ error: "message not found" }, { status: 404 });
  try {
    await db.message.delete({ where: { id: msgId, conversationId: id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "message not found" }, { status: 404 });
  }
}
