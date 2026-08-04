import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { PageContent } from "@saas/studio";
import {
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	Loader2Icon,
} from "lucide-react";
import { EDITOR_STEPS, type EditorStep } from "./types";

export function EditorNavigation({
	stepIndex,
	pending,
	onStep,
	onSave,
}: {
	stepIndex: number;
	pending: boolean;
	onStep: (step: EditorStep) => void;
	onSave: () => void;
}) {
	return (
		<div className="flex items-center justify-between border-t pt-5">
			<Button
				type="button"
				variant="outline"
				disabled={stepIndex === 0}
				onClick={() =>
					onStep(EDITOR_STEPS[stepIndex - 1]?.id ?? "proposal")
				}
			>
				<ChevronLeftIcon data-icon="inline-start" /> Back
			</Button>
			{stepIndex < EDITOR_STEPS.length - 1 ? (
				<Button
					type="button"
					onClick={() =>
						onStep(EDITOR_STEPS[stepIndex + 1]?.id ?? "review")
					}
				>
					Continue <ChevronRightIcon data-icon="inline-end" />
				</Button>
			) : (
				<Button type="button" onClick={onSave} disabled={pending}>
					{pending ? (
						<Loader2Icon
							className="animate-spin"
							data-icon="inline-start"
						/>
					) : (
						<CheckIcon data-icon="inline-start" />
					)}
					Save draft
				</Button>
			)}
		</div>
	);
}

export function EditorSkeleton() {
	return (
		<PageContent title="Loading quotation…">
			<div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
				<Skeleton className="h-80" />
				<div className="flex flex-col gap-4">
					<Skeleton className="h-10 w-56" />
					<Skeleton className="h-72" />
					<Skeleton className="h-12" />
				</div>
			</div>
		</PageContent>
	);
}
