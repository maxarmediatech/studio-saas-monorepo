"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { FieldLabel } from "@repo/ui/components/field";
import { CustomField, TextField } from "@repo/ui/components/form-fields";
import { PasswordInput } from "@repo/ui/components/password-input";
import { useAuthErrorMessages } from "@saas/auth/hooks/errors-messages";
import { sessionQueryKey } from "@saas/auth/lib/api";
import { OrganizationInvitationAlert } from "@saas/organizations/components/OrganizationInvitationAlert";
import { setActiveOrganizationSlugCookie } from "@saas/organizations/lib/active-organization-cookie";
import { useRouter } from "@shared/hooks/router";
import { sanitizeRedirectPath } from "@shared/lib/sanitize-redirect-path";
import { useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangleIcon,
	ArrowRightIcon,
	Loader2Icon,
	MailboxIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { withQuery } from "ufo";
import { z } from "zod";
import {
	type OAuthProvider,
	oAuthProviders,
} from "../constants/oauth-providers";
import { useSession } from "../hooks/use-session";
import { LoginModeSwitch } from "./LoginModeSwitch";
import { SocialSigninButton } from "./SocialSigninButton";

const formSchema = z.union([
	z.object({
		mode: z.literal("magic-link"),
		email: z.string().email(),
	}),
	z.object({
		mode: z.literal("password"),
		email: z.string().email(),
		password: z.string().min(1),
	}),
]);

type FormValues = z.infer<typeof formSchema>;

export function LoginForm() {
	const t = useTranslations();
	const { getAuthErrorMessage } = useAuthErrorMessages();
	const router = useRouter();
	const queryClient = useQueryClient();
	const searchParams = useSearchParams();
	const { user, loaded: sessionLoaded } = useSession();

	const invitationId = searchParams.get("invitationId");
	const email = searchParams.get("email");
	const redirectTo = searchParams.get("redirectTo");

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: email ?? "",
			password: "",
			mode: config.auth.enablePasswordLogin ? "password" : "magic-link",
		},
	});

	const redirectPath = invitationId
		? `/organization-invitation/${invitationId}`
		: sanitizeRedirectPath(redirectTo, config.auth.redirectAfterSignIn);

	const resolveRedirectPath = async (path: string) => {
		if (path !== "/app" && path !== "/app/") {
			return path;
		}

		try {
			const { data, error } = await authClient.organization.list();

			if (error) {
				throw error;
			}

			const organization = data?.[0];
			if (!organization?.slug) {
				return path;
			}

			setActiveOrganizationSlugCookie(organization.slug);
			return `/app/${organization.slug}/home`;
		} catch {
			return path;
		}
	};

	useEffect(() => {
		if (sessionLoaded && user) {
			void (async () => {
				router.replace(await resolveRedirectPath(redirectPath));
			})();
		}
	}, [user, sessionLoaded, redirectPath, router]);

	const onSubmit: SubmitHandler<FormValues> = async (values) => {
		try {
			if (values.mode === "password") {
				const { data, error } = await authClient.signIn.email({
					...values,
				});

				if (error) {
					throw error;
				}

				if ((data as any).twoFactorRedirect) {
					router.replace(
						withQuery(
							"/auth/verify",
							Object.fromEntries(searchParams.entries()),
						),
					);
					return;
				}

				queryClient.invalidateQueries({
					queryKey: sessionQueryKey,
				});

				router.replace(await resolveRedirectPath(redirectPath));
			} else {
				const { error } = await authClient.signIn.magicLink({
					...values,
					callbackURL: redirectPath,
				});

				if (error) {
					throw error;
				}
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
	};

	const signinMode = form.watch("mode");

	return (
		<div>
			<h1 className="font-bold text-xl md:text-2xl">
				{t("auth.login.title")}
			</h1>
			<p className="mt-1 mb-6 text-foreground/60">
				{t("auth.login.subtitle")}
			</p>

			{form.formState.isSubmitSuccessful &&
			signinMode === "magic-link" ? (
				<Alert>
					<MailboxIcon />
					<AlertTitle>
						{t("auth.login.hints.linkSent.title")}
					</AlertTitle>
					<AlertDescription>
						{t("auth.login.hints.linkSent.message")}
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
						className="space-y-4"
						onSubmit={form.handleSubmit(onSubmit)}
					>
						{config.auth.enableMagicLink &&
							config.auth.enablePasswordLogin && (
								<LoginModeSwitch
									activeMode={signinMode}
									onChange={(mode) =>
										form.setValue(
											"mode",
											mode as typeof signinMode,
										)
									}
								/>
							)}

						{form.formState.isSubmitted &&
							form.formState.errors.root?.message && (
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
							label={t("auth.signup.email")}
							type="email"
							autoComplete="email"
						/>

						{config.auth.enablePasswordLogin &&
							signinMode === "password" && (
								<CustomField
									control={form.control}
									name="password"
								>
									{({ field, fieldState }) => (
										<>
											<div className="flex justify-between gap-4">
												<FieldLabel
													variant="micro"
													htmlFor={field.name}
												>
													{t("auth.signup.password")}
												</FieldLabel>

												<Link
													href="/auth/forgot-password"
													className="text-foreground/60 text-xs"
												>
													{t(
														"auth.login.forgotPassword",
													)}
												</Link>
											</div>
											<PasswordInput
												{...field}
												id={field.name}
												size="sm"
												autoComplete="current-password"
												aria-invalid={
													fieldState.invalid
												}
											/>
										</>
									)}
								</CustomField>
							)}

						<Button
							className="w-full"
							type="submit"
							variant="default"
							disabled={form.formState.isSubmitting}
						>
							<span className="inline-flex items-center justify-center gap-2">
								{form.formState.isSubmitting && (
									<Loader2Icon
										className="size-4 animate-spin"
										aria-hidden="true"
									/>
								)}
								{signinMode === "magic-link"
									? t("auth.login.sendMagicLink")
									: t("auth.login.submit")}
							</span>
						</Button>
					</form>

					{config.auth.enableSignup && (
						<div className="mt-6 text-center text-sm">
							<span className="text-foreground/60">
								{t("auth.login.dontHaveAnAccount")}{" "}
							</span>
							<Link
								href={withQuery(
									"/auth/signup",
									Object.fromEntries(searchParams.entries()),
								)}
							>
								{t("auth.login.createAnAccount")}
								<ArrowRightIcon className="ml-1 inline size-4 align-middle" />
							</Link>
						</div>
					)}
				</>
			)}
		</div>
	);
}
