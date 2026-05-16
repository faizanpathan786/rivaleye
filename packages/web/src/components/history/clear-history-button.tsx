import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// TODO: implement bulk delete once the API supports DELETE /v1/reports (or bulk endpoint).
export function ClearHistoryButton() {
  return (
    <Button
      variant="destructive"
      size="sm"
      disabled
      title="Bulk delete not yet supported"
    >
      <Trash2 className="mr-2 h-4 w-4" />
      Clear history
    </Button>
  );
}
