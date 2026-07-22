"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "@repo/ui/components/field";
import { TextField } from "@repo/ui/components/form-fields";
import { useSession } from "@saas/auth/hooks/use-session";
import { UserAvatarUpload } from "@saas/settings/components/UserAvatarUpload";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
	name: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export function OnboardingStep1({
	onCompleted,
}: {
	onCompleted: () => Promise<void>;
}) {
	const t = useTranslations();
	const { user, reloadSession } = useSession();
	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: user?.name ?? "",
		},
	});

	useEffect(() => {
		if (user) {
			form.setValue("name", user.name ?? "");
		}
	}, [user]);

	const onSubmit: SubmitHandler<FormValues> = async ({ name }) => {
		form.clearErrors("root");

		try {
			const { error } = await authClient.updateUser({
				name,
				onboardingComplete: true,
			});

			if (error) {
				throw error;
			}

			await reloadSession();
			await onCompleted();
		} catch {
			form.setError("root", {
				type: "server",
				message: t("onboarding.notifications.accountSetupFailed"),
			});
			toast.error(t("onboarding.notifications.accountSetupFailed"));
		}
	};

	return (
		<div>
			<form
				className="flex flex-col items-stretch gap-8"
				onSubmit={form.handleSubmit(onSubmit)}
			>
				<TextField
					control={form.control}
					name="name"
					label={t("onboarding.account.name")}
				/>

				<Field orientation="horizontal" className="justify-between">
					<FieldContent>
						<FieldLabel>
							{t("onboarding.account.avatar")}
						</FieldLabel>
						<FieldDescription>
							{t("onboarding.account.avatarDescription")}
						</FieldDescription>
					</FieldContent>
					<UserAvatarUpload
						onSuccess={() => {
							return;
						}}
						onError={() => {
							return;
						}}
					/>
				</Field>

				<Button type="submit" disabled={form.formState.isSubmitting}>
					<span className="inline-flex items-center gap-2">
						{form.formState.isSubmitting && (
							<Loader2Icon className="size-4 animate-spin" />
						)}
						{t("onboarding.continue")}
					</span>
					<ArrowRightIcon className="ml-2 size-4" />
				</Button>
				{form.formState.errors.root?.message && (
					<p className="text-destructive text-sm">
						{form.formState.errors.root.message}
					</p>
				)}
			</form>
		</div>
	);
}
