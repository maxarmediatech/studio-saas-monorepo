"use client";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Combobox, type ComboboxOption } from "@repo/ui/components/combobox";
import { DatePicker } from "@repo/ui/components/date-picker";
import { Input } from "@repo/ui/components/input";
import { useConfigurationParams } from "@saas/studio/hooks/params/use-configuration-params";
import { useQuery } from "@tanstack/react-query";
import { bookingFormQueries } from "../bookings/booking-form/booking-form-queries";
import { configurationControlMode } from "../configurations/apply-package-configuration";
import type { QuotationDraft } from "./quotation-wizard-data";
import { buildQuotationTitle } from "./quotation-wizard-data";
import { FieldBlock } from "./quotation-wizard-parts";

type PatchDraft = <K extends keyof QuotationDraft>(
	key: K,
	value: QuotationDraft[K],
) => void;

export function QuotationDetailsSection({
	draft,
	patchDraft,
	errors,
}: {
	draft: QuotationDraft;
	patchDraft: PatchDraft;
	errors: Record<string, string>;
}) {
	const { openCreate } = useConfigurationParams();
	const quotationTypesQuery = useQuery(bookingFormQueries.bookingTypes());
	const { data: quotationTypesData, isPending: quotationTypesLoading } =
		quotationTypesQuery;
	const quotationTypeOptions: ComboboxOption[] =
		quotationTypesData?.data.map((quotationType) => ({
			value: quotationType.label,
			label: quotationType.label,
		})) ?? [];
	const quotationTypeControlMode = configurationControlMode({
		isPending: quotationTypesLoading,
		isError: quotationTypesQuery.isError,
		optionCount: quotationTypeOptions.length,
	});

	const updateQuotationType = (quotationType: string) => {
		const nextDraft = { ...draft, quotationType };
		const selected = quotationTypesData?.data.find(
			(item) => item.label === quotationType,
		);
		const generatedTitle = buildQuotationTitle(nextDraft);

		patchDraft("quotationType", quotationType);
		patchDraft("quotationTypeId", selected?.id ?? null);
		patchDraft("quotationTypeKey", selected?.key ?? null);
		if (!draft.title || draft.title === buildQuotationTitle(draft)) {
			patchDraft("title", generatedTitle);
		}
	};

	return (
		<div className="space-y-4">
			<h2 className="text-lg font-semibold">Quotation Details</h2>
			<Card>
				<CardContent className="space-y-5">
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<FieldBlock
							label="Quotation Date"
							error={errors["quotation-date"]}
						>
							<DatePicker
								id="quotation-date"
								aria-invalid={Boolean(errors["quotation-date"])}
								value={draft.quoteDate}
								onValueChange={(date) =>
									patchDraft("quoteDate", date ?? "")
								}
							/>
						</FieldBlock>
						<FieldBlock
							label="Quotation Type"
							error={errors["quotation-type"]}
						>
							{quotationTypeControlMode === "error" ? (
								<div className="flex gap-2">
									<Input
										disabled
										placeholder="Could not load quotation types"
									/>
									<Button
										type="button"
										variant="outline"
										onClick={() =>
											quotationTypesQuery.refetch()
										}
									>
										Retry
									</Button>
								</div>
							) : quotationTypeControlMode !== "freeText" ? (
								<Combobox
									id="quotation-type"
									aria-invalid={Boolean(
										errors["quotation-type"],
									)}
									value={draft.quotationType}
									onValueChange={updateQuotationType}
									options={quotationTypeOptions}
									placeholder={
										quotationTypesLoading
											? "Loading..."
											: "Select quotation type..."
									}
									searchPlaceholder="Search types..."
									emptyText="No matching types"
									disabled={
										quotationTypeControlMode === "loading"
									}
									onCreate={{
										label: "Add quotation type",
										onClick: () =>
											openCreate("booking_type"),
									}}
								/>
							) : (
								<Input
									id="quotation-type"
									aria-invalid={Boolean(
										errors["quotation-type"],
									)}
									value={draft.quotationType}
									placeholder="e.g. Wedding"
									onChange={(event) =>
										updateQuotationType(event.target.value)
									}
								/>
							)}
						</FieldBlock>
					</div>
					<FieldBlock
						label="Quotation Name"
						error={errors["quotation-title"]}
					>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
							<Input
								id="quotation-title"
								aria-invalid={Boolean(
									errors["quotation-title"],
								)}
								value={draft.title}
								placeholder="Generated from clients and quotation type"
								onChange={(event) =>
									patchDraft("title", event.target.value)
								}
							/>
							<Button
								type="button"
								variant="outline"
								onClick={() =>
									patchDraft(
										"title",
										buildQuotationTitle(draft),
									)
								}
							>
								Generate
							</Button>
						</div>
					</FieldBlock>
				</CardContent>
			</Card>
		</div>
	);
}
