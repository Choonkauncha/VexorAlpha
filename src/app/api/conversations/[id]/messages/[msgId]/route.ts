// DELETE /api/conversations/[id]/messages/[msgId] — delete a single message.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; msgId: string }> }) {
  const { id, msgId } = await ctx.params;
  try {
    await db.message.delete({ where: { id: msgId, conversationId: id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "message not found" }, { status: 404 });
  }
}
