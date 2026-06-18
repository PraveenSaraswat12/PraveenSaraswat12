import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { gmailConfigured } from "@/lib/email/config";
import { buildAuthUrl } from "@/lib/email/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = ["OPS_EXEC", "OPS_LEAD", "FINANCE"];

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (!ALLOWED.includes(session.user.role)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (!gmailConfigured()) {
    return NextResponse.redirect(new URL("/email?error=gmail_not_configured", req.url));
  }

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
