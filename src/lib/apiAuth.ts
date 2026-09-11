import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

/**
 * Guards an API route handler. Returns the session when authenticated, or a
 * 401 JSON response to return directly when not.
 *
 * Usage:
 *   const auth = await requireSession();
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 }
    );
  }
  return session;
}
