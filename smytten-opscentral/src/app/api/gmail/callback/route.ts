import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCode } from "@/lib/email/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = cookies().get("gmail_oauth_state")?.value;

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/email?error=${reason}`, req.url));

  if (url.searchParams.get("error")) return fail("oauth_denied");
  if (!code || !state || state !== cookieState) return fail("oauth_state");

  try {
    const tokens = await exchangeCode(code);

    const existing = await prisma.gmailConnection.findFirst({
      where: { userId: session.user.id },
    });
    const data = {
      userId: session.user.id,
      email: tokens.email,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    };
    if (existing) {
      await prisma.gmailConnection.update({ where: { id: existing.id }, data });
    } else {
      await prisma.gmailConnection.create({ data });
    }

    const res = NextResponse.redirect(new URL("/email?connected=1", req.url));
    res.cookies.set("gmail_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  } catch (e) {
    console.error("Gmail OAuth callback failed:", e);
    return fail("oauth_failed");
  }
}
