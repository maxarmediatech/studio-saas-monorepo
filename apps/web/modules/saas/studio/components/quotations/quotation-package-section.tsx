"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Combobox, type ComboboxOption } from "@repo/ui/components/combobox";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { useConfigurationParams } from "@saas/studio/hooks/params/use-configuration-params";
import { useQuery } from "@tanstack/react-query";
import { CopyIcon, PackageIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { bookingFormQueries } from "../bookings/booking-form/booking-form-queries";
import {
	applyPackageConfiguration,
	configurationControlMode,
	packageMatchesBookingType,
} from "../configurations/apply-package-configuration";
import { PackageDeliverablesSection } from "./quotation-package-deliverables";
import type {
	CrewCoverage,
	PackageOption,
	QuotationDeliverable,
	QuotationEvent,
} from "./quotation-wizard-data";
import { createDraftId } from "./quotation-wizard-data";
import { FieldBlock, formatMoney } from "./quotation-wizard-parts";

function getEventLabel(event: QuotationEvent) {
	return event.name.trim() || "Select event type in Details";
}

function getEventDateLabel(event: QuotationEvent) {
	if (!event.date.trim()) {
		return event.tentative ? "Tentative date window" : "Fixed date";
	}

	return event.date;
}

function getCoverageForEvent(pkg: PackageOption, event: QuotationEvent) {
	return (
		pkg.coverage.find((coverage) => coverage.eventId === event.id) ??
		pkg.coverage.find(
			(coverage) =>
				coverage.eventName === event.name &&
				coverage.side === event.side,
		) ??
		null
	);
}

function upsertCoverageForEvent(
	coverage: CrewCoverage[],
	event: QuotationEvent,
	roles: string,
) {
	const existing = getCoverageForEvent(
		{
			id: "",
			configurationId: null,
			configurationKey: null,
			configurationDefaultCost: null,
			configurationDescription: null,
			name: "",
			price: "",
			summary: "",
			coverage,
			deliverables: [],
		},
		event,
	);
	const nextCoverage = {
		id: existing?.id ?? createDraftId("coverage"),
		eventId: event.id,
		eventName: event.name,
		side: event.side,
		roles,
	};

	if (!existing) {
		return [...coverage, nextCoverage];
	}

	return coverage.map((item) =>
		item.id === existing.id ? nextCoverage : item,
	);
}

export function PackageSection({
	pkg,
	index,
	events,
	quotationType,
	quotationTypeKey,
	canRemove,
	onRemove,
	onDuplicate,
	onUpdate,
	errors,
}: {
	pkg: PackageOption;
	index: number;
	events: QuotationEvent[];
	quotationType: string;
	quotationTypeKey: string | null;
	canRemove: boolean;
	onRemove: () => void;
	onDuplicate: () => void;
	onUpdate: (patch: Partial<PackageOption>) => void;
	errors: Record<string, string>;
}) {
	const { openCreate } = useConfigurationParams();
	const packageTypesQuery = useQuery(bookingFormQueries.packageTypes());
	const { data: packageTypesData, isPending: packageTypesLoading } =
		packageTypesQuery;
	const packageTypes = (packageTypesData?.data ?? []).filter((item) =>
		packageMatchesBookingType(item, {
			key: quotationTypeKey,
			label: quotationType,
		}),
	);
	const packageTypeOptions: ComboboxOption[] = packageTypes.map(
		(packageType) => ({
			value: packageType.label,
			label: packageType.label,
		}),
	);
	const packageControlMode = configurationControlMode({
		isPending: packageTypesLoading,
		isError: packageTypesQuery.isError,
		optionCount: packageTypeOptions.length,
	});

	const applyPackageType = (packageName: string) => {
		const selectedPackageType = packageTypes.find(
			(packageType) => packageType.label === packageName,
		);
		if (!selectedPackageType) {
			return;
		}
		const applied = applyPackageConfiguration(selectedPackageType);
		const defaultDeliverables = applied.deliverables.map((deliverable) => ({
			id: createDraftId("deliverable"),
			name: deliverable.name,
			quantity: String(deliverable.quantity),
			details: deliverable.details,
		}));

		onUpdate({
			configurationId: applied.configurationId,
			configurationKey: applied.configurationKey,
			configurationDefaultCost: applied.cost || null,
			configurationDescription: applied.description || null,
			name: packageName,
			price: applied.cost,
			summary: applied.description,
			deliverables: defaultDeliverables.length
				? defaultDeliverables
				: pkg.deliverables,
		});
	};

	const updateDeliverable = (
		id: string,
		patch: Partial<QuotationDeliverable>,
	) => {
		onUpdate({
			deliverables: pkg.deliverables.map((deliverable) =>
				deliverable.id === id
					? { ...deliverable, ...patch }
					: deliverable,
			),
		});
	};

	const addDeliverable = () => {
		onUpdate({
			deliverables: [
				...pkg.deliverables,
				{
					id: createDraftId("deliverable"),
					name: "",
					quantity: "1",
					details: "",
				},
			],
		});
	};

	const removeDeliverable = (id: string) => {
		onUpdate({
			deliverables: pkg.deliverables.filter(
				(deliverable) => deliverable.id !== id,
			),
		});
	};

	return (
		<div className="overflow-hidden rounded-lg border bg-muted/10">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
				<div className="flex items-center gap-2">
					<PackageIcon className="h-4 w-4 text-muted-foreground" />
					<span className="text-sm font-medium">
						Package {index + 1}
					</span>
					{pkg.price && (
						<Badge variant="outline">
							{formatMoney(pkg.price)}
						</Badge>
					)}
				</div>
				<div className="flex items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={onDuplicate}
					>
						<CopyIcon className="h-4 w-4" />
						<span className="sr-only">Duplicate package</span>
					</Button>
					{canRemove && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
							onClick={onRemove}
						>
							<Trash2Icon className="h-4 w-4" />
							<span className="sr-only">Remove package</span>
						</Button>
					)}
				</div>
			</div>
			<div className="space-y-5 p-4">
				<div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
					<FieldBlock
						label="Package Type"
						error={errors[`quotation-package-${pkg.id}-name`]}
					>
						{packageControlMode === "error" ? (
							<div className="flex gap-2">
								<Input
									disabled
									placeholder="Could not load package types"
								/>
								<Button
									type="button"
									variant="outline"
									onClick={() => packageTypesQuery.refetch()}
								>
									Retry
								</Button>
							</div>
						) : packageControlMode !== "freeText" ? (
							<Combobox
								id={`quotation-package-${pkg.id}-name`}
								aria-invalid={Boolean(
									errors[`quotation-package-${pkg.id}-name`],
								)}
								value={pkg.name}
								onValueChange={applyPackageType}
								options={packageTypeOptions}
								placeholder={
									packageTypesLoading
										? "Loading..."
										: "Select package type..."
								}
								searchPlaceholder="Search packages..."
								emptyText="No matching package types"
								disabled={packageControlMode === "loading"}
								onCreate={{
									label: "Add package type",
									onClick: () => openCreate("package_type"),
								}}
							/>
						) : (
							<Input
								id={`quotation-package-${pkg.id}-name`}
								aria-invalid={Boolean(
									errors[`quotation-package-${pkg.id}-name`],
								)}
								value={pkg.name}
								placeholder="e.g. Cinematic Package"
								onChange={(event) =>
									onUpdate({ name: event.target.value })
								}
							/>
						)}
					</FieldBlock>
					<FieldBlock
						label="Package Price"
						error={errors[`quotation-package-${pkg.id}-price`]}
					>
						<Input
							id={`quotation-package-${pkg.id}-price`}
							aria-invalid={Boolean(
								errors[`quotation-package-${pkg.id}-price`],
							)}
							value={pkg.price}
							placeholder="e.g. 300000"
							onChange={(event) =>
								onUpdate({ price: event.target.value })
							}
						/>
					</FieldBlock>
				</div>
				<FieldBlock label="Package Details">
					<Textarea
						value={pkg.summary}
						placeholder="Short positioning note for this package option"
						rows={2}
						onChange={(event) =>
							onUpdate({ summary: event.target.value })
						}
					/>
				</FieldBlock>
				<div className="space-y-3">
					<div>
						<p className="text-sm font-medium">Crew Coverage</p>
						<p className="text-sm text-muted-foreground">
							Add promised photographers, filmmakers and operators
							for each function.
						</p>
					</div>
					{events.length === 0 ? (
						<div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-6">
							<UsersIcon className="h-8 w-8 shrink-0 text-muted-foreground/50" />
							<p className="text-sm text-muted-foreground">
								Add functions in Details first.
							</p>
						</div>
					) : (
						<div className="space-y-3">
							{events.map((event) => {
								const coverage = getCoverageForEvent(
									pkg,
									event,
								);

								return (
									<div
										key={event.id}
										className="space-y-3 rounded-lg border bg-background p-3"
									>
										<div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_240px]">
											<FieldBlock label="Function">
												<Input
													value={getEventLabel(event)}
													disabled
												/>
											</FieldBlock>
											<FieldBlock
												label={
													event.tentative
														? "Date window"
														: "Fixed date"
												}
											>
												<Input
													value={getEventDateLabel(
														event,
													)}
													disabled
												/>
											</FieldBlock>
										</div>
										<FieldBlock label="Promised crew coverage">
											<Textarea
												value={coverage?.roles ?? ""}
												placeholder="e.g. 1 Event Photographer&#10;1 Cinematographer&#10;1 Drone Operator"
												rows={4}
												onChange={(change) =>
													onUpdate({
														coverage:
															upsertCoverageForEvent(
																pkg.coverage,
																event,
																change.target
																	.value,
															),
													})
												}
											/>
										</FieldBlock>
									</div>
								);
							})}
						</div>
					)}
				</div>
				<PackageDeliverablesSection
					deliverables={pkg.deliverables}
					onAddDeliverable={addDeliverable}
					onRemoveDeliverable={removeDeliverable}
					onUpdateDeliverable={updateDeliverable}
				/>
			</div>
		</div>
	);
}
