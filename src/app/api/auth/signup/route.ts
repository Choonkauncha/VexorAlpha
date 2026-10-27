import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withJsonErrors } from "@/lib/api-utils";
import { attachSession, hashPassword, publicUser, type SessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(80).optional(),
});

export const POST = withJsonErrors(async (req: NextRequest) => {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid email and password (8+ chars) required." }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  const displayName = parsed.data.displayName || email.split("@")[0];
  const user = await db.user.create({
    data: {
      email,
      passwordHash: hashPassword(parsed.data.password),
      displayName,
      kind: "email",
    },
  });
  const session: SessionUser = {
    id: user.id,
    workspaceId: user.id,
    email: user.email,
    displayName: user.displayName,
    kind: "email",
  };
  return attachSession(NextResponse.json({ user: publicUser(session) }), session);
});
