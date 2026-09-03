"use client";

import type { Configuration } from "@repo/api/modules/studio/schemas/configuration";
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
import { Card, CardContent } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { PlusIcon } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { QuotationPdfPreview } from "./QuotationPdfPreview";
import { QuotationTemplateSelector } from "./QuotationTemplateSelector";
import type { QuotationPresentationIdentity } from "./quotation-pdf-route";
import {
	applyQuotationTermsPreset,
	clearQuotationTermsPreset,
	customizeQuotationTerms,
	eligibleQuotationTermsPresets,
	quotationTermsHaveContent,
} from "./quotation-terms-presets";
import type { PackageOption, QuotationDraft } from "./quotation-wizard-data";

export function TermsStep({
	draft,
	replaceDraft,
	presets,
	presetsError,
	onRetryPresets,
	errors,
}: {
	draft: QuotationDraft;
	replaceDraft: (draft: QuotationDraft) => void;
	presets: Configuration[];
	presetsError: boolean;
	onRetryPresets: () => unknown;
	errors: Record<string, string>;
}) {
	const eligiblePresets = useMemo(
		() => eligibleQuotationTermsPresets(presets, draft.quotationTypeKey),
		[presets, draft.quotationTypeKey],
	);
	const appliedPreset = draft.termsConfiguration;
	const [selectedPresetId, setSelectedPresetId] = useState(
		appliedPreset?.id ?? "custom",
	);
	const [pendingAction, setPendingAction] = useState<
		"apply" | "clear" | null
	>(null);

	useEffect(() => {
		setSelectedPresetId(appliedPreset?.id ?? "custom");
	}, [appliedPreset?.id]);

	const selectedPreset = presets.find((item) => item.id === selectedPresetId);
	const appliedPresetIsUnavailable = Boolean(
		appliedPreset?.id &&
			!eligiblePresets.some((item) => item.id === appliedPreset.id),
	);
	const markCustom = <
		K extends
			| "timelines"
			| "timelineKeys"
			| "payments"
			| "terms"
			| "termKeys",
	>(
		key: K,
		value: QuotationDraft[K],
	) => replaceDraft({ ...draft, [key]: value, termsConfiguration: null });
	const runPendingAction = () => {
		if (pendingAction === "apply" && selectedPreset) {
			const next = applyQuotationTermsPreset(draft, selectedPreset);
			if (next) {
				replaceDraft(next);
			}
		}
		if (pendingAction === "clear") {
			replaceDraft(clearQuotationTermsPreset(draft));
			setSelectedPresetId("custom");
		}
		setPendingAction(null);
	};

	const updateTimeline = (index: number, value: string) => {
		const timelines = [...draft.timelines];
		timelines[index] = value;
		markCustom("timelines", timelines);
	};

	return (
		<div className="space-y-4" id="quotation-terms" tabIndex={-1}>
			<h2 className="text-lg font-semibold">Terms & Payments</h2>
			{presetsError ? (
				<Alert variant="destructive">
					<AlertTitle>Terms presets could not be loaded</AlertTitle>
					<AlertDescription className="space-y-2">
						<p>
							The quotation remains editable with the neutral
							40/50/10 payment schedule.
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => onRetryPresets()}
						>
							Retry preset load
						</Button>
					</AlertDescription>
				</Alert>
			) : null}
			<Card>
				<CardContent className="space-y-3">
					<div>
						<p className="text-sm font-medium">Terms preset</p>
						<p className="text-sm text-muted-foreground">
							Choose a studio preset, then apply it explicitly.
							Manual edits become Custom.
						</p>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row">
						<Select
							value={selectedPresetId}
							onValueChange={setSelectedPresetId}
						>
							<SelectTrigger
								aria-label="Quotation terms preset"
								className="sm:flex-1"
							>
								<SelectValue placeholder="Choose terms preset" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="custom">Custom</SelectItem>
								{appliedPresetIsUnavailable &&
								appliedPreset?.id ? (
									<SelectItem value={appliedPreset.id}>
										{appliedPreset.label} (saved snapshot)
									</SelectItem>
								) : null}
								{eligiblePresets.map((preset) => (
									<SelectItem
										key={preset.id}
										value={preset.id}
									>
										{preset.label}
										{preset.isDefault ? " — Default" : ""}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							type="button"
							variant="outline"
							disabled={
								!selectedPreset || selectedPresetId === "custom"
							}
							onClick={() =>
								quotationTermsHaveContent(draft)
									? setPendingAction("apply")
									: selectedPreset &&
										replaceDraft(
											applyQuotationTermsPreset(
												draft,
												selectedPreset,
											) ?? draft,
										)
							}
						>
							{appliedPreset?.id === selectedPresetId
								? "Reapply"
								: "Apply"}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setPendingAction("clear")}
						>
							Clear
						</Button>
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardContent className="space-y-6">
					<TermsSection
						title="Delivery timelines"
						description="Common delivery commitments for the quotation."
					>
						<div className="space-y-3">
							{draft.timelines.map((timeline, index) => (
								<Textarea
									key={
										draft.timelineKeys[index] ??
										`timeline-${index}`
									}
									value={timeline}
									onChange={(event) =>
										updateTimeline(
											index,
											event.target.value,
										)
									}
									className="min-h-16"
								/>
							))}
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									replaceDraft(
										customizeQuotationTerms(draft, {
											timelines: [...draft.timelines, ""],
											timelineKeys: [
												...draft.timelineKeys,
												`timeline-${crypto.randomUUID()}`,
											],
										}),
									);
								}}
							>
								<PlusIcon className="mr-2 size-4" />
								Add timeline item
							</Button>
						</div>
					</TermsSection>

					<TermsSection
						title="Payment terms"
						description="Installments and when each payment is due."
					>
						<div className="space-y-3">
							{draft.payments.map((payment, index) => (
								<div
									key={payment.id}
									className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-[1fr_140px]"
								>
									<Input
										value={payment.label}
										onChange={(event) => {
											const payments = [
												...draft.payments,
											];
											payments[index] = {
												...payment,
												label: event.target.value,
											};
											markCustom("payments", payments);
										}}
									/>
									<Input
										id={`quotation-payment-${payment.id}-percentage`}
										value={payment.percent}
										aria-invalid={Boolean(
											errors[
												`quotation-payment-${payment.id}-percentage`
											],
										)}
										onChange={(event) => {
											const payments = [
												...draft.payments,
											];
											payments[index] = {
												...payment,
												percent: event.target.value,
											};
											markCustom("payments", payments);
										}}
									/>
									{errors[
										`quotation-payment-${payment.id}-percentage`
									] ? (
										<p
											className="text-sm text-destructive sm:col-span-2"
											role="alert"
										>
											{
												errors[
													`quotation-payment-${payment.id}-percentage`
												]
											}
										</p>
									) : null}
									<Textarea
										value={payment.timing}
										onChange={(event) => {
											const payments = [
												...draft.payments,
											];
											payments[index] = {
												...payment,
												timing: event.target.value,
											};
											markCustom("payments", payments);
										}}
										className="min-h-16 sm:col-span-2"
									/>
								</div>
							))}
						</div>
					</TermsSection>

					<TermsSection
						title="Other fixed terms"
						description="Clauses that appear in the quotation agreement."
					>
						<div className="space-y-3">
							{draft.terms.map((term, index) => (
								<Textarea
									key={
										draft.termKeys[index] ?? `term-${index}`
									}
									value={term}
									onChange={(event) => {
										const terms = [...draft.terms];
										terms[index] = event.target.value;
										markCustom("terms", terms);
									}}
									className="min-h-16"
								/>
							))}
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									replaceDraft(
										customizeQuotationTerms(draft, {
											terms: [...draft.terms, ""],
											termKeys: [
												...draft.termKeys,
												`term-${crypto.randomUUID()}`,
											],
										}),
									);
								}}
							>
								<PlusIcon className="mr-2 size-4" />
								Add term
							</Button>
						</div>
					</TermsSection>
				</CardContent>
			</Card>
			<AlertDialog
				open={pendingAction !== null}
				onOpenChange={(open) => !open && setPendingAction(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{pendingAction === "clear"
								? "Clear quotation terms?"
								: "Replace quotation terms?"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{pendingAction === "clear"
								? "Delivery timelines and fixed clauses will be removed. Payments return to the neutral 40/50/10 schedule."
								: "This replaces the current timelines, all three payment milestones, and fixed clauses with the selected preset."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={runPendingAction}>
							{pendingAction === "clear"
								? "Clear terms"
								: "Apply preset"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function TermsSection({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<section className="space-y-3 border-b pb-6 last:border-b-0 last:pb-0">
			<div>
				<p className="text-sm font-medium">{title}</p>
				<p className="text-sm text-muted-foreground">{description}</p>
			</div>
			{children}
		</section>
	);
}

export function PreviewStep({
	quoteId,
	documentRevision,
	canReadPresentation,
	canSelectTemplate,
}: {
	draft: QuotationDraft;
	selectedPackage?: PackageOption;
	quoteId?: string;
	documentRevision: number;
	canReadPresentation: boolean;
	canSelectTemplate: boolean;
}) {
	const [previewIdentity, setPreviewIdentity] =
		useState<QuotationPresentationIdentity | null>(null);

	return (
		<div className="space-y-4">
			<h2 className="text-lg font-semibold">Review Quotation</h2>
			<Card>
				<CardContent className="p-4">
					{quoteId && documentRevision > 0 ? (
						<div className="space-y-4">
							<QuotationTemplateSelector
								canRead={canReadPresentation}
								canSelect={canSelectTemplate}
								expectedDocumentRevision={documentRevision}
								onPreviewIdentityChange={setPreviewIdentity}
								quoteId={quoteId}
							/>
							{previewIdentity ? (
								<QuotationPdfPreview
									className="h-[75dvh] min-h-[640px]"
									identity={previewIdentity}
									quoteId={quoteId}
								/>
							) : (
								<div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
									Choose an available template to render its
									PDF preview.
								</div>
							)}
						</div>
					) : (
						<div className="p-8 text-center text-sm text-muted-foreground">
							Save the quotation to render its PDF preview.
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
