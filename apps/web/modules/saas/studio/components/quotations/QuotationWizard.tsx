"use client";

import { strictQuotationDocumentV1Schema } from "@repo/api/modules/studio/schemas/quotation-document";
import { BookingFormLayout } from "@saas/studio/components/bookings";
import { bookingFormQueries } from "@saas/studio/components/bookings/booking-form/booking-form-queries";
import { selectQuotationBootstrap } from "@saas/studio/components/configurations/apply-package-configuration";
import { quotesApi, quotesMutations } from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ClientStep, EventsStep } from "./quotation-client-events-steps";
import { PackagesStep } from "./quotation-package-deliverable-steps";
import { PreviewStep, TermsStep } from "./quotation-terms-preview-steps";
import { applyQuotationBootstrap } from "./quotation-wizard-bootstrap";
import { shouldAutosaveQuotationDraft } from "./quotation-wizard-conflict";
import {
	QuotationConflictDialog,
	QuotationWizardFooter,
} from "./quotation-wizard-controls";
import {
	createDefaultQuotationDraft,
	createDraftId,
	QUOTATION_STEPS,
	type QuotationDraft,
	type QuotationStepId,
} from "./quotation-wizard-data";
import {
	quotationDetailToWizardDraft,
	quotationDraftToDocument,
} from "./quotation-wizard-document";
import {
	QuotationMobileStepper,
	QuotationStepper,
} from "./quotation-wizard-parts";
import {
	fieldErrorMap,
	focusFirstQuotationError,
	type QuotationFieldError,
	validateQuotationDocument,
} from "./quotation-wizard-validation";
import { useQuotationWizardCollections } from "./use-quotation-wizard-collections";

type QuotationWizardProps = {
	organizationSlug: string;
	organizationTimezone: string;
	quoteId?: string;
};

function todayInTimezone(timezone: string): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

