import { createServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, redirect, useLoaderData, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowDownToLine,
  Briefcase,
  CreditCard,
  FileText,
  FolderKanban,
  LayoutGrid,
  RefreshCcw,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AdminReportExportButton } from "@/components/AdminReportExportButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/current-user.server";
import {
  getViewerReportsData,
  saveReportExport,
  type DashboardReportData,
  type ReportFilters,
} from "@/lib/reports.server";

// (backed up file - original content truncated for backup)
