import { Button } from "@repo/ui/components/button";
import { Loader2Icon } from "lucide-react";

interface FormActionsProps {
  mode: "create" | "edit";
  isSubmitting: boolean;
  submitLabel?: string;
}

export function FormActions({
  mode,
  isSubmitting,
  submitLabel,
}: FormActionsProps) {
  const defaultLabel = mode === "edit" ? "Save Changes" : "Create";

  return (
    <div className="pt-6">
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
        {submitLabel ?? defaultLabel}
      </Button>
    </div>
  );
}
