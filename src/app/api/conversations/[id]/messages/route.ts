import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withJsonErrors } from "@/lib/api-utils";

export const runtime = "nodejs";

// Remove a transcript tail atomically. Never use UI indexes: streamed bubbles
// and persisted messages do not have a one-to-one relationship.
export const DELETE = withJsonErrors(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = await req.json();
  if (!body || (body.all !== true && typeof body.fromMessageId !== "string")) {
    return NextResponse.json({ error: "Specify all: true or a fromMessageId." }, { status: 400 });
  }
  return db.$transaction(async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id }, select: { id: true } });
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const messages = await tx.message.findMany({ where: { conversationId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true } });
    const start = body.all === true ? 0 : messages.findIndex((message) => message.id === body.fromMessageId);
    if (start < 0) return NextResponse.json({ error: "Message not found in this conversation." }, { status: 404 });
    const result = await tx.message.deleteMany({ where: { conversationId: id, id: { in: messages.slice(start).map((message) => message.id) } } });
    await tx.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    return NextResponse.json({ ok: true, deleted: result.count });
  });
});
