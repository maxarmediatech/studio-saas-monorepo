"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { TextField } from "@repo/ui/components/form-fields";
import { useAuthErrorMessages } from "@saas/auth/hooks/errors-messages";
import {
	AlertTriangleIcon,
	ArrowLeftIcon,
	Loader2Icon,
	MailboxIcon,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import * as z from "zod";

const formSchema = z.object({
	email: z.string().email(),
});

type FormValues = z.infer<typeof formSchema>;

export function ForgotPasswordForm() {
	const t = useTranslations();
	const { getAuthErrorMessage } = useAuthErrorMessages();

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
		},
	});

	const onSubmit = form.handleSubmit(async ({ email }) => {
		try {
			const redirectTo = new URL(
				"/auth/reset-password",
				window.location.origin,
			).toString();

			const { error } = await authClient.requestPasswordReset({
				email,
				redirectTo,
			});

			if (error) {
				throw error;
			}
		} catch (e) {
			form.setError("root", {
				message: getAuthErrorMessage(
					e && typeof e === "object" && "code" in e
						? (e.code as string)
						: undefined,
				),
			});
		}
	});

	return (
		<>
			<h1 className="font-bold text-xl md:text-2xl">
				{t("auth.forgotPassword.title")}
			</h1>
			<p className="mt-1 mb-6 text-foreground/60">
				{t("auth.forgotPassword.message")}{" "}
			</p>

			{form.formState.isSubmitSuccessful ? (
				<Alert variant="default">
					<MailboxIcon />
					<AlertTitle>
						{t("auth.forgotPassword.hints.linkSent.title")}
					</AlertTitle>
					<AlertDescription>
						{t("auth.forgotPassword.hints.linkSent.message")}
					</AlertDescription>
				</Alert>
			) : (
				<form
					className="flex flex-col items-stretch gap-4"
					onSubmit={onSubmit}
				>
					{form.formState.errors.root && (
						<Alert variant="destructive">
							<AlertTriangleIcon />
							<AlertTitle>
								{form.formState.errors.root.message}
							</AlertTitle>
						</Alert>
					)}

					<TextField
						control={form.control}
						name="email"
						label={t("auth.forgotPassword.email")}
						type="email"
						autoComplete="email"
					/>

					<Button
						type="submit"
						disabled={form.formState.isSubmitting}
					>
						<span className="inline-flex items-center justify-center gap-2">
							{form.formState.isSubmitting && (
								<Loader2Icon
									className="size-4 animate-spin"
									aria-hidden="true"
								/>
							)}
							{t("auth.forgotPassword.submit")}
						</span>
					</Button>
				</form>
			)}

			<div className="mt-6 text-center text-sm">
				<Link href="/auth/login">
					<ArrowLeftIcon className="mr-1 inline size-4 align-middle" />
					{t("auth.forgotPassword.backToSignin")}
				</Link>
			</div>
		</>
	);
}
