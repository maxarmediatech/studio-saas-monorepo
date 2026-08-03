"use client";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { PackageOption, QuotationDraft } from "./quotation-wizard-data";

type PatchDraft = <K extends keyof QuotationDraft>(
	key: K,
	value: QuotationDraft[K],
) => void;

export function TermsStep({
	draft,
	patchDraft,
	errors,
}: {
	draft: QuotationDraft;
	patchDraft: PatchDraft;
	errors: Record<string, string>;
}) {
	const updateTimeline = (index: number, value: string) => {
		const timelines = [...draft.timelines];
		timelines[index] = value;
		patchDraft("timelines", timelines);
	};

	return (
		<div className="space-y-4" id="quotation-terms" tabIndex={-1}>
			<h2 className="text-lg font-semibold">Terms & Payments</h2>
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
									patchDraft("timelines", [
										...draft.timelines,
										"",
									]);
									patchDraft("timelineKeys", [
										...draft.timelineKeys,
										`timeline-${crypto.randomUUID()}`,
									]);
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
											patchDraft("payments", payments);
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
											patchDraft("payments", payments);
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
											patchDraft("payments", payments);
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
										patchDraft("terms", terms);
									}}
									className="min-h-16"
								/>
							))}
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									patchDraft("terms", [...draft.terms, ""]);
									patchDraft("termKeys", [
										...draft.termKeys,
										`term-${crypto.randomUUID()}`,
									]);
								}}
							>
								<PlusIcon className="mr-2 size-4" />
								Add term
							</Button>
						</div>
					</TermsSection>
				</CardContent>
			</Card>
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
}: {
	draft: QuotationDraft;
	selectedPackage?: PackageOption;
	quoteId?: string;
	documentRevision: number;
}) {
	return (
		<div className="space-y-4">
			<h2 className="text-lg font-semibold">Review Quotation</h2>
			<Card>
				<CardContent className="p-0">
					{quoteId && documentRevision > 0 ? (
						<iframe
							title="Quotation PDF preview"
							src={`/api/studio/quotations/${quoteId}/pdf?revision=${documentRevision}`}
							className="h-[75dvh] min-h-[640px] w-full rounded-md"
						/>
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
