"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	CheckIcon,
	ExternalLinkIcon,
	Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";
import type { QuotationDraft, QuotationStepId } from "./quotation-wizard-data";

export function QuotationWizardFooter({
	activeIndex,
	activeStep,
	onNext,
	onPrevious,
	onSend,
	onOpenEditor,
	canSend,
	canOpenEditor,
	openingEditor,
}: {
	activeIndex: number;
	activeStep: QuotationStepId;
	onNext: () => void;
	onPrevious: () => void;
	onSend: () => void;
	onOpenEditor: () => void;
	canSend: boolean;
	canOpenEditor: boolean;
	openingEditor: boolean;
}) {
	return (
		<div className="flex items-center justify-between">
			<Button
				type="button"
				variant="outline"
				onClick={onPrevious}
				disabled={activeIndex === 0}
			>
				<ArrowLeftIcon className="mr-2 size-4" />
				Previous
			</Button>
			{activeStep === "preview" ? (
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={onOpenEditor}
						disabled={!canOpenEditor || openingEditor}
					>
						{openingEditor ? (
							<Loader2Icon className="mr-2 size-4 animate-spin" />
						) : (
							<ExternalLinkIcon className="mr-2 size-4" />
						)}
						Open in Editor
					</Button>
					<Button type="button" onClick={onSend} disabled={!canSend}>
						<CheckIcon className="mr-2 size-4" />
						Mark ready
					</Button>
				</div>
			) : (
				<Button type="button" onClick={onNext}>
					Next
					<ArrowRightIcon className="ml-2 size-4" />
				</Button>
			)}
		</div>
	);
}

export function QuotationConflictDialog({
	draft,
	onOpenChange,
	open,
}: {
	draft: QuotationDraft;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Quotation changed elsewhere
					</AlertDialogTitle>
					<AlertDialogDescription>
						Reload the server version or copy your unsaved values
						before reloading.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<Button
						variant="outline"
						onClick={async () => {
							try {
								await navigator.clipboard.writeText(
									JSON.stringify(draft, null, 2),
								);
								toast.success("Unsaved values copied");
							} catch {
								toast.error("Could not copy unsaved values");
							}
						}}
					>
						Copy my unsaved values
					</Button>
					<AlertDialogAction onClick={() => window.location.reload()}>
						Reload server version
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
