"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { Button } from "@repo/ui/components/button";
import { Switch } from "@repo/ui/components/switch";
import { Loader2Icon } from "lucide-react";
import { configurationsMutations } from "@saas/studio/lib/api";
import type { Configuration } from "@repo/api/modules/studio/schemas/configuration";

const configurationFormSchema = z.object({
	key: z
		.string()
		.min(1, "Key is required")
		.max(100)
		.regex(
			/^[a-z][a-z0-9_]*$/,
			"Key must start with lowercase letter and contain only lowercase letters, numbers, and underscores",
		),
	label: z.string().min(1, "Label is required").max(255),
	description: z.string().max(1000).optional().or(z.literal("")),
	color: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
		.optional()
		.or(z.literal("")),
	sortOrder: z.number().int().min(0).optional(),
	isDefault: z.boolean().optional(),
});

type ConfigurationFormValues = z.infer<typeof configurationFormSchema>;

interface ConfigurationFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	configuration: Configuration | null;
	configType: string;
	configTypeLabel: string;
	onSuccess: () => void;
}

export function ConfigurationFormDialog({
	open,
	onOpenChange,
	configuration,
	configType,
	configTypeLabel,
	onSuccess,
}: ConfigurationFormDialogProps) {
	const isEditing = !!configuration;

	const form = useForm<ConfigurationFormValues>({
		resolver: zodResolver(configurationFormSchema),
		defaultValues: {
			key: "",
			label: "",
			description: "",
			color: "",
			sortOrder: 0,
			isDefault: false,
		},
	});

	// Reset form when dialog opens/closes or configuration changes
	useEffect(() => {
		if (open) {
			if (configuration) {
				form.reset({
					key: configuration.key,
					label: configuration.label,
					description: configuration.description ?? "",
					color: configuration.color ?? "",
					sortOrder: configuration.sortOrder,
					isDefault: configuration.isDefault,
				});
			} else {
				form.reset({
					key: "",
					label: "",
					description: "",
					color: "",
					sortOrder: 0,
					isDefault: false,
				});
			}
		}
	}, [open, configuration, form]);

	const createMutation = useMutation({
		...configurationsMutations.create(),
		onSuccess: () => {
			toast.success(`${configTypeLabel} created successfully`);
			onSuccess();
		},
		onError: (error) => {
			toast.error(error.message || `Failed to create ${configTypeLabel.toLowerCase()}`);
		},
	});

	const updateMutation = useMutation({
		...configurationsMutations.update(),
		onSuccess: () => {
			toast.success(`${configTypeLabel} updated successfully`);
			onSuccess();
		},
		onError: (error) => {
			toast.error(error.message || `Failed to update ${configTypeLabel.toLowerCase()}`);
		},
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	const onSubmit = (values: ConfigurationFormValues) => {
		if (isEditing && configuration) {
			updateMutation.mutate({
				id: configuration.id,
				label: values.label,
				description: values.description || null,
				color: values.color || null,
				sortOrder: values.sortOrder,
				isDefault: values.isDefault,
			});
		} else {
			createMutation.mutate({
				type: configType as "booking_type" | "package_type" | "relation_type" | "crew_status" | "shoot_status" | "task_status" | "task_priority" | "deliverable_status" | "deliverable_priority" | "expense_category",
				key: values.key,
				label: values.label,
				description: values.description || undefined,
				color: values.color || undefined,
				sortOrder: values.sortOrder,
				isDefault: values.isDefault,
			});
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>
						{isEditing ? `Edit ${configTypeLabel}` : `Add ${configTypeLabel}`}
					</DialogTitle>
					<DialogDescription>
						{isEditing
							? `Update the ${configTypeLabel.toLowerCase()} details.`
							: `Create a new ${configTypeLabel.toLowerCase()}.`}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						{!isEditing && (
							<FormField
								control={form.control}
								name="key"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Key *</FormLabel>
										<FormControl>
											<Input
												placeholder="e.g., wedding_premium"
												{...field}
											/>
										</FormControl>
										<FormDescription>
											Unique identifier (lowercase, underscores allowed)
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						<FormField
							control={form.control}
							name="label"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Label *</FormLabel>
									<FormControl>
										<Input placeholder="Display name" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Optional description"
											className="resize-none"
											rows={2}
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="color"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Color</FormLabel>
										<FormControl>
											<div className="flex gap-2">
												<Input
													type="color"
													className="w-12 h-10 p-1 cursor-pointer"
													value={field.value || "#6B7280"}
													onChange={(e) => field.onChange(e.target.value)}
												/>
												<Input
													placeholder="#6B7280"
													{...field}
													className="flex-1"
												/>
											</div>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="sortOrder"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Sort Order</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={0}
												placeholder="0"
												{...field}
												value={field.value ?? 0}
												onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="isDefault"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
									<div className="space-y-0.5">
										<FormLabel>Default</FormLabel>
										<FormDescription>
											Pre-select this option in forms
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={isPending}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending && (
									<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
								)}
								{isEditing ? "Save Changes" : "Create"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
