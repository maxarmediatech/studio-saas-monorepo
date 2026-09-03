"use client";

import { strictQuotationDocumentV1Schema } from "@repo/api/modules/studio/schemas/quotation-document";
import { BookingFormLayout } from "@saas/studio/components/bookings";
import { bookingFormQueries } from "@saas/studio/components/bookings/booking-form/booking-form-queries";
import { selectQuotationBootstrap } from "@saas/studio/components/configurations/apply-package-configuration";
import {
	configurationsApi,
	quotesApi,
	quotesMutations,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { useStudioCapabilities } from "../studio-capabilities-context";
import { authoritativeQuotationQuery } from "./quotation-authoritative-query";
import {
	createQuotationAutosaveState,
	markQuotationAutosaveEdit,
	markQuotationAutosaveLoaded,
	quotationAutosaveDisposition,
	runQuotationAutosave,
} from "./quotation-autosave";
import { ClientStep, EventsStep } from "./quotation-client-events-steps";
import { openQuotationInEditor } from "./quotation-editor-launch";
import { PackagesStep } from "./quotation-package-deliverable-steps";
import {
	isQuotationPresentationConflict,
	isQuotationTemplateAvailable,
} from "./quotation-pdf-route";
import {
	applyQuotationTermsPreset,
	selectDefaultQuotationTermsPreset,
} from "./quotation-terms-presets";
import { PreviewStep, TermsStep } from "./quotation-terms-preview-steps";
import {
	applyQuotationBootstrap,
	quotationBootstrapQueriesReady,
} from "./quotation-wizard-bootstrap";
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
	quotationDocumentToWizardDraft,
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
	const caps = useStudioCapabilities();
	const initialDraftSeed = useId();
	const [draft, setDraft] = useState<QuotationDraft>(() =>
		createDefaultQuotationDraft(
			todayInTimezone(organizationTimezone),
			initialDraftSeed,
		),
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
	const [openingEditor, setOpeningEditor] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const autosave = useRef(createQuotationAutosaveState(draft));
	const currentQuoteIdRef = useRef(currentQuoteId);
	const documentRevisionRef = useRef(documentRevision);
	const defaultsApplied = useRef(false);
	const bookingTypes = useQuery(bookingFormQueries.bookingTypes());
	useQuery(bookingFormQueries.eventTypes());
	const packageTypes = useQuery(bookingFormQueries.packageTypes());
	const quotationTerms = useQuery(configurationsApi.quotationTermsOptions());
	const detail = useQuery({
		...quotesApi.getOptions(quoteId ?? ""),
		enabled: Boolean(quoteId),
	});
	const createMutation = useMutation(quotesMutations.createDocument());
	const saveMutation = useMutation(quotesMutations.saveDocument());
	const sendMutation = useMutation(quotesMutations.startPresentationSend());

	useEffect(() => {
		const bookingTypeOptions = bookingTypes.data?.data;
		const packageTypeOptions = packageTypes.data?.data;
		const termsOptions = quotationTerms.data?.data;
		if (
			quoteId ||
			defaultsApplied.current ||
			!quotationBootstrapQueriesReady({
				bookingTypesReady: Boolean(bookingTypeOptions),
				packageTypesReady: Boolean(packageTypeOptions),
				termsReady: Boolean(termsOptions),
				termsError: quotationTerms.isError,
			})
		) {
			return;
		}
		if (!bookingTypeOptions || !packageTypeOptions) {
			return;
		}
		defaultsApplied.current = true;
		const bootstrap = selectQuotationBootstrap(
			bookingTypeOptions,
			packageTypeOptions,
		);
		if (!bootstrap) {
			return;
		}
		const { bookingType, packageType } = bootstrap;
		setDraft((current) => {
			let next = applyQuotationBootstrap(
				current,
				bookingType,
				packageType,
				createDraftId,
			);
			const termsPreset = selectDefaultQuotationTermsPreset(
				termsOptions ?? [],
				next.quotationTypeKey,
			);
			if (termsPreset) {
				next = applyQuotationTermsPreset(next, termsPreset) ?? next;
			}
			return next;
		});
	}, [
		bookingTypes.data,
		packageTypes.data,
		quotationTerms.data,
		quotationTerms.isError,
		quoteId,
	]);
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
		setDraft((current) => {
			const next = { ...current, [key]: value };
			markQuotationAutosaveEdit(autosave.current, next);
			return next;
		});
		setDirty(true);
		setSaveStatus("Unsaved");
	};

	const replaceDraft = (next: QuotationDraft) => {
		setFieldErrors({});
		setDraft(next);
		markQuotationAutosaveEdit(autosave.current, next);
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
		markQuotationAutosaveLoaded(autosave.current, loadedDraft);
		setDocumentRevision(detail.data.data.documentRevision);
		documentRevisionRef.current = detail.data.data.documentRevision;
		setLoaded(true);
		setDirty(false);
		setSaveStatus("Draft saved");
	}, [detail.data, loaded, organizationSlug, quoteId, router]);

	const saveDraft = useCallback(async () => {
		if (
			!shouldAutosaveQuotationDraft({
				loaded,
				dirty: true,
				conflictPaused,
			})
		) {
			return null;
		}
		const disposition = quotationAutosaveDisposition(autosave.current);
		if (disposition === "saved" && currentQuoteIdRef.current) {
			return {
				id: currentQuoteIdRef.current,
				documentRevision: documentRevisionRef.current,
				document: quotationDraftToDocument(autosave.current.snapshot),
				reused: false,
			};
		}
		if (disposition === "failed") {
			return null;
		}
		setSaveStatus("Saving");
		try {
			const autosaved = await runQuotationAutosave(
				autosave.current,
				async (snapshot) => {
					const response = currentQuoteIdRef.current
						? await saveMutation.mutateAsync({
								id: currentQuoteIdRef.current,
								expectedDocumentRevision:
									documentRevisionRef.current,
								document: quotationDraftToDocument(snapshot),
							})
						: await createMutation.mutateAsync({
								document: quotationDraftToDocument(snapshot),
							});
					const result = response.data;
					const wasCreate = !currentQuoteIdRef.current;
					currentQuoteIdRef.current = result.id;
					documentRevisionRef.current = result.documentRevision;
					setCurrentQuoteId(result.id);
					setDocumentRevision(result.documentRevision);
					void queryClient.invalidateQueries({
						queryKey: quotesApi.getPresentationOptions(result.id)
							.queryKey,
					});
					if (wasCreate) {
						window.history.replaceState(
							null,
							"",
							`/app/${organizationSlug}/quotations/${result.id}/edit`,
						);
					}
					return result;
				},
				(current, result) =>
					result.reused
						? quotationDocumentToWizardDraft(result.document)
						: {
								...current,
								clients: current.clients.map((client) => {
									const persisted =
										result.document.participants.find(
											(item) => item.key === client.id,
										);
									return persisted
										? {
												...client,
												clientId: persisted.clientId,
												clientUpdatedAt:
													persisted.clientUpdatedAt,
												persistAsLead: false,
											}
										: client;
								}),
							},
			);
			setDraft(autosave.current.snapshot);
			if (
				autosave.current.savedVersion === autosave.current.editVersion
			) {
				setDirty(false);
				setSaveStatus("Draft saved");
			}
			if (autosaved) {
				return autosaved;
			}
			if (
				currentQuoteIdRef.current &&
				autosave.current.savedVersion === autosave.current.editVersion
			) {
				return {
					id: currentQuoteIdRef.current,
					documentRevision: documentRevisionRef.current,
					document: quotationDraftToDocument(
						autosave.current.snapshot,
					),
					reused: false,
				};
			}
			return null;
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
	}, [
		createMutation,
		loaded,
		conflictPaused,
		organizationSlug,
		queryClient,
		saveMutation,
	]);

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
		if (!caps.quoteSend) {
			toast.error("You do not have permission to send quotations");
			return;
		}
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
		try {
			const [presentation, catalog] = await Promise.all([
				queryClient.fetchQuery(
					authoritativeQuotationQuery(
						quotesApi.getPresentationOptions(savedQuoteId),
					),
				),
				queryClient.fetchQuery(
					authoritativeQuotationQuery(
						quotesApi.listTemplatesOptions(),
					),
				),
			]);
			const selectedTemplateAvailable = isQuotationTemplateAvailable(
				catalog.data,
				presentation.data,
			);
			if (!selectedTemplateAvailable) {
				toast.error(
					"Choose an available quotation template before sending",
				);
				return;
			}
			await sendMutation.mutateAsync({
				id: savedQuoteId,
				expectedDocumentRevision: presentation.data.documentRevision,
				expectedSelectionVersion: presentation.data.selectionVersion,
			});
			await queryClient.invalidateQueries({
				queryKey: quotesApi.getOptions(savedQuoteId).queryKey,
			});
			router.push(`/app/${organizationSlug}/quotations/${savedQuoteId}`);
		} catch (error) {
			if (isQuotationPresentationConflict(error)) {
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey:
							quotesApi.getPresentationOptions(savedQuoteId)
								.queryKey,
					}),
					queryClient.invalidateQueries({
						queryKey: quotesApi.getOptions(savedQuoteId).queryKey,
					}),
				]);
				toast.error(
					"Quotation changed elsewhere. Latest state loaded; review before sending.",
				);
				return;
			}
			toast.error(
				error instanceof Error
					? error.message
					: "Could not send quotation",
			);
		}
	};

	const launchEditor = async () => {
		if (!caps.quoteReadOperational || !caps.quoteUpdate) {
			toast.error("You do not have permission to edit quotations");
			return;
		}
		const saved = await saveDraft();
		if (!saved) {
			return;
		}
		const validation = strictQuotationDocumentV1Schema.safeParse(
			saved.document,
		);
		if (!validation.success) {
			showValidationErrors(validateQuotationDocument(saved.document));
			return;
		}
		setOpeningEditor(true);
		try {
			await openQuotationInEditor(saved.id);
		} catch (error) {
			setOpeningEditor(false);
			toast.error(
				error instanceof Error
					? error.message
					: "Could not open quotation in the editor",
			);
		}
	};

	const resetDraft = () => {
		const blank = createDefaultQuotationDraft(
			todayInTimezone(organizationTimezone),
		);
		const bootstrap = selectQuotationBootstrap(
			bookingTypes.data?.data ?? [],
			packageTypes.data?.data ?? [],
		);
		let next = bootstrap
			? applyQuotationBootstrap(
					blank,
					bootstrap.bookingType,
					bootstrap.packageType,
					createDraftId,
				)
			: blank;
		const termsPreset = selectDefaultQuotationTermsPreset(
			quotationTerms.data?.data ?? [],
			next.quotationTypeKey,
		);
		if (termsPreset) {
			next = applyQuotationTermsPreset(next, termsPreset) ?? next;
		}
		replaceDraft(next);
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
						primaryActionDisabled={
							activeStep === "preview" && !caps.quoteSend
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
						onOpenEditor={launchEditor}
						canSend={caps.quoteSend}
						canOpenEditor={
							caps.quoteReadOperational && caps.quoteUpdate
						}
						openingEditor={openingEditor}
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
							replaceDraft={replaceDraft}
							presets={quotationTerms.data?.data ?? []}
							presetsError={quotationTerms.isError}
							onRetryPresets={() => quotationTerms.refetch()}
							errors={fieldErrors}
						/>
					)}
					{activeStep === "preview" && (
						<PreviewStep
							draft={draft}
							selectedPackage={selectedPackage}
							quoteId={currentQuoteId}
							documentRevision={documentRevision}
							canReadPresentation={caps.quoteReadOperational}
							canSelectTemplate={caps.quoteUpdate}
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
