import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { scanInbox } from "@/lib/email/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = ["OPS_EXEC", "OPS_LEAD", "FINANCE"];

// Triggered manually from the Email page (session) or by a 6-hourly cron
// (Authorization: Bearer <CRON_SECRET>).
export async function POST(req: Request) {
  const authz = req.headers.get("authorization");
  const isCron =
    !!process.env.CRON_SECRET && authz === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    const session = await getServerSession(authOptions);
    if (!session?.user || !ALLOWED.includes(session.user.role)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await scanInbox();
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
