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
import { StatusBadge } from "@/components/report/status-badge";
import { formatNumber, formatRelative } from "@/lib/format";
import type { ReportRow } from "@/api/reports";

type ReportStatus = "queued" | "running" | "completed" | "failed";

export function HistoryTable({ rows }: { rows: ReportRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Competitor</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Pain</TableHead>
          <TableHead className="text-right">Mentions</TableHead>
          <TableHead>Last run</TableHead>
          <TableHead className="text-right">Open</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">
              {row.primary_competitor_name ?? "—"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {row.category}
            </TableCell>
            <TableCell>
              <StatusBadge status={(row.status as ReportStatus) ?? "queued"} />
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-destructive">
              {row.sentiment_overall != null
                ? row.sentiment_overall.toFixed(2)
                : "—"}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {formatNumber(row.total_sources)}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
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
  );
}

export function HistoryTableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Competitor</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Pain</TableHead>
          <TableHead className="text-right">Mentions</TableHead>
          <TableHead>Last run</TableHead>
          <TableHead className="text-right">Open</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <Skeleton className="h-4 w-32" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="ml-auto h-4 w-12" />
            </TableCell>
            <TableCell>
              <Skeleton className="ml-auto h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="ml-auto h-4 w-12" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
