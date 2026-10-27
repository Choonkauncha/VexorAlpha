// POST /api/findings/bulk — bulk delete findings by fingerprint (owned conversations only).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSessionUser, ownedConversation, requireUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!isSessionUser(user)) return user;
  let body: { conversationId?: string; fingerprints?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const conversationId = (body.conversationId || "").trim();
  const fingerprints = body.fingerprints || [];
  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  const owned = await ownedConversation(user.id, conversationId);
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!fingerprints.length) return NextResponse.json({ deleted: 0 });

  const result = await db.finding.deleteMany({
    where: { conversationId, fingerprint: { in: fingerprints } },
  });
  return NextResponse.json({ deleted: result.count });
}
