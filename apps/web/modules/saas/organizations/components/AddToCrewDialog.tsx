"use client";

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
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Button } from "@repo/ui/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Loader2Icon } from "lucide-react";
import { crewsMutations } from "@saas/studio/lib/api";

const addToCrewSchema = z.object({
	role: z.string().min(1, "Role is required"),
	dailyRate: z.string().optional().or(z.literal("")),
});

type AddToCrewValues = z.infer<typeof addToCrewSchema>;

// Common crew roles - these will later come from configurations
const CREW_ROLES = [
	{ value: "lead_photographer", label: "Lead Photographer" },
	{ value: "photographer", label: "Photographer" },
	{ value: "lead_videographer", label: "Lead Videographer" },
	{ value: "videographer", label: "Videographer" },
	{ value: "drone_operator", label: "Drone Operator" },
	{ value: "assistant", label: "Assistant" },
	{ value: "editor", label: "Editor" },
	{ value: "member", label: "Member" },
];

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
	const form = useForm<AddToCrewValues>({
		resolver: zodResolver(addToCrewSchema),
		defaultValues: {
			role: "",
			dailyRate: "",
		},
	});

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

	const onSubmit = (values: AddToCrewValues) => {
		createFromMemberMutation.mutate({
			memberId,
			role: values.role,
			dailyRate: values.dailyRate || undefined,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[400px]">
				<DialogHeader>
					<DialogTitle>Add to Crew</DialogTitle>
					<DialogDescription>
						Create a crew profile for <strong>{memberName}</strong>. This allows
						them to be assigned to shoots and tasks.
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="role"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Role *</FormLabel>
									<Select onValueChange={field.onChange} value={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select role" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{CREW_ROLES.map((role) => (
												<SelectItem key={role.value} value={role.value}>
													{role.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
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
										<Input type="number" placeholder="5000" {...field} />
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
							<Button type="submit" disabled={createFromMemberMutation.isPending}>
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
