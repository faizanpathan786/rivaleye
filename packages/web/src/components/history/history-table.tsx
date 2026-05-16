import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/report/status-badge";
import { GOAL_LABELS } from "@/lib/goal-labels";
import type { LocalHistoryEntry } from "@/lib/local-history";
import type { ReportGoal, ReportStatus } from "@rivaleye/shared";

type HistoryRow = LocalHistoryEntry & {
  status?: ReportStatus;
};

export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Competitor</TableHead>
          <TableHead>Goal</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Open</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.competitor}</TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {GOAL_LABELS[row.goal as ReportGoal] ?? row.goal}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(row.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell>
              {row.status ? (
                <StatusBadge status={row.status} />
              ) : (
                <span className="text-xs text-muted-foreground">unknown</span>
              )}
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
