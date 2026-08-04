"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useConfigurationParams } from "@saas/studio/hooks/params/use-configuration-params";
import {
	configurationsApi,
	configurationsMutations,
} from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStudioCapabilities } from "../../studio-capabilities-context";
import {
	BookingTypeForm,
	type BookingTypeFormValues,
} from "../BookingTypeForm";
import {
	ConfigurationForm,
	type ConfigurationFormValues,
} from "../ConfigurationForm";
import { EventTypeForm, type EventTypeFormValues } from "../EventTypeForm";
import {
	PackageTypeForm,
	type PackageTypeFormValues,
} from "../PackageTypeForm";
import {
	QuotationTermsForm,
	type QuotationTermsFormValues,
} from "../QuotationTermsForm";
import {
	RelationTypeForm,
	type RelationTypeFormValues,
} from "../RelationTypeForm";

const CONFIG_TYPE_LABELS: Record<string, string> = {
	booking_type: "Booking Type",
	package_type: "Package Type",
	relation_type: "Relation Type",
	event_type: "Event Type",
	quotation_terms: "Quotation Terms",
	shoot_status: "Shoot Status",
	crew_role: "Specialisation",
	task_status: "Task Status",
	task_priority: "Task Priority",
	deliverable_status: "Deliverable Status",
	deliverable_priority: "Deliverable Priority",
	expense_category: "Expense Category",
};

