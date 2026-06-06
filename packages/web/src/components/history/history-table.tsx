import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CompetitorAvatar } from "@/components/competitor-avatar";
import { StatusBadge } from "@/components/report/status-badge";
import { formatNumber, formatRelative } from "@/lib/format";
import type { ReportRow } from "@/api/reports";

type ReportStatus = "queued" | "running" | "completed" | "failed";

export function HistoryTable({ rows }: { rows: ReportRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Competitor</TableHead>
            <TableHead className="hidden md:table-cell">Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              Pain
            </TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              Mentions
            </TableHead>
            <TableHead className="hidden lg:table-cell">Last run</TableHead>
            <TableHead className="text-right">Open</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CompetitorAvatar name={row.primary_competitor_name ?? "?"} domain={row.primary_competitor_domain} size={24} borderRadius={5} />
                  <span className="truncate max-w-[160px]">{row.primary_competitor_name ?? "—"}</span>
                </div>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {row.category}
              </TableCell>
              <TableCell>
                <StatusBadge
                  status={(row.status as ReportStatus) ?? "queued"}
                />
              </TableCell>
              <TableCell className="hidden text-right font-mono tabular-nums text-destructive sm:table-cell">
                {row.sentiment_overall != null
                  ? row.sentiment_overall.toFixed(2)
                  : "—"}
              </TableCell>
              <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">
                {formatNumber(row.total_sources)}
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                {formatRelative(row.created_at)}
              </TableCell>
              <TableCell className="text-right">
                <Link
                  to={`/reports/${row.id}`}
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Open →
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function HistoryTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Competitor</TableHead>
            <TableHead className="hidden md:table-cell">Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              Pain
            </TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              Mentions
            </TableHead>
            <TableHead className="hidden lg:table-cell">Last run</TableHead>
            <TableHead className="text-right">Open</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="ml-auto h-4 w-12" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="ml-auto h-4 w-16" />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto h-4 w-12" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
