import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fileToCsvText, ingestCsvText } from "@/lib/csv/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "OPS_EXEC" && session.user.role !== "OPS_LEAD") {
    return NextResponse.json(
      { error: "You do not have permission to upload data." },
      { status: 403 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 25 MB)." },
      { status: 413 }
    );
  }

  let csvText: string;
  try {
    csvText = await fileToCsvText(file);
  } catch {
    return NextResponse.json(
      { error: "Could not read the file. Upload a Delhivery CSV or XLSX export." },
      { status: 400 }
    );
  }

  try {
    const result = await ingestCsvText({
      csvText,
      fileName: file.name,
      userId: session.user.id,
    });
    return NextResponse.json(result, { status: result.rejected ? 422 : 200 });
  } catch (e) {
    console.error("Upload ingest failed:", e);
    return NextResponse.json(
      { error: "Server error while importing the file." },
      { status: 500 }
    );
  }
}
