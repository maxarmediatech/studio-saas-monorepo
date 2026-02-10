"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/button";
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
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@repo/ui/components/input-group";
import { MultiSelectCombobox } from "@repo/ui/components/multi-select-combobox";
import { configurationsApi, crewsMutations } from "@saas/studio/lib/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const addToCrewSchema = z.object({
	dailyRate: z.string().optional().or(z.literal("")),
	specializations: z.array(z.string().min(1).max(100)).default([]),
});

type AddToCrewValues = z.infer<typeof addToCrewSchema>;
type AddToCrewFormValues = z.input<typeof addToCrewSchema>;

interface AddToCrewDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	memberId: string;
	memberName: string;
	onSuccess: () => void;
}

export function AddToCrewDialog({
	open,
	onOpenChange,
	memberId,
	memberName,
	onSuccess,
}: AddToCrewDialogProps) {
	const form = useForm<AddToCrewFormValues>({
		resolver: zodResolver(addToCrewSchema),
		defaultValues: {
			dailyRate: "",
			specializations: [],
		},
	});
	const { data: specializationOptionsData } = useQuery(
		configurationsApi.specialisationsOptions(),
	);
	const specializationOptions =
		specializationOptionsData?.data?.map((item) => ({
			value: item.key,
			label: item.label,
		})) ?? [];

	const createFromMemberMutation = useMutation({
		...crewsMutations.createFromMember(),
		onSuccess: () => {
			toast.success(`${memberName} has been added to the crew`);
			form.reset();
			onSuccess();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to add member to crew");
		},
	});

	const onSubmit = (values: AddToCrewFormValues) => {
		const parsed: AddToCrewValues = addToCrewSchema.parse(values);
		createFromMemberMutation.mutate({
			memberId,
			dailyRate: parsed.dailyRate || undefined,
			specializations: parsed.specializations,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[400px]">
				<DialogHeader>
					<DialogTitle>Add to Crew</DialogTitle>
					<DialogDescription>
						Create a crew profile for <strong>{memberName}</strong>.
						This allows them to be assigned to shoots and tasks.
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4"
					>
						<FormField
							control={form.control}
							name="specializations"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Specialisations</FormLabel>
									<FormControl>
										<MultiSelectCombobox
											options={specializationOptions}
											value={field.value ?? []}
											onValueChange={field.onChange}
											placeholder="Select specialisations"
											searchPlaceholder="Search specialisations..."
											emptyText="No specialisation found."
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="dailyRate"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Daily Rate (INR)</FormLabel>
									<FormControl>
										<InputGroup>
											<InputGroupAddon>
												<InputGroupText>
													₹
												</InputGroupText>
											</InputGroupAddon>
											<InputGroupInput
												type="number"
												placeholder="5000"
												{...field}
											/>
										</InputGroup>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={createFromMemberMutation.isPending}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={createFromMemberMutation.isPending}
							>
								{createFromMemberMutation.isPending && (
									<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
								)}
								Add to Crew
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
