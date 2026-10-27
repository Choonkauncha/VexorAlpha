import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withJsonErrors } from "@/lib/api-utils";
import { attachSession, newSandboxDisplayName, publicUser, type SessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 1-click investor sandbox: provisions a cryptographically isolated tenant. */
export const POST = withJsonErrors(async () => {
  const displayName = newSandboxDisplayName();
  const user = await db.user.create({
    data: {
      email: null,
      passwordHash: null,
      displayName,
      kind: "sandbox",
    },
  });
  const session: SessionUser = {
    id: user.id,
    workspaceId: user.id,
    email: null,
    displayName: user.displayName,
    kind: "sandbox",
  };
  return attachSession(
    NextResponse.json({
      user: publicUser(session),
      message: "Isolated investor sandbox ready. Your workspace is private to this session.",
    }),
    session,
  );
});
