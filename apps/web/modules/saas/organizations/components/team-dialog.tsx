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
import { Input } from "@repo/ui/components/input";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const teamSchema = z.object({
	name: z.string().min(1, "Team name is required"),
});

type TeamFormValues = z.infer<typeof teamSchema>;

interface TeamDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "create" | "edit";
	defaultName?: string;
	isSaving?: boolean;
	onSave: (name: string) => void;
}

export function TeamDialog({
	open,
	onOpenChange,
	mode,
	defaultName,
	isSaving,
	onSave,
}: TeamDialogProps) {
	const form = useForm<TeamFormValues>({
		resolver: zodResolver(teamSchema),
		defaultValues: {
			name: defaultName ?? "",
		},
	});

	useEffect(() => {
		if (open) {
			form.reset({ name: defaultName ?? "" });
		}
	}, [defaultName, form, open]);

	const onSubmit = (values: TeamFormValues) => {
		onSave(values.name.trim());
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[420px]">
				<DialogHeader>
					<DialogTitle>
						{mode === "create" ? "Create Team" : "Rename Team"}
					</DialogTitle>
					<DialogDescription>
						{mode === "create"
							? "Add a new team to organize members and assignments."
							: "Update the team name to keep things organized."}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Team name</FormLabel>
									<FormControl>
										<Input
											placeholder="Production"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button
								variant="ghost"
								onClick={() => onOpenChange(false)}
								disabled={isSaving}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isSaving}>
								{mode === "create" ? "Create Team" : "Save Changes"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
