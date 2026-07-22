"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { CustomField, TextField } from "@repo/ui/components/form-fields";
import { OrganizationRoleSelect } from "@saas/organizations/components/OrganizationRoleSelect";
import { OrganizationTeamSelect } from "@saas/organizations/components/OrganizationTeamSelect";
import { fullOrganizationQueryKey } from "@saas/organizations/lib/api";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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

export function InviteMemberForm({
	organizationId,
}: {
	organizationId: string;
}) {
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

			form.reset();

			queryClient.invalidateQueries({
				queryKey: fullOrganizationQueryKey(organizationId),
			});

			toast.success(
				t(
					"organizations.settings.members.inviteMember.notifications.success.title",
				),
			);
		} catch {
			toast.error(
				t(
					"organizations.settings.members.inviteMember.notifications.error.title",
				),
			);
		}
	};

	return (
		<SettingsItem
			title={t("organizations.settings.members.inviteMember.title")}
			description={t(
				"organizations.settings.members.inviteMember.description",
			)}
		>
			<form onSubmit={form.handleSubmit(onSubmit)} className="@container">
				<div className="flex @md:flex-row flex-col gap-2">
					<div className="flex-1">
						<TextField
							control={form.control}
							name="email"
							label={t(
								"organizations.settings.members.inviteMember.email",
							)}
							type="email"
						/>
					</div>

					<div>
						<CustomField
							control={form.control}
							name="role"
							label={t(
								"organizations.settings.members.inviteMember.role",
							)}
						>
							{({ field }) => (
								<OrganizationRoleSelect
									value={field.value}
									onSelect={field.onChange}
									excludeOwnerRole
								/>
							)}
						</CustomField>
					</div>
					<div>
						<CustomField
							control={form.control}
							name="teamId"
							label="Team"
						>
							{({ field }) => (
								<OrganizationTeamSelect
									organizationId={organizationId}
									value={field.value}
									onSelect={field.onChange}
								/>
							)}
						</CustomField>
					</div>
				</div>

				<div className="mt-4 flex justify-end">
					<Button
						type="submit"
						// loading={form.formState.isSubmitting}
					>
						{t(
							"organizations.settings.members.inviteMember.submit",
						)}
					</Button>
				</div>
			</form>
		</SettingsItem>
	);
}