export function ConfigurationEditSheet() {
	const { configurationId, configurationType, close } =
		useConfigurationParams();
	const { configurationCreateOrUpdate } = useStudioCapabilities();
	const isOpen = Boolean(configurationId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	useEffect(() => {
		if (!configurationCreateOrUpdate && isOpen) {
			close();
		}
	}, [close, configurationCreateOrUpdate, isOpen]);

	const typeLabel = configurationType
		? (CONFIG_TYPE_LABELS[configurationType] ?? configurationType)
		: "";

	const {
		data: configuration,
		isLoading,
		isFetching,
	} = useQuery({
		...configurationsApi.getOptions(configurationId ?? ""),
		enabled: configurationCreateOrUpdate && isOpen && !!configurationId,
	});

	const updateMutation = useMutation({
		...configurationsMutations.update(),
		onSuccess: async () => {
			toast.success(`${typeLabel} updated successfully`);
			const invalidations = [
				queryClient.invalidateQueries({
					queryKey: orpc.configurations.key(),
				}),
			];
			if (configurationId) {
				invalidations.push(
					queryClient.invalidateQueries({
						queryKey:
							configurationsApi.getOptions(configurationId)
								.queryKey,
					}),
				);
			}
			await Promise.all(invalidations);
			close();
		},
		onError: (error) => {
			toast.error(
				error.message || `Failed to update ${typeLabel.toLowerCase()}`,
			);
		},
	});

	if (!configurationCreateOrUpdate) {
		return null;
	}

	const handleSubmit = async (data: ConfigurationFormValues) => {
		if (!configurationId) {
			return;
		}

		await updateMutation.mutateAsync({
			id: configurationId,
			label: data.label,
			description: data.description || null,
			color: data.color || null,
			sortOrder: data.sortOrder,
			isDefault: data.isDefault,
		});
	};

	const handlePackageSubmit = async (data: PackageTypeFormValues) => {
		if (!configurationId) {
			return;
		}

		await updateMutation.mutateAsync({
			id: configurationId,
			label: data.label,
			description: data.description || null,
			color: data.color || null,
			sortOrder: data.sortOrder,
			isDefault: data.isDefault,
			defaultCost: data.defaultCost || null,
			bookingTypeFilter: data.bookingType || null,
			metadata: {
				defaultDeliverables: data.defaultDeliverables ?? [],
			},
		});
	};

	const handleBookingTypeSubmit = async (data: BookingTypeFormValues) => {
		if (!configurationId) {
			return;
		}

		// Build metadata from booking type-specific fields
		const metadata: Record<string, unknown> = {};
		if (data.applicableRoles && data.applicableRoles.length > 0) {
			metadata.roles = data.applicableRoles;
		}

		await updateMutation.mutateAsync({
			id: configurationId,
			label: data.label,
			description: data.description || null,
			color: data.color || null,
			sortOrder: data.sortOrder,
			isDefault: data.isDefault,
			metadata: Object.keys(metadata).length > 0 ? metadata : null,
		});
	};

	const handleRelationTypeSubmit = async (data: RelationTypeFormValues) => {
		if (!configurationId) {
			return;
		}

		// Build metadata from relation type-specific fields
		const metadata: Record<string, unknown> = {};
		if (
			data.applicableBookingTypes &&
			data.applicableBookingTypes.length > 0
		) {
			metadata.bookingTypes = data.applicableBookingTypes;
		}

		await updateMutation.mutateAsync({
			id: configurationId,
			label: data.label,
			description: data.description || null,
			color: data.color || null,
			sortOrder: data.sortOrder,
			isDefault: data.isDefault,
			metadata: Object.keys(metadata).length > 0 ? metadata : null,
		});
	};

	const handleEventTypeSubmit = async (data: EventTypeFormValues) => {
		if (!configurationId) {
			return;
		}

		// Build metadata from event type-specific fields
		const metadata: Record<string, unknown> = {};
		if (
			data.applicableBookingTypes &&
			data.applicableBookingTypes.length > 0
		) {
			metadata.bookingTypes = data.applicableBookingTypes;
		}

		await updateMutation.mutateAsync({
			id: configurationId,
			label: data.label,
			description: data.description || null,
			color: data.color || null,
			sortOrder: data.sortOrder,
			isDefault: data.isDefault,
			metadata: Object.keys(metadata).length > 0 ? metadata : null,
		});
	};

	const handleQuotationTermsSubmit = async (
		data: QuotationTermsFormValues,
	) => {
		if (!configurationId) {
			return;
		}
		await updateMutation.mutateAsync({
			id: configurationId,
			label: data.label,
			description: data.description || null,
			isDefault: data.isDefault,
			bookingTypeFilter: data.bookingType
				? data.bookingType === "all"
					? null
					: data.bookingType
				: undefined,
			metadata: {
				schemaVersion: 1,
				deliveryTimelines: data.deliveryTimelines.filter((item) =>
					item.text.trim(),
				),
				paymentMilestones: data.paymentMilestones,
				fixedTerms: data.fixedTerms.filter((item) => item.text.trim()),
			},
		});
	};

	const isPackageType = configurationType === "package_type";
	const isBookingType = configurationType === "booking_type";
	const isRelationType = configurationType === "relation_type";
	const isEventType = configurationType === "event_type";
	const isQuotationTerms = configurationType === "quotation_terms";

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent
				side="right"
				className={cn(
					"p-0 gap-0 flex flex-col",
					isPackageType ||
						isBookingType ||
						isRelationType ||
						isEventType ||
						isQuotationTerms
						? "sm:max-w-xl"
						: "sm:max-w-md",
				)}
			>
				<SheetHeader
					className={cn(
						"shrink-0 p-4 transition-shadow duration-200",
						isScrolled &&
							"shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]",
					)}
				>
					<SheetTitle className="text-xl">
						Edit {typeLabel}
					</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					{isLoading || isFetching ? (
						<div className="space-y-4 p-4">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-20 w-full" />
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
						</div>
					) : isQuotationTerms ? (
						<QuotationTermsForm
							defaultValues={configuration?.data}
							onSubmit={handleQuotationTermsSubmit}
							mode="edit"
							isPending={updateMutation.isPending}
							onScrollChange={setIsScrolled}
						/>
					) : isEventType ? (
						<EventTypeForm
							defaultValues={configuration?.data}
							onSubmit={handleEventTypeSubmit}
							mode="edit"
							isPending={updateMutation.isPending}
							onScrollChange={setIsScrolled}
						/>
					) : isRelationType ? (
						<RelationTypeForm
							defaultValues={configuration?.data}
							onSubmit={handleRelationTypeSubmit}
							mode="edit"
							isPending={updateMutation.isPending}
							onScrollChange={setIsScrolled}
						/>
					) : isBookingType ? (
						<BookingTypeForm
							defaultValues={configuration?.data}
							onSubmit={handleBookingTypeSubmit}
							mode="edit"
							isPending={updateMutation.isPending}
							onScrollChange={setIsScrolled}
						/>
					) : isPackageType ? (
						<PackageTypeForm
							defaultValues={configuration?.data}
							onSubmit={handlePackageSubmit}
							mode="edit"
							isPending={updateMutation.isPending}
							onScrollChange={setIsScrolled}
						/>
					) : (
						<ConfigurationForm
							defaultValues={configuration?.data}
							onSubmit={handleSubmit}
							mode="edit"
							isPending={updateMutation.isPending}
							onScrollChange={setIsScrolled}
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
