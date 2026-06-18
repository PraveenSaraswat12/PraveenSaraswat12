import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { generateSampleRecords, sampleRecordsToCsv } from "@/lib/sample-data";

const DEMO_PASSWORD = "Smytten@123";

const DEMO_USERS = [
  { email: "exec@smytten.com", name: "Aarav (Ops Exec)", role: Role.OPS_EXEC },
  { email: "lead@smytten.com", name: "Priya (Ops Lead)", role: Role.OPS_LEAD },
  { email: "finance@smytten.com", name: "Rahul (Finance)", role: Role.FINANCE },
  { email: "vendor@smytten.com", name: "Delhivery (Vendor)", role: Role.VENDOR },
];

async function main() {
  const passwordHash = await hash(DEMO_PASSWORD, 10);

  for (const u of DEMO_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { email: u.email, name: u.name, role: u.role, passwordHash },
    });
  }
  console.log(`✓ ${DEMO_USERS.length} demo users (password: ${DEMO_PASSWORD})`);

  const existingBatches = await prisma.uploadBatch.count();
  if (existingBatches === 0) {
    const exec = await prisma.user.findUnique({
      where: { email: "exec@smytten.com" },
    });
    const records = generateSampleRecords({ count: 3200 });

    const batch = await prisma.uploadBatch.create({
      data: {
        fileName: "sample-delhivery-mis.csv",
        rowCount: records.length,
        sourceHeader: "(synthetic sample data)",
        uploadedById: exec?.id ?? null,
      },
    });

    await prisma.deliveryRecord.createMany({
      data: records.map((r) => ({ ...r, batchId: batch.id })),
    });
    console.log(`✓ Seeded ${records.length} delivery records into batch ${batch.id}`);

    // Write a smaller downloadable sample CSV for manual upload testing.
    try {
      const sampleCsv = sampleRecordsToCsv(
        generateSampleRecords({ count: 300, seed: 7 })
      );
      const publicDir = join(process.cwd(), "public");
      mkdirSync(publicDir, { recursive: true });
      writeFileSync(join(publicDir, "sample-delhivery-mis.csv"), sampleCsv);
      console.log("✓ Wrote public/sample-delhivery-mis.csv");
    } catch (e) {
      console.warn("Could not write sample CSV:", (e as Error).message);
    }
  } else {
    console.log(`• ${existingBatches} upload batch(es) already present — skipping sample data`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
