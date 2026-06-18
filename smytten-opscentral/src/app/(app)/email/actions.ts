"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const ALLOWED = ["OPS_EXEC", "OPS_LEAD", "FINANCE"];

export async function reviewExtraction(
  id: string,
  decision: "CONFIRMED" | "REJECTED"
) {
  const session = await auth();
  if (!session?.user || !ALLOWED.includes(session.user.role)) {
    throw new Error("Unauthorized");
  }
  await prisma.emailExtraction.update({
    where: { id },
    data: {
      status: decision,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
    },
  });
  revalidatePath("/email");
}
