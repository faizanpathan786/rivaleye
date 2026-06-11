import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reportsKeys } from "./use-reports";

/**
 * Poll a completed report for updates from background platform retries.
 *
 * After a report is marked "completed", background platform retries may
 * succeed and trigger a re-synthesis. This hook detects when the report
 * data changes and notifies the user via toast.
 *
 * Polling stops after 15 minutes (the background retry window).
 */
export function useReportUpdatePolling(
  reportId: string | undefined,
  isCompleted: boolean,
) {
  const qc = useQueryClient();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<string | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!reportId || !isCompleted) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Start polling from now if we haven't yet
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    pollingRef.current = setInterval(async () => {
      const elapsed = Date.now() - (startTimeRef.current || Date.now());
      const maxPollingTime = 15 * 60 * 1000; // 15 minutes

      // Stop polling after 15 minutes (background retry window is ~10 min)
      if (elapsed > maxPollingTime) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        return;
      }

      try {
        // Refetch the report detail to get updated_at timestamp
        await qc.refetchQueries({
          queryKey: reportsKeys.detail(reportId),
        });

        // Serialize the current section data to detect changes
        const cachedData = qc.getQueryData(reportsKeys.detail(reportId)) as any;
        const currentData = JSON.stringify({
          updated_at: cachedData?.updated_at,
          status: cachedData?.status,
        });

        if (lastDataRef.current && lastDataRef.current !== currentData) {
          // Data changed! Show toast and trigger refetch of all sections
          toast.success("Report updated with new data from background retries!");

          // Invalidate all section queries to force a refetch
          qc.invalidateQueries({ queryKey: reportsKeys.details() });

          // Stop polling since we detected an update
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }

        lastDataRef.current = currentData;
      } catch (err) {
        console.error("Error polling for report updates:", err);
      }
    }, 30 * 1000); // Poll every 30 seconds

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [reportId, isCompleted, qc]);
}
