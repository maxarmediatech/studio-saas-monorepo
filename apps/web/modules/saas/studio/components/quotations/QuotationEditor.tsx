"use client";

import {
	type QuoteDraftContentInput,
	quoteDraftContentInputSchema,
} from "@repo/api/modules/studio/schemas/quote";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
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
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { PageContent } from "@saas/studio";
import { bookingFormQueries } from "@saas/studio/components/bookings/booking-form/booking-form-queries";
import { quotesApi, quotesMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, Loader2Icon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookingStep } from "./editor/BookingStep";
import { EditorNavigation, EditorSkeleton } from "./editor/EditorChrome";
import { OperationsStep } from "./editor/OperationsStep";
import { PricingStep } from "./editor/PricingStep";
import { ProposalStep } from "./editor/ProposalStep";
import { ReviewStep } from "./editor/ReviewStep";
import {
	EDITOR_STEPS,
	type EditorErrors,
	type EditorStep,
	type OptionDraft,
} from "./editor/types";
import {
	useQuotationAttachmentLifecycle,
	useQuotationNavigationGuard,
} from "./editor/useQuotationEditorSafety";
import {
	createEmptyQuoteDraft,
	getEditorErrorTarget,
	hasExcessiveDiscount,
	optionTotal,
	paymentSchedulesMatchOptionTotal,
	quoteDetailToDraft,
} from "./quotation-helpers";

