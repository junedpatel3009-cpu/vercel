import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminTableProps {
  headers: string[];
  children: ReactNode;
  className?: string;
  emptyState?: ReactNode;
}

export function AdminTable({ headers, children, className, emptyState }: AdminTableProps) {
  if (!children || (Array.isArray(children) && children.length === 0)) {
    return emptyState || (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm font-medium text-muted-foreground">No records found</p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[800px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 transition-colors">
            {headers.map((header, index) => (
              <th
                key={header}
                className={cn(
                  "px-6 py-4 text-left font-bold uppercase tracking-wider text-muted-foreground text-[10px]",
                  index === headers.length - 1 && "text-right"
                )}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {children}
        </tbody>
      </table>
    </div>
  );
}

interface AdminTableRowProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function AdminTableRow({ children, onClick, className }: AdminTableRowProps) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "group transition-all duration-200 hover:bg-muted/50",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </tr>
  );
}

interface AdminTableCellProps {
  children: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

export function AdminTableCell({ children, className, align = "left" }: AdminTableCellProps) {
  return (
    <td className={cn(
      "px-6 py-4 align-top",
      align === "right" && "text-right",
      align === "center" && "text-center",
      className
    )}>
      {children}
    </td>
  );
}
