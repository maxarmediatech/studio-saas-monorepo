"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from "@repo/ui/components/sheet";
import { Button } from "@repo/ui/components/button";
import { X } from "lucide-react";
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
			<SheetContent side="right" className={isPackageType ? "sm:max-w-xl overflow-y-auto" : "sm:max-w-lg"}>
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<div>
						<SheetTitle className="text-xl">Add {typeLabel}</SheetTitle>
						<SheetDescription>Create a new {typeLabel.toLowerCase()}.</SheetDescription>
					</div>
					<Button
						size="icon"
						variant="ghost"
						onClick={close}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</SheetHeader>
				{isPackageType ? (
					<PackageTypeForm
						onSubmit={handlePackageSubmit}
						mode="create"
						isPending={createMutation.isPending}
					/>
				) : (
					<ConfigurationForm
						onSubmit={handleSubmit}
						mode="create"
						isPending={createMutation.isPending}
					/>
				)}
			</SheetContent>
		</Sheet>
	);
}
