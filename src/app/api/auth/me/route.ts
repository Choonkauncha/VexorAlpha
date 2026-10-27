import { NextRequest, NextResponse } from "next/server";
import { withJsonErrors } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { publicUser, readSessionFromRequest, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withJsonErrors(async (req: NextRequest) => {
  const session = readSessionFromRequest(req);
  if (!session) return unauthorized();
  const row = await db.user.findUnique({ where: { id: session.id } });
  if (!row) return unauthorized("Session expired. Please sign in again.");
  const user = {
    id: row.id,
    workspaceId: row.id,
    email: row.email,
    displayName: row.displayName,
    kind: (row.kind === "sandbox" ? "sandbox" : "email") as "email" | "sandbox",
  };
  return NextResponse.json({ user: publicUser(user) });
});
