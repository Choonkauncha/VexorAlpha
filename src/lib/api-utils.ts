import { NextResponse } from "next/server";

// Wraps a route handler so that ANY thrown error (Prisma connection failure,
// missing DATABASE_URL, bad JSON body, etc.) always produces a valid JSON
// response instead of an uncaught exception. An uncaught throw inside a Next.js
// route handler can result in a response with an empty body under some
// runtimes/hosts, which breaks any client code doing `await res.json()`
// with `Unexpected end of JSON input`. This guarantees that never happens.
export function withJsonErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err: any) {
      console.error("[api] unhandled route error:", err);
      const message =
        err?.code === "P1001" || /can't reach database|connect ECONNREFUSED/i.test(err?.message || "")
          ? "Database is unreachable. Check that DATABASE_URL is set and the database is running."
          : err?.message || "Internal server error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
