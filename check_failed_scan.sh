#!/bin/bash
# Check the last failed scan's job status
REPORT_ID="0ef28bd5-a448-4575-ab5b-bc69273f2a0"

echo "Checking report: $REPORT_ID"
echo ""
echo "=== Platform Jobs Status ==="

# We can't easily query via bun, so let's just check if the worker is actually running
pnpm --filter @rivaleye/worker dev:scrape &
WORKER_PID=$!
sleep 5
echo "Worker started with PID: $WORKER_PID"
sleep 10
kill $WORKER_PID 2>/dev/null || true
