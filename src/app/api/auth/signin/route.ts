import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withJsonErrors } from "@/lib/api-utils";
import { attachSession, publicUser, verifyPassword, type SessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

export const POST = withJsonErrors(async (req: NextRequest) => {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Email and password required." }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.kind !== "email" || !user.passwordHash) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  if (!verifyPassword(parsed.data.password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  const session: SessionUser = {
    id: user.id,
    workspaceId: user.id,
    email: user.email,
    displayName: user.displayName,
    kind: "email",
  };
  return attachSession(NextResponse.json({ user: publicUser(session) }), session);
});
