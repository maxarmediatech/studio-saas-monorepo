"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { PasswordField } from "@repo/ui/components/form-fields";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { useRouter } from "@shared/hooks/router";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
	currentPassword: z.string().min(1),
	newPassword: z.string().min(8),
});

export function ChangePasswordForm() {
	const t = useTranslations();
	const router = useRouter();

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			currentPassword: "",
			newPassword: "",
		},
	});

	const onSubmit = form.handleSubmit(async (values) => {
		const { error } = await authClient.changePassword({
			...values,
			revokeOtherSessions: true,
		});

		if (error) {
			toast.error(
				t(
					"settings.account.security.changePassword.notifications.error",
				),
			);

			return;
		}

		toast.success(
			t("settings.account.security.changePassword.notifications.success"),
		);
		form.reset({});
		router.refresh();
	});

	return (
		<SettingsItem
			title={t("settings.account.security.changePassword.title")}
		>
			<form onSubmit={onSubmit}>
				<div className="grid grid-cols-1 gap-4">
					<PasswordField
						control={form.control}
						name="currentPassword"
						label={t(
							"settings.account.security.changePassword.currentPassword",
						)}
						autoComplete="current-password"
					/>

					<PasswordField
						control={form.control}
						name="newPassword"
						label={t(
							"settings.account.security.changePassword.newPassword",
						)}
						autoComplete="new-password"
					/>
					<div className="flex justify-end">
						<Button
							type="submit"
							// loading={form.formState.isSubmitting}
							disabled={
								!(
									form.formState.isValid &&
									Object.keys(form.formState.dirtyFields)
										.length
								)
							}
						>
							{t("settings.save")}
						</Button>
					</div>
				</div>
			</form>
		</SettingsItem>
	);
}
