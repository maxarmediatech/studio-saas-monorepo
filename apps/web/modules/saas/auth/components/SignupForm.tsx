"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { PasswordField, TextField } from "@repo/ui/components/form-fields";
import { useAuthErrorMessages } from "@saas/auth/hooks/errors-messages";
import { OrganizationInvitationAlert } from "@saas/organizations/components/OrganizationInvitationAlert";
import { sanitizeRedirectPath } from "@shared/lib/sanitize-redirect-path";
import {
	AlertTriangleIcon,
	ArrowRightIcon,
	Loader2Icon,
	MailboxIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { withQuery } from "ufo";
import { z } from "zod";
import {
	type OAuthProvider,
	oAuthProviders,
} from "../constants/oauth-providers";
import { SocialSigninButton } from "./SocialSigninButton";

const formSchema = z.object({
	email: z.string().email(),
	name: z.string().min(1),
	password: z.string(),
});

export function SignupForm({ prefillEmail }: { prefillEmail?: string }) {
	const t = useTranslations();
	const router = useRouter();
	const { getAuthErrorMessage } = useAuthErrorMessages();
	const searchParams = useSearchParams();

	const invitationId = searchParams.get("invitationId");
	const email = searchParams.get("email");
	const redirectTo = searchParams.get("redirectTo");

	const form = useForm({
		resolver: zodResolver(formSchema),
		values: {
			name: "",
			email: prefillEmail ?? email ?? "",
			password: "",
		},
	});

	const invitationOnlyMode = !config.auth.enableSignup && invitationId;

	const redirectPath = invitationId
		? `/organization-invitation/${invitationId}`
		: sanitizeRedirectPath(redirectTo, config.auth.redirectAfterSignIn);

	const onSubmit = form.handleSubmit(async ({ email, password, name }) => {
		try {
			const { error } = await (config.auth.enablePasswordLogin
				? await authClient.signUp.email({
						email,
						password,
						name,
						callbackURL: redirectPath,
					})
				: authClient.signIn.magicLink({
						email,
						name,
						callbackURL: redirectPath,
					}));

			if (error) {
				throw error;
			}

			if (invitationOnlyMode) {
				const { error } =
					await authClient.organization.acceptInvitation({
						invitationId,
					});

				if (error) {
					throw error;
				}

				router.push(config.auth.redirectAfterSignIn);
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
		<div>
			<h1 className="font-bold text-xl md:text-2xl">
				{t("auth.signup.title")}
			</h1>
			<p className="mt-1 mb-6 text-foreground/60">
				{t("auth.signup.message")}
			</p>

			{form.formState.isSubmitSuccessful && !invitationOnlyMode ? (
				<Alert variant="default">
					<MailboxIcon />
					<AlertDescription>
						{t("auth.signup.hints.verifyEmail")}
					</AlertDescription>
				</Alert>
			) : (
				<>
					{invitationId && (
						<OrganizationInvitationAlert className="mb-6" />
					)}

					{config.auth.enableSignup &&
						config.auth.enableSocialLogin && (
							<>
								<div className="grid grid-cols-1 items-stretch gap-2">
									{Object.keys(oAuthProviders).map(
										(providerId) => (
											<SocialSigninButton
												key={providerId}
												provider={
													providerId as OAuthProvider
												}
											/>
										),
									)}
								</div>

								<div className="relative my-6 h-4">
									<hr className="relative top-2" />
									<p className="-translate-x-1/2 absolute top-0 left-1/2 mx-auto inline-block h-4 bg-card px-2 text-center font-medium text-foreground/60 text-sm leading-tight">
										{t("auth.login.continueWith")}
									</p>
								</div>
							</>
						)}

					<form
						className="flex flex-col items-stretch gap-4"
						onSubmit={onSubmit}
					>
						{form.formState.isSubmitted &&
							form.formState.errors.root && (
								<Alert variant="destructive">
									<AlertTriangleIcon />
									<AlertDescription>
										{form.formState.errors.root.message}
									</AlertDescription>
								</Alert>
							)}

						<TextField
							control={form.control}
							name="name"
							label={t("auth.signup.name")}
						/>

						<TextField
							control={form.control}
							name="email"
							label={t("auth.signup.email")}
							type="email"
							autoComplete="email"
							readOnly={!!prefillEmail}
						/>

						{config.auth.enablePasswordLogin && (
							<PasswordField
								control={form.control}
								name="password"
								label={t("auth.signup.password")}
								autoComplete="new-password"
							/>
						)}

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
								{t("auth.signup.submit")}
							</span>
						</Button>
					</form>
				</>
			)}

			<div className="mt-6 text-center text-sm">
				<span className="text-foreground/60">
					{t("auth.signup.alreadyHaveAccount")}{" "}
				</span>
				<Link
					href={withQuery(
						"/auth/login",
						Object.fromEntries(searchParams.entries()),
					)}
				>
					{t("auth.signup.signIn")}
					<ArrowRightIcon className="ml-1 inline size-4 align-middle" />
				</Link>
			</div>
		</div>
	);
}
