import { format } from "date-fns";
import { Download } from "lucide-react";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { UploadCard } from "@/components/upload-card";
import { ChartCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { fmtNum } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function UploadsPage() {
  await requireRole(["OPS_EXEC", "OPS_LEAD"]);

  const batches = await prisma.uploadBatch.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 50,
    include: { uploadedBy: { select: { name: true, email: true } } },
  });

  return (
    <>
      <PageHeader
        title="CSV Uploads"
        description="Import Delhivery MIS exports (CSV or Excel) into OpsCentral."
      >
        <Button asChild variant="outline" size="sm">
          <a href="/sample-delhivery-mis.csv" download>
            <Download className="h-4 w-4" />
            Sample CSV
          </a>
        </Button>
      </PageHeader>

      <div className="space-y-6 p-4 sm:p-6">
        <UploadCard />

        <ChartCard
          title="Upload history"
          description={`${batches.length} most recent ${
            batches.length === 1 ? "import" : "imports"
          }`}
          bodyClassName="px-0 pb-0"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Uploaded</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead className="text-right">Skipped</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No uploads yet.
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(b.uploadedAt, "d MMM yyyy, HH:mm")}
                    </TableCell>
                    <TableCell className="max-w-[18rem] truncate font-medium">
                      {b.fileName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtNum(b.rowCount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {b.errorCount > 0 ? (
                        <span className="text-warning">{fmtNum(b.errorCount)}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.uploadedBy?.name || b.uploadedBy?.email || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ChartCard>
      </div>
    </>
  );
}
