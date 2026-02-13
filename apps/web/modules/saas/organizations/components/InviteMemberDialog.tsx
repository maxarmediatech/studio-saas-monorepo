"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
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
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { OrganizationRoleSelect } from "@saas/organizations/components/OrganizationRoleSelect";
import { OrganizationTeamSelect } from "@saas/organizations/components/OrganizationTeamSelect";
import { fullOrganizationQueryKey } from "@saas/organizations/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
	email: z.string().email(),
	role: z.array(z.string()).min(1),
	teamId: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface InviteMemberDialogProps {
	organizationId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function InviteMemberDialog({
	organizationId,
	open,
	onOpenChange,
}: InviteMemberDialogProps) {
	type InviteRoleInput = Parameters<
		typeof authClient.organization.inviteMember
	>[0]["role"];
	const t = useTranslations();
	const queryClient = useQueryClient();

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
			role: ["member"],
			teamId: null,
		},
	});

	useEffect(() => {
		if (!open) {
			form.reset();
		}
	}, [open, form]);

	const onSubmit: SubmitHandler<FormValues> = async (values) => {
		try {
			const roleInput = values.role as InviteRoleInput;
			const teamId = values.teamId ?? undefined;
			const { error } = await authClient.organization.inviteMember({
				email: values.email,
				role: roleInput,
				teamId,
				organizationId,
			});

			if (error) {
				throw error;
			}

			queryClient.invalidateQueries({
				queryKey: fullOrganizationQueryKey(organizationId),
			});

			toast.success(
				t(
					"organizations.settings.members.inviteMember.notifications.success.title",
				),
			);

			onOpenChange(false);
		} catch {
			toast.error(
				t(
					"organizations.settings.members.inviteMember.notifications.error.title",
				),
			);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle>
						{t(
							"organizations.settings.members.inviteMember.title",
						)}
					</DialogTitle>
					<DialogDescription>
						{t(
							"organizations.settings.members.inviteMember.description",
						)}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4"
					>
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t(
											"organizations.settings.members.inviteMember.email",
										)}
									</FormLabel>
									<FormControl>
										<Input type="email" {...field} />
									</FormControl>
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="role"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t(
											"organizations.settings.members.inviteMember.role",
										)}
									</FormLabel>
									<FormControl>
										<OrganizationRoleSelect
											value={field.value}
											onSelect={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="teamId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Team</FormLabel>
									<FormControl>
										<OrganizationTeamSelect
											organizationId={organizationId}
											value={field.value}
											onSelect={field.onChange}
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
								disabled={form.formState.isSubmitting}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={form.formState.isSubmitting}
							>
								{form.formState.isSubmitting && (
									<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
								)}
								{t(
									"organizations.settings.members.inviteMember.submit",
								)}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