export function QuotationEditor({
	organizationSlug,
	organizationTimezone,
	quoteId,
}: {
	organizationSlug: string;
	organizationTimezone: string;
	quoteId?: string;
}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [draft, setDraft] = useState<QuoteDraftContentInput>(
		createEmptyQuoteDraft,
	);
	const [step, setStep] = useState<EditorStep>("proposal");
	const [selectedOption, setSelectedOption] = useState(0);
	const [dirty, setDirty] = useState(false);
	const [loadedId, setLoadedId] = useState<string | null>(null);
	const [errors, setErrors] = useState<EditorErrors>({});
	const [discardOpen, setDiscardOpen] = useState(false);
	const [pendingNavigation, setPendingNavigation] = useState<string | null>(
		null,
	);
	const attachments = useQuotationAttachmentLifecycle();
	const detail = useQuery({
		...quotesApi.getOptions(quoteId ?? ""),
		enabled: Boolean(quoteId),
	});
	const clients = useQuery(bookingFormQueries.clients());
	const bookingTypes = useQuery(bookingFormQueries.bookingTypes());
	const packageTypes = useQuery(bookingFormQueries.packageTypes());
	const eventTypes = useQuery(bookingFormQueries.eventTypes());
	const crews = useQuery(bookingFormQueries.crews());
	const createMutation = useMutation(quotesMutations.create());
	const updateMutation = useMutation(quotesMutations.update());
	const pending = createMutation.isPending || updateMutation.isPending;
	const referenceQueries = [
		clients,
		bookingTypes,
		packageTypes,
		eventTypes,
		crews,
	];
	const referencesLoading = referenceQueries.some((query) => query.isLoading);
	const referenceError = referenceQueries.find(
		(query) => query.isError,
	)?.error;

	useEffect(() => {
		if (!quoteId || !detail.data?.data || loadedId === quoteId) {
			return;
		}
		if (detail.data.data.status !== "draft") {
			toast.error("Only draft quotations can be edited");
			router.replace(`/app/${organizationSlug}/quotations/${quoteId}`);
			return;
		}
		const savedDraft = quoteDetailToDraft(detail.data.data);
		setDraft(savedDraft);
		attachments.setInitialKeys(
			savedDraft.options.flatMap((option) =>
				option.bookingBlueprint.booking.contractAttachment?.key
					? [option.bookingBlueprint.booking.contractAttachment.key]
					: [],
			),
		);
		setLoadedId(quoteId);
		setDirty(false);
	}, [detail.data, loadedId, organizationSlug, quoteId, router]);

	useQuotationNavigationGuard({
		dirty,
		onBlocked: (target) => {
			setPendingNavigation(target);
			setDiscardOpen(true);
		},
	});

	const change = (next: QuoteDraftContentInput) => {
		setDraft(next);
		setDirty(true);
		setErrors({});
	};
	const patch = (value: Partial<QuoteDraftContentInput>) =>
		change({ ...draft, ...value });
	const updateOption = (
		index: number,
		updater: (option: OptionDraft) => OptionDraft,
	) => {
		const options = [...draft.options];
		const current = options[index];
		if (!current) {
			return;
		}
		options[index] = updater(structuredClone(current));
		change({ ...draft, options });
	};
	const currentOption = draft.options[selectedOption] ?? draft.options[0];

	const validate = () => {
		const result = quoteDraftContentInputSchema.safeParse(draft);
		const next: EditorErrors = {};
		if (!result.success) {
			for (const issue of result.error.issues) {
				const target = getEditorErrorTarget(issue.path);
				next[target.key] ??= issue.message;
			}
		}
		for (const [index, option] of draft.options.entries()) {
			if (hasExcessiveDiscount(option)) {
				next[`options.${index}.discountAmount`] =
					"Discount cannot exceed subtotal";
			}
			const schedules =
				option.bookingBlueprint.booking.paymentSchedules ?? [];
			const total = optionTotal(option);
			if (
				schedules.length > 0 &&
				!paymentSchedulesMatchOptionTotal(option)
			) {
				next[`options.${index}.paymentSchedules`] =
					hasExcessiveDiscount(option)
						? "Schedules cannot match an option with an excessive discount."
						: Number.isFinite(total)
							? `Schedules must total ${total.toFixed(2)}.`
							: "Enter valid line amounts before matching the schedule total.";
			}
		}
		setErrors(next);
		const first = Object.keys(next)[0];
		if (first) {
			const target = getEditorErrorTarget(first.split("."));
			setStep(target.step);
			if (target.optionIndex !== undefined) {
				setSelectedOption(target.optionIndex);
			}
			window.requestAnimationFrame(() =>
				document.getElementById(target.controlId)?.focus(),
			);
		}
		return Object.keys(next).length === 0;
	};

	const save = async () => {
		if (!validate()) {
			toast.error("Review the highlighted fields before saving");
			return;
		}
		try {
			const result = quoteId
				? await updateMutation.mutateAsync({
						id: quoteId,
						content: draft,
					})
				: await createMutation.mutateAsync(draft);
			const currentKeys = draft.options.flatMap((option) =>
				option.bookingBlueprint.booking.contractAttachment?.key
					? [option.bookingBlueprint.booking.contractAttachment.key]
					: [],
			);
			const cleaned = await attachments.cleanupAfterSave(currentKeys);
			if (!cleaned) {
				toast.warning(
					"Draft saved, but an old uploaded document could not be cleaned up.",
				);
			}
			setDirty(false);
			await queryClient.invalidateQueries({
				queryKey: orpc.quotes.key(),
			});
			toast.success(
				quoteId ? "Draft updated" : "Draft saved on the server",
			);
			router.push(
				`/app/${organizationSlug}/quotations/${result.data.id}`,
			);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Could not save quotation draft",
			);
		}
	};
	const discard = async () => {
		const cleaned = await attachments.cleanupOnDiscard();
		if (!cleaned) {
			toast.error(
				"Could not clean the new upload. Try discarding again.",
			);
			return;
		}
		setDirty(false);
		router.push(
			pendingNavigation ??
				`/app/${organizationSlug}/quotations${quoteId ? `/${quoteId}` : ""}`,
		);
	};
	const stepIndex = EDITOR_STEPS.findIndex((item) => item.id === step);

	if ((quoteId && detail.isLoading) || referencesLoading) {
		return <EditorSkeleton />;
	}
	if ((quoteId && detail.isError) || referenceError) {
		const loadError = detail.error ?? referenceError;
		return (
			<PageContent
				title="Quotation unavailable"
				backHref={`/app/${organizationSlug}/quotations`}
			>
				<Alert variant="destructive">
					<AlertTriangleIcon />
					<AlertTitle>Could not load this quotation</AlertTitle>
					<AlertDescription className="flex items-center justify-between gap-3">
						{loadError instanceof Error
							? loadError.message
							: "Required quotation options could not be loaded."}
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								void Promise.all(
									referenceQueries.map((query) =>
										query.refetch(),
									),
								);
								if (quoteId) {
									void detail.refetch();
								}
							}}
						>
							Try again
						</Button>
					</AlertDescription>
				</Alert>
			</PageContent>
		);
	}

	return (
		<PageContent
			title={quoteId ? "Edit quotation draft" : "New quotation"}
			backHref={`/app/${organizationSlug}/quotations`}
			controls={
				<div className="flex gap-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() =>
							dirty ? setDiscardOpen(true) : void discard()
						}
					>
						Discard
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={save}
						disabled={pending}
					>
						{pending ? (
							<Loader2Icon
								className="animate-spin"
								data-icon="inline-start"
							/>
						) : (
							<SaveIcon data-icon="inline-start" />
						)}
						Save draft
					</Button>
				</div>
			}
			contentClassName="pt-0 lg:pt-0"
		>
			<div className="grid min-h-full lg:grid-cols-[13rem_minmax(0,1fr)]">
				<nav
					className="-mx-4 overflow-x-auto border-b px-4 py-3 lg:mx-0 lg:border-b-0 lg:border-r lg:px-0 lg:py-6"
					aria-label="Quotation editor steps"
				>
					<div className="flex gap-1 lg:flex-col lg:pr-5">
						{EDITOR_STEPS.map((item, index) => (
							<button
								key={item.id}
								type="button"
								onClick={() => setStep(item.id)}
								className={cn(
									"flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors active:scale-[.99]",
									step === item.id
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:bg-muted hover:text-foreground",
								)}
							>
								<span className="tabular-nums opacity-60">
									{index + 1}
								</span>
								{item.label}
							</button>
						))}
					</div>
				</nav>
				<main className="py-6 lg:pl-8">
					<div className="mx-auto flex max-w-4xl flex-col gap-6">
						{step === "proposal" && (
							<ProposalStep
								draft={draft}
								patch={patch}
								change={change}
								clients={clients.data?.data ?? []}
								errors={errors}
								organizationTimezone={organizationTimezone}
							/>
						)}
						{step === "pricing" && (
							<PricingStep
								draft={draft}
								selected={selectedOption}
								setSelected={setSelectedOption}
								change={change}
								updateOption={updateOption}
								errors={errors}
							/>
						)}
						{step === "booking" && currentOption && (
							<BookingStep
								option={currentOption}
								update={(booking) =>
									updateOption(selectedOption, (option) => ({
										...option,
										bookingBlueprint: {
											...option.bookingBlueprint,
											booking,
										},
									}))
								}
								bookingTypes={bookingTypes.data?.data ?? []}
								packageTypes={packageTypes.data?.data ?? []}
								onAttachmentUploaded={attachments.trackUpload}
								error={
									errors[`options.${selectedOption}.booking`]
								}
							/>
						)}
						{step === "operations" && currentOption && (
							<OperationsStep
								option={currentOption}
								update={(booking) =>
									updateOption(selectedOption, (option) => ({
										...option,
										bookingBlueprint: {
											...option.bookingBlueprint,
											booking,
										},
									}))
								}
								eventTypes={eventTypes.data?.data ?? []}
								crews={crews.data?.data ?? []}
								organizationTimezone={organizationTimezone}
								errors={errors}
								optionIndex={selectedOption}
								paymentError={
									errors[
										`options.${selectedOption}.paymentSchedules`
									]
								}
							/>
						)}
						{step === "review" && (
							<ReviewStep
								draft={draft}
								errors={errors}
								onGo={setStep}
							/>
						)}
						<EditorNavigation
							stepIndex={stepIndex}
							pending={pending}
							onStep={setStep}
							onSave={save}
						/>
					</div>
				</main>
			</div>
			<AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Discard unsaved changes?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Your last server-saved draft remains available.
							Changes made since then will be lost.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep editing</AlertDialogCancel>
						<AlertDialogAction onClick={() => void discard()}>
							Discard changes
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</PageContent>
	);
}