export function QuotationWizard({
	organizationSlug,
	organizationTimezone,
	quoteId,
}: QuotationWizardProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [draft, setDraft] = useState<QuotationDraft>(() =>
		createDefaultQuotationDraft(todayInTimezone(organizationTimezone)),
	);
	const [currentQuoteId, setCurrentQuoteId] = useState(quoteId);
	const [documentRevision, setDocumentRevision] = useState(0);
	const [loaded, setLoaded] = useState(!quoteId);
	const [dirty, setDirty] = useState(false);
	const [saveStatus, setSaveStatus] = useState<
		"Unsaved" | "Saving" | "Draft saved" | "Could not save"
	>(quoteId ? "Draft saved" : "Unsaved");
	const [conflictOpen, setConflictOpen] = useState(false);
	const [conflictPaused, setConflictPaused] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const editVersion = useRef(0);
	const defaultsApplied = useRef(false);
	const bookingTypes = useQuery(bookingFormQueries.bookingTypes());
	useQuery(bookingFormQueries.eventTypes());
	const packageTypes = useQuery(bookingFormQueries.packageTypes());
	const detail = useQuery({
		...quotesApi.getOptions(quoteId ?? ""),
		enabled: Boolean(quoteId),
	});
	const createMutation = useMutation(quotesMutations.createDocument());
	const saveMutation = useMutation(quotesMutations.saveDocument());
	const sendMutation = useMutation(quotesMutations.sendDocument());

	useEffect(() => {
		if (
			quoteId ||
			defaultsApplied.current ||
			!bookingTypes.data ||
			!packageTypes.data
		) {
			return;
		}
		defaultsApplied.current = true;
		const bootstrap = selectQuotationBootstrap(
			bookingTypes.data.data,
			packageTypes.data.data,
		);
		if (!bootstrap) {
			return;
		}
		const { bookingType, packageType } = bootstrap;
		setDraft((current) =>
			applyQuotationBootstrap(
				current,
				bookingType,
				packageType,
				createDraftId,
			),
		);
		editVersion.current += 1;
		setDirty(true);
		setSaveStatus("Unsaved");
	}, [bookingTypes.data, packageTypes.data, quoteId]);
	const [activeStep, setActiveStep] = useState<QuotationStepId>("client");

	const activeIndex = QUOTATION_STEPS.findIndex(
		(step) => step.id === activeStep,
	);
	const selectedPackage = useMemo(
		() =>
			draft.packages.find((pkg) => pkg.id === draft.selectedPackageId) ??
			draft.packages[0],
		[draft.packages, draft.selectedPackageId],
	);
	const completedSteps = useMemo(() => {
		return new Set<QuotationStepId>(
			QUOTATION_STEPS.slice(0, activeIndex + 1).map((step) => step.id),
		);
	}, [activeIndex]);

	const patchDraft = <K extends keyof QuotationDraft>(
		key: K,
		value: QuotationDraft[K],
	) => {
		setFieldErrors({});
		setDraft((current) => ({ ...current, [key]: value }));
		editVersion.current += 1;
		setDirty(true);
		setSaveStatus("Unsaved");
	};

	const showValidationErrors = (errors: QuotationFieldError[]) => {
		setFieldErrors(fieldErrorMap(errors));
		const first = errors[0];
		if (!first) {
			return;
		}
		focusFirstQuotationError(
			first,
			setActiveStep,
			(id) => document.getElementById(id),
			(callback) => window.requestAnimationFrame(callback),
		);
		toast.error(first.message);
	};

	useEffect(() => {
		if (!quoteId || !detail.data?.data || loaded) {
			return;
		}
		const loadedDraft = quotationDetailToWizardDraft(detail.data.data);
		if (!loadedDraft || detail.data.data.status !== "draft") {
			router.replace(`/app/${organizationSlug}/quotations/${quoteId}`);
			return;
		}
		setDraft(loadedDraft);
		setDocumentRevision(detail.data.data.documentRevision);
		setLoaded(true);
		setDirty(false);
		setSaveStatus("Draft saved");
	}, [detail.data, loaded, organizationSlug, quoteId, router]);

	const saveDraft = useCallback(
		async (snapshot: QuotationDraft = draft) => {
			if (
				!shouldAutosaveQuotationDraft({
					loaded,
					dirty: true,
					conflictPaused,
				})
			) {
				return null;
			}
			const capturedVersion = editVersion.current;
			setSaveStatus("Saving");
			try {
				const response = currentQuoteId
					? await saveMutation.mutateAsync({
							id: currentQuoteId,
							expectedDocumentRevision: documentRevision,
							document: quotationDraftToDocument(snapshot),
						})
					: await createMutation.mutateAsync({
							document: quotationDraftToDocument(snapshot),
						});
				const saved = response.data;
				setCurrentQuoteId(saved.id);
				setDocumentRevision(saved.documentRevision);
				setDraft((current) => ({
					...current,
					clients: current.clients.map((client) => {
						const persisted = saved.document.participants.find(
							(item) => item.key === client.id,
						);
						return persisted
							? {
									...client,
									clientId: persisted.clientId,
									clientUpdatedAt: persisted.clientUpdatedAt,
								}
							: client;
					}),
				}));
				if (!currentQuoteId) {
					window.history.replaceState(
						null,
						"",
						`/app/${organizationSlug}/quotations/${saved.id}/edit`,
					);
				}
				if (capturedVersion === editVersion.current) {
					setDirty(false);
					setSaveStatus("Draft saved");
				}
				return saved;
			} catch (error) {
				const message = error instanceof Error ? error.message : "";
				setSaveStatus("Could not save");
				if (/conflict|revision|stale/i.test(message)) {
					setConflictPaused(true);
					setConflictOpen(true);
				} else {
					toast.error("Could not save quotation", {
						description: message,
					});
				}
				return null;
			}
		},
		[
			createMutation,
			currentQuoteId,
			documentRevision,
			draft,
			loaded,
			conflictPaused,
			organizationSlug,
			saveMutation,
		],
	);

	useEffect(() => {
		if (
			!shouldAutosaveQuotationDraft({
				loaded,
				dirty,
				conflictPaused,
			})
		) {
			return;
		}
		const timeout = window.setTimeout(() => void saveDraft(), 800);
		return () => window.clearTimeout(timeout);
	}, [conflictPaused, dirty, loaded, saveDraft]);

	useEffect(() => {
		const protect = (event: BeforeUnloadEvent) => {
			if (!dirty) {
				return;
			}
			event.preventDefault();
		};
		window.addEventListener("beforeunload", protect);
		return () => window.removeEventListener("beforeunload", protect);
	}, [dirty]);

	const goToStep = async (step: QuotationStepId) => {
		const saved = dirty ? await saveDraft() : null;
		if (dirty && !saved) {
			return;
		}
		if (step === "preview") {
			const persisted =
				saved?.document ?? quotationDraftToDocument(draft);
			const errors = validateQuotationDocument(persisted);
			if (errors.length) {
				showValidationErrors(errors);
				return;
			}
		}
		setFieldErrors({});
		setActiveStep(step);
	};

	const goNext = async () => {
		if (activeStep === "preview") {
			return;
		}
		const errors = validateQuotationDocument(
			quotationDraftToDocument(draft),
			activeStep,
			{ allowUnresolvedClients: true },
		);
		if (errors.length) {
			showValidationErrors(errors);
			return;
		}
		const nextStep = QUOTATION_STEPS[activeIndex + 1];
		if (nextStep) {
			await goToStep(nextStep.id);
		}
	};

	const goPrevious = async () => {
		const previousStep = QUOTATION_STEPS[activeIndex - 1];
		if (previousStep) {
			await goToStep(previousStep.id);
		}
	};

	const {
		addEvent,
		addPackage,
		duplicatePackage,
		removeEvent,
		removePackage,
		updateEvent,
		updatePackage,
	} = useQuotationWizardCollections(draft, patchDraft);

	const sendPreview = async () => {
		const saved = await saveDraft();
		if (!saved) {
			return;
		}
		const savedQuoteId = saved.id;
		const validation = strictQuotationDocumentV1Schema.safeParse(
			saved.document,
		);
		if (!validation.success) {
			showValidationErrors(validateQuotationDocument(saved.document));
			return;
		}
		await sendMutation.mutateAsync({
			id: savedQuoteId,
			expectedDocumentRevision: saved.documentRevision,
		});
		await queryClient.invalidateQueries({
			queryKey: quotesApi.getOptions(savedQuoteId).queryKey,
		});
		router.push(`/app/${organizationSlug}/quotations/${savedQuoteId}`);
	};

	const resetDraft = () => {
		const blank = createDefaultQuotationDraft(
			todayInTimezone(organizationTimezone),
		);
		const bootstrap = selectQuotationBootstrap(
			bookingTypes.data?.data ?? [],
			packageTypes.data?.data ?? [],
		);
		setDraft(
			bootstrap
				? applyQuotationBootstrap(
						blank,
						bootstrap.bookingType,
						bootstrap.packageType,
						createDraftId,
					)
				: blank,
		);
		editVersion.current += 1;
		setDirty(true);
		setSaveStatus("Unsaved");
		setFieldErrors({});
		setActiveStep("client");
		toast.success("Quotation draft reset");
	};

	const reviewQuotation = async () => {
		if (activeStep === "preview") {
			await sendPreview();
			return;
		}
		await goToStep("preview");
	};

	return (
		<div className="flex min-h-[calc(100dvh-1rem)] flex-1 flex-col">
			<BookingFormLayout
				className="flex-1 overflow-hidden rounded-lg border bg-background"
				backHref={`/app/${organizationSlug}/clients`}
				title="New Quotation"
				stepName={
					QUOTATION_STEPS.find((step) => step.id === activeStep)
						?.label ?? "Quotation"
				}
				onCancel={() => router.push(`/app/${organizationSlug}/clients`)}
				stepper={
					<QuotationStepper
						activeStep={activeStep}
						completedSteps={completedSteps}
						onStepClick={goToStep}
						onPrimaryAction={reviewQuotation}
						onReset={resetDraft}
						saveStatus={saveStatus}
						primaryActionLabel={
							activeStep === "preview"
								? "Mark ready"
								: "Review & Send"
						}
					/>
				}
				mobileStepper={
					<QuotationMobileStepper
						activeStep={activeStep}
						completedSteps={completedSteps}
						onStepClick={goToStep}
					/>
				}
				footer={
					<QuotationWizardFooter
						activeIndex={activeIndex}
						activeStep={activeStep}
						onNext={goNext}
						onPrevious={goPrevious}
						onSend={sendPreview}
					/>
				}
			>
				<div className="space-y-6">
					{activeStep === "client" && (
						<ClientStep
							draft={draft}
							patchDraft={patchDraft}
							errors={fieldErrors}
						/>
					)}
					{activeStep === "events" && (
						<EventsStep
							events={draft.events}
							onAdd={addEvent}
							onRemove={removeEvent}
							onUpdate={updateEvent}
							errors={fieldErrors}
						/>
					)}
					{activeStep === "packages" && (
						<PackagesStep
							packages={draft.packages}
							events={draft.events}
							quotationType={draft.quotationType}
							quotationTypeKey={draft.quotationTypeKey}
							selectedPackageId={draft.selectedPackageId}
							onSelect={(id) =>
								patchDraft("selectedPackageId", id)
							}
							onUpdate={updatePackage}
							onAddPackage={addPackage}
							onRemovePackage={removePackage}
							onDuplicatePackage={duplicatePackage}
							errors={fieldErrors}
						/>
					)}
					{activeStep === "terms" && (
						<TermsStep
							draft={draft}
							patchDraft={patchDraft}
							errors={fieldErrors}
						/>
					)}
					{activeStep === "preview" && (
						<PreviewStep
							draft={draft}
							selectedPackage={selectedPackage}
							quoteId={currentQuoteId}
							documentRevision={documentRevision}
						/>
					)}
				</div>
			</BookingFormLayout>
			<QuotationConflictDialog
				draft={draft}
				onOpenChange={setConflictOpen}
				open={conflictOpen}
			/>
		</div>
	);
}
