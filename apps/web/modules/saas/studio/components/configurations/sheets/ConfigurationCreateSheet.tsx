"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useConfigurationParams } from "@saas/studio/hooks/params/use-configuration-params";
import { configurationsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
	PackageTypeForm,
	type PackageTypeFormValues,
} from "../PackageTypeForm";
import {
	RelationTypeForm,
	type RelationTypeFormValues,
} from "../RelationTypeForm";

/**
 * Generates a URL-safe key from a label.
 * - Converts to lowercase
 * - Replaces spaces and special chars with underscores
 * - Removes consecutive underscores
 * - Ensures it starts with a letter
 * - Truncates to 100 chars (backend limit)
 */
function generateKeyFromLabel(label: string): string {
	let key = label
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "_") // Replace non-alphanumeric with underscore
		.replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
		.replace(/_+/g, "_"); // Collapse multiple underscores

	// Ensure key starts with a letter (prepend 'cfg_' if it starts with a number or is empty)
	if (!key || /^[0-9]/.test(key)) {
		key = key ? `cfg_${key}` : "item";
	}

	// Truncate to 100 chars (backend limit)
	if (key.length > 100) {
		// Try to cut at last underscore for cleaner break, but keep at least 10 chars
		const truncated = key.slice(0, 100);
		const lastUnderscore = truncated.lastIndexOf("_");
		key =
			lastUnderscore > 10
				? truncated.slice(0, lastUnderscore)
				: truncated;
	}

	return key;
}

const CONFIG_TYPE_LABELS: Record<string, string> = {
	booking_type: "Booking Type",
	package_type: "Package Type",
	relation_type: "Relation Type",
	shoot_status: "Shoot Status",
	crew_role: "Crew Role",
	task_status: "Task Status",
	task_priority: "Task Priority",
	deliverable_status: "Deliverable Status",
	deliverable_priority: "Deliverable Priority",
	expense_category: "Expense Category",
};

export function ConfigurationCreateSheet() {
	const { createConfiguration, configurationType, close } =
		useConfigurationParams();
	const isOpen = Boolean(createConfiguration) && Boolean(configurationType);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const typeLabel = configurationType
		? (CONFIG_TYPE_LABELS[configurationType] ?? configurationType)
		: "";

	const createMutation = useMutation({
		...configurationsMutations.create(),
		onSuccess: () => {
			toast.success(`${typeLabel} created successfully`);
			// Invalidate all configuration queries (uses ORPC's key generator)
			queryClient.invalidateQueries({
				queryKey: orpc.configurations.key(),
			});
			close();
		},
		onError: (error) => {
			toast.error(
				error.message || `Failed to create ${typeLabel.toLowerCase()}`,
			);
		},
	});

	const handleSubmit = async (data: ConfigurationFormValues) => {
		if (!configurationType) {
			return;
		}

		await createMutation.mutateAsync({
			type: configurationType as
				| "booking_type"
				| "package_type"
				| "relation_type"
				| "crew_status"
				| "shoot_status"
				| "task_status"
				| "task_priority"
				| "deliverable_status"
				| "deliverable_priority"
				| "expense_category",
			key: generateKeyFromLabel(data.label),
			label: data.label,
			description: data.description || undefined,
			color: data.color || undefined,
			sortOrder: data.sortOrder,
			isDefault: data.isDefault,
		});
	};

	const handlePackageSubmit = async (data: PackageTypeFormValues) => {
		if (!configurationType) {
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

		await createMutation.mutateAsync({
			type: "package_type",
			key: generateKeyFromLabel(data.label),
			label: data.label,
			description: data.description || undefined,
			color: data.color || undefined,
			sortOrder: data.sortOrder,
			isDefault: data.isDefault,
			metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
		});
	};

	const handleBookingTypeSubmit = async (data: BookingTypeFormValues) => {
		if (!configurationType) {
			return;
		}

		// Build metadata from booking type-specific fields
		const metadata: Record<string, unknown> = {};
		if (data.applicableRoles && data.applicableRoles.length > 0) {
			metadata.roles = data.applicableRoles;
		}

		await createMutation.mutateAsync({
			type: "booking_type",
			key: generateKeyFromLabel(data.label),
			label: data.label,
			description: data.description || undefined,
			color: data.color || undefined,
			sortOrder: data.sortOrder,
			isDefault: data.isDefault,
			metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
		});
	};

	const handleRelationTypeSubmit = async (data: RelationTypeFormValues) => {
		if (!configurationType) {
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

		await createMutation.mutateAsync({
			type: "relation_type",
			key: generateKeyFromLabel(data.label),
			label: data.label,
			description: data.description || undefined,
			color: data.color || undefined,
			sortOrder: data.sortOrder,
			isDefault: data.isDefault,
			metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
		});
	};

	const isPackageType = configurationType === "package_type";
	const isBookingType = configurationType === "booking_type";
	const isRelationType = configurationType === "relation_type";

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent
				side="right"
				className={cn(
					"p-0 gap-0 flex flex-col",
					isPackageType || isBookingType || isRelationType
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
					<SheetTitle className="text-xl">Add {typeLabel}</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					{isRelationType ? (
						<RelationTypeForm
							onSubmit={handleRelationTypeSubmit}
							mode="create"
							isPending={createMutation.isPending}
							onScrollChange={setIsScrolled}
						/>
					) : isBookingType ? (
						<BookingTypeForm
							onSubmit={handleBookingTypeSubmit}
							mode="create"
							isPending={createMutation.isPending}
							onScrollChange={setIsScrolled}
						/>
					) : isPackageType ? (
						<PackageTypeForm
							onSubmit={handlePackageSubmit}
							mode="create"
							isPending={createMutation.isPending}
							onScrollChange={setIsScrolled}
						/>
					) : (
						<ConfigurationForm
							onSubmit={handleSubmit}
							mode="create"
							isPending={createMutation.isPending}
							onScrollChange={setIsScrolled}
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
