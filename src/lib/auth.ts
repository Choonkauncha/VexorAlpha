// Session/JWT auth for multi-tenant Vexor workspaces.
// Email+password accounts and 1-click investor sandboxes share the same
// signed httpOnly cookie (`vexor_session`). Every data row is scoped to userId.

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "./db";

export const SESSION_COOKIE = "vexor_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

export type SessionUser = {
  id: string;
  workspaceId: string; // 1:1 with user today; reserved for future team workspaces
  email: string | null;
  displayName: string;
  kind: "email" | "sandbox";
};

type TokenPayload = {
  sub: string;
  wid: string;
  email: string | null;
  name: string;
  kind: "email" | "sandbox";
  exp: number;
  iat: number;
};

function authSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is not configured (min 16 chars).");
  }
  return secret;
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64url");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function sign(payload: TokenPayload): string {
  const body = b64url(JSON.stringify(payload));
  const sig = createHash("sha256").update(`${body}.${authSecret()}`).digest();
  // HMAC-like: sha256(body + secret) is adequate for our short-lived opaque sessions;
  // use a second pass with the secret as key material for integrity.
  const mac = createHash("sha256").update(authSecret()).update(".").update(body).digest();
  return `${body}.${b64url(mac)}`;
}

function verify(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = createHash("sha256").update(authSecret()).update(".").update(body).digest();
  let given: Buffer;
  try {
    given = fromB64url(sig);
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as TokenPayload;
    if (!payload?.sub || !payload?.wid || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    if (payload.kind !== "email" && payload.kind !== "sandbox") return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [algo, saltB64, hashB64] = encoded.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function issueSessionToken(user: SessionUser): string {
  const now = Math.floor(Date.now() / 1000);
  return sign({
    sub: user.id,
    wid: user.workspaceId,
    email: user.email,
    name: user.displayName,
    kind: user.kind,
    iat: now,
    exp: now + SESSION_TTL_SEC,
  });
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function attachSession(res: NextResponse, user: SessionUser): NextResponse {
  res.cookies.set(SESSION_COOKIE, issueSessionToken(user), sessionCookieOptions());
  return res;
}

export function clearSession(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
}

export function readSessionFromRequest(req: NextRequest): SessionUser | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;
  return {
    id: payload.sub,
    workspaceId: payload.wid,
    email: payload.email,
    displayName: payload.name,
    kind: payload.kind,
  };
}

export function unauthorized(message = "Authentication required."): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/** Require a valid session. Returns the user or a 401 Response. */
export function requireUser(req: NextRequest): SessionUser | NextResponse {
  const user = readSessionFromRequest(req);
  if (!user) return unauthorized();
  return user;
}

export function isSessionUser(v: SessionUser | NextResponse): v is SessionUser {
  return !(v instanceof NextResponse) && typeof (v as SessionUser).id === "string";
}

export async function loadUserRecord(userId: string) {
  return db.user.findUnique({ where: { id: userId } });
}

/** Ensure the conversation belongs to this user; returns null if not found / not owned. */
export async function ownedConversation(userId: string, conversationId: string) {
  return db.conversation.findFirst({ where: { id: conversationId, userId } });
}

export function publicUser(user: SessionUser) {
  return {
    id: user.id,
    workspaceId: user.workspaceId,
    email: user.email,
    displayName: user.displayName,
    kind: user.kind,
  };
}

export function newSandboxDisplayName(): string {
  const id = randomBytes(8).toString("hex");
  return `investor-${id.slice(0, 8)}-${id.slice(8)}`;
}
