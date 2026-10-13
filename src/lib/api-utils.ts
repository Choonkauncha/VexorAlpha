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
      if (err instanceof SyntaxError) {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
      }
      if (err?.code === "P2025") {
        return NextResponse.json({ error: "Record not found." }, { status: 404 });
      }
      const databaseError = /^P\d{4}$/.test(err?.code || "") || /DATABASE_URL|PrismaClientInitializationError|can't reach database|connect ECONNREFUSED/i.test(err?.message || "");
      return NextResponse.json({ error: databaseError
        ? "Database unavailable. Check the database connection and schema configuration."
        : "The request could not be completed. Please try again." }, { status: databaseError ? 503 : 500 });
    }
  };
}
