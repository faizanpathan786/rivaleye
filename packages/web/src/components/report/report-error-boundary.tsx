import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: Error };

export class ReportErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ReportErrorBoundary]", error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong rendering the report</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p className="text-sm">The report data loaded but could not be displayed.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).then(() => {
                  toast.success("Link copied!");
                }).catch(() => void 0);
              }}
            >
              Copy report link
            </Button>
          </AlertDescription>
        </Alert>
      );
    }
    return this.props.children;
  }
}
