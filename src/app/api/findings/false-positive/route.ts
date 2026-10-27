// POST /api/findings/false-positive — toggle falsePositive on an owned finding.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSessionUser, ownedConversation, requireUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!isSessionUser(user)) return user;
  let body: { conversationId?: string; fingerprint?: string; falsePositive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const conversationId = (body.conversationId || "").trim();
  const fingerprint = (body.fingerprint || "").trim();
  if (!conversationId || !fingerprint) {
    return NextResponse.json({ error: "conversationId + fingerprint required" }, { status: 400 });
  }
  const owned = await ownedConversation(user.id, conversationId);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });
  const falsePositive = !!body.falsePositive;
  try {
    await db.finding.update({
      where: { conversationId_fingerprint: { conversationId, fingerprint } },
      data: { falsePositive },
    });
    return NextResponse.json({ ok: true, falsePositive });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "not found" }, { status: 404 });
  }
}
