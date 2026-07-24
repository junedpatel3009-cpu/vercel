import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReportExportActionsProps {
  table: string;
  reportName: string;
  filters?: Record<string, unknown>;
  onPrint?: () => void;
  variant?: "outline" | "secondary" | "default";
  size?: "default" | "sm" | "lg";
}

export function ReportExportActions({
  table,
  reportName,
  filters = {},
  onPrint,
  variant = "outline",
  size = "sm",
}: ReportExportActionsProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function exportReport(format: "CSV" | "EXCEL" | "PDF") {
    setDownloading(format);
    try {
      const res = await fetch("/api/v1/reports/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table,
          format,
          reportName,
          filters,
        }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));

      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename=(?:"?)([^";]+)/);
      const fileName = filenameMatch ? filenameMatch[1].replace(/"/g, "") : `${table}-${format.toLowerCase()}.bin`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => exportReport("CSV")}
        disabled={!!downloading}
      >
        {downloading === "CSV" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
        CSV
      </Button>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => exportReport("EXCEL")}
        disabled={!!downloading}
      >
        {downloading === "EXCEL" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Excel
      </Button>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => exportReport("PDF")}
        disabled={!!downloading}
      >
        {downloading === "PDF" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
        PDF
      </Button>
      {onPrint && (
        <Button type="button" variant="secondary" size={size} onClick={onPrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      )}
    </div>
  );
}
