// POST /api/findings/false-positive — toggle the falsePositive flag on a finding.
// Body: { conversationId, fingerprint, falsePositive }
// Returns: { ok: true, falsePositive: boolean }
//
// Soft-delete: instead of removing a finding, mark it as a false positive so it
// can be filtered out of the active view but retained for the audit trail.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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
