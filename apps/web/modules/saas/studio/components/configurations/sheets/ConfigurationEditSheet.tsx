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
import { useState } from "react";
import { toast } from "sonner";
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
	RelationTypeForm,
	type RelationTypeFormValues,
} from "../RelationTypeForm";

const CONFIG_TYPE_LABELS: Record<string, string> = {
	booking_type: "Booking Type",
	package_type: "Package Type",
	relation_type: "Relation Type",
	event_type: "Event Type",
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
	const isOpen = Boolean(configurationId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const typeLabel = configurationType
		? (CONFIG_TYPE_LABELS[configurationType] ?? configurationType)
		: "";

	const { data: configuration, isLoading } = useQuery({
		...configurationsApi.getOptions(configurationId ?? ""),
		enabled: isOpen && !!configurationId,
	});

	const updateMutation = useMutation({
		...configurationsMutations.update(),
		onSuccess: () => {
			toast.success(`${typeLabel} updated successfully`);
			// Use ORPC's key generator to match the booking form's query keys
			queryClient.invalidateQueries({
				queryKey: orpc.configurations.key(),
			});
			close();
		},
		onError: (error) => {
			toast.error(
				error.message || `Failed to update ${typeLabel.toLowerCase()}`,
			);
		},
	});

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

		// Build metadata from package-specific fields
		const metadata: Record<string, unknown> = {};
		if (data.bookingType) {
			metadata.bookingType = data.bookingType;
		}
		if (data.defaultCost) {
			metadata.defaultCost = data.defaultCost;
		}
		if (data.defaultDeliverables && data.defaultDeliverables.length > 0) {
			metadata.defaultDeliverables = data.defaultDeliverables;
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

	const isPackageType = configurationType === "package_type";
	const isBookingType = configurationType === "booking_type";
	const isRelationType = configurationType === "relation_type";
	const isEventType = configurationType === "event_type";

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent
				side="right"
				className={cn(
					"p-0 gap-0 flex flex-col",
					isPackageType ||
						isBookingType ||
						isRelationType ||
						isEventType
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
					{isLoading ? (
						<div className="space-y-4 p-4">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-20 w-full" />
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
						</div>
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
