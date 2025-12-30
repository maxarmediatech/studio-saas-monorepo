"use client";

import { useState } from "react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConfigurationParams } from "@saas/studio/hooks/params/use-configuration-params";
import { ConfigurationForm, type ConfigurationFormValues } from "../ConfigurationForm";
import { PackageTypeForm, type PackageTypeFormValues } from "../PackageTypeForm";
import { configurationsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";

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
	const { createConfiguration, configurationType, close } = useConfigurationParams();
	const isOpen = Boolean(createConfiguration) && Boolean(configurationType);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const typeLabel = configurationType ? CONFIG_TYPE_LABELS[configurationType] ?? configurationType : "";

	const createMutation = useMutation({
		...configurationsMutations.create(),
		onSuccess: () => {
			toast.success(`${typeLabel} created successfully`);
			// Invalidate all configuration queries (uses ORPC's key generator)
			queryClient.invalidateQueries({ queryKey: orpc.configurations.key() });
			close();
		},
		onError: (error) => {
			toast.error(error.message || `Failed to create ${typeLabel.toLowerCase()}`);
		},
	});

	const handleSubmit = async (data: ConfigurationFormValues) => {
		if (!configurationType) return;

		await createMutation.mutateAsync({
			type: configurationType as "booking_type" | "package_type" | "relation_type" | "crew_status" | "shoot_status" | "task_status" | "task_priority" | "deliverable_status" | "deliverable_priority" | "expense_category",
			key: data.key,
			label: data.label,
			description: data.description || undefined,
			color: data.color || undefined,
			sortOrder: data.sortOrder,
			isDefault: data.isDefault,
		});
	};

	const handlePackageSubmit = async (data: PackageTypeFormValues) => {
		if (!configurationType) return;

		// Build metadata from package-specific fields
		const metadata: Record<string, unknown> = {};
		if (data.bookingType) metadata.bookingType = data.bookingType;
		if (data.defaultCost) metadata.defaultCost = data.defaultCost;
		if (data.defaultDeliverables && data.defaultDeliverables.length > 0) {
			metadata.defaultDeliverables = data.defaultDeliverables;
		}

		await createMutation.mutateAsync({
			type: "package_type",
			key: data.key,
			label: data.label,
			description: data.description || undefined,
			color: data.color || undefined,
			sortOrder: data.sortOrder,
			isDefault: data.isDefault,
			metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
		});
	};

	const isPackageType = configurationType === "package_type";

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent side="right" className={cn("p-0 gap-0 flex flex-col", isPackageType ? "sm:max-w-xl" : "sm:max-w-md")}>
				<SheetHeader
					className={cn(
						"shrink-0 p-4 transition-shadow duration-200",
						isScrolled && "shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]"
					)}
				>
					<SheetTitle className="text-xl">Add {typeLabel}</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					{isPackageType ? (
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
