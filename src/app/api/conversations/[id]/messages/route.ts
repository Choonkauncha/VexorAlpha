import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withJsonErrors } from "@/lib/api-utils";
import { isSessionUser, ownedConversation, requireUser } from "@/lib/auth";

export const runtime = "nodejs";

// Remove a transcript tail atomically. Never use UI indexes: streamed bubbles
// and persisted messages do not have a one-to-one relationship.
export const DELETE = withJsonErrors(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = requireUser(req);
  if (!isSessionUser(user)) return user;
  const { id } = await ctx.params;
  const body = await req.json();
  if (!body || (body.all !== true && typeof body.fromMessageId !== "string")) {
    return NextResponse.json({ error: "Specify all: true or a fromMessageId." }, { status: 400 });
  }
  const owned = await ownedConversation(user.id, id);
  if (!owned) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  return db.$transaction(async (tx) => {
    const messages = await tx.message.findMany({ where: { conversationId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true } });
    const start = body.all === true ? 0 : messages.findIndex((message) => message.id === body.fromMessageId);
    if (start < 0) return NextResponse.json({ error: "Message not found in this conversation." }, { status: 404 });
    const result = await tx.message.deleteMany({ where: { conversationId: id, id: { in: messages.slice(start).map((message) => message.id) } } });
    await tx.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    return NextResponse.json({ ok: true, deleted: result.count });
  });
});
