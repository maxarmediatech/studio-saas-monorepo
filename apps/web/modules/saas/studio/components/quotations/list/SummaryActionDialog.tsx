import type { QuoteSummary } from "@repo/api/modules/studio/schemas/quote";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Loader2Icon } from "lucide-react";

export type SummaryAction = {
	quote: QuoteSummary;
	action: "send" | "revise";
};

export function SummaryActionDialog({
	pending,
	mutationPending,
	onOpenChange,
	onConfirm,
}: {
	pending: SummaryAction | null;
	mutationPending: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}) {
	const sending = pending?.action === "send";
	return (
		<AlertDialog open={Boolean(pending)} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{sending
							? "Send this quotation?"
							: "Create a new revision?"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{sending
							? "Sending locks this draft’s commercial and operational content."
							: "The current version becomes superseded and a new editable draft is created."}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={mutationPending}
						onClick={onConfirm}
					>
						{mutationPending ? (
							<Loader2Icon
								className="animate-spin"
								data-icon="inline-start"
							/>
						) : null}
						{sending ? "Send quotation" : "Create revision"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
