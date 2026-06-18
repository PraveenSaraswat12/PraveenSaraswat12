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

  // Sample email extractions (pending review) so the queue is demoable
  // without a live Gmail connection.
  const existingExtractions = await prisma.emailExtraction.count();
  if (existingExtractions === 0) {
    const samples = [
      {
        category: "CHARGEBACK" as const,
        threadId: "sample-thread-cb-1",
        messageId: "sample-msg-cb-1",
        emailDate: new Date("2026-06-15T10:12:00Z"),
        subject: "Credit Note CN-2026-04412 raised against your account",
        fromAddress: "billing@shiprocket.in",
        gmailThreadUrl: "https://mail.google.com/mail/u/0/#all/sample-thread-cb-1",
        data: {
          cnNumber: "CN-2026-04412",
          amount: 1840,
          awb: "DL14829300471",
          reason: "Weight discrepancy on 3 shipments",
          raisedOn: "2026-06-15",
        },
        model: "claude-sonnet-4-6",
        confidence: 0.93,
        rawSnippet: "A credit note CN-2026-04412 of Rs. 1840 has been raised...",
      },
      {
        category: "COURIER_ESCALATION" as const,
        threadId: "sample-thread-esc-1",
        messageId: "sample-msg-esc-1",
        emailDate: new Date("2026-06-16T07:40:00Z"),
        subject: "Escalation: AWB DL14820391882 SLA breach",
        fromAddress: "escalations@delhivery.com",
        gmailThreadUrl: "https://mail.google.com/mail/u/0/#all/sample-thread-esc-1",
        data: {
          awb: "DL14820391882",
          issueType: "SLA breach",
          amount: null,
          slaBreached: true,
          summary: "Shipment delayed 6 days beyond SLA in Patna (800001)",
        },
        model: "claude-sonnet-4-6",
        confidence: 0.88,
        rawSnippet: "This is to escalate AWB DL14820391882 which has breached SLA...",
      },
      {
        category: "INWARD" as const,
        threadId: "sample-thread-inw-1",
        messageId: "sample-msg-inw-1",
        emailDate: new Date("2026-06-17T13:05:00Z"),
        subject: "Inward dispatch delay - 480 units",
        fromAddress: "warehouse@vendorco.in",
        gmailThreadUrl: "https://mail.google.com/mail/u/0/#all/sample-thread-inw-1",
        data: {
          brand: "Sample Brand",
          quantity: 480,
          expectedDate: "2026-06-14",
          actualDate: "2026-06-17",
          status: "delayed",
        },
        model: "claude-sonnet-4-6",
        confidence: 0.81,
        rawSnippet: "Inward for 480 units delayed; dispatch now expected 17 Jun...",
      },
    ];
    for (const s of samples) {
      await prisma.emailExtraction.create({ data: s });
    }
    console.log(`✓ Seeded ${samples.length} sample email extractions (pending review)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
