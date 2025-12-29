"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from "@repo/ui/components/sheet";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConfigurationParams } from "@saas/studio/hooks/params/use-configuration-params";
import { ConfigurationForm, type ConfigurationFormValues } from "../ConfigurationForm";
import { PackageTypeForm, type PackageTypeFormValues } from "../PackageTypeForm";
import { configurationsApi, configurationsMutations } from "@saas/studio/lib/api";

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

export function ConfigurationEditSheet() {
	const { configurationId, configurationType, close } = useConfigurationParams();
	const isOpen = Boolean(configurationId);
	const queryClient = useQueryClient();

	const typeLabel = configurationType ? CONFIG_TYPE_LABELS[configurationType] ?? configurationType : "";

	const { data: configuration, isLoading } = useQuery({
		...configurationsApi.getOptions(configurationId!),
		enabled: isOpen && !!configurationId,
	});

	const updateMutation = useMutation({
		...configurationsMutations.update(),
		onSuccess: () => {
			toast.success(`${typeLabel} updated successfully`);
			queryClient.invalidateQueries({ queryKey: ["studio", "configurations"] });
			close();
		},
		onError: (error) => {
			toast.error(error.message || `Failed to update ${typeLabel.toLowerCase()}`);
		},
	});

	const handleSubmit = async (data: ConfigurationFormValues) => {
		if (!configurationId) return;

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
		if (!configurationId) return;

		// Build metadata from package-specific fields
		const metadata: Record<string, unknown> = {};
		if (data.bookingType) metadata.bookingType = data.bookingType;
		if (data.defaultCost) metadata.defaultCost = data.defaultCost;
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

	const isPackageType = configurationType === "package_type";

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent side="right" className={isPackageType ? "sm:max-w-xl overflow-y-auto" : "sm:max-w-lg"}>
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<div>
						<SheetTitle className="text-xl">Edit {typeLabel}</SheetTitle>
						<SheetDescription>Update the {typeLabel.toLowerCase()} details.</SheetDescription>
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
				{isLoading ? (
					<div className="space-y-4">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-20 w-full" />
						<div className="grid grid-cols-2 gap-4">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
						</div>
					</div>
				) : isPackageType ? (
					<PackageTypeForm
						defaultValues={configuration?.data}
						onSubmit={handlePackageSubmit}
						mode="edit"
						isPending={updateMutation.isPending}
					/>
				) : (
					<ConfigurationForm
						defaultValues={configuration?.data}
						onSubmit={handleSubmit}
						mode="edit"
						isPending={updateMutation.isPending}
					/>
				)}
			</SheetContent>
		</Sheet>
	);
}
