"use client";

import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import { Button } from "@repo/ui/components/button";
import { sanitizeRedirectPath } from "@shared/lib/sanitize-redirect-path";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { withQuery } from "ufo";
import { oAuthProviders } from "../constants/oauth-providers";

export function SocialSigninButton({
	provider,
	className,
}: {
	provider: keyof typeof oAuthProviders;
	className?: string;
}) {
	const [invitationId] = useQueryState("invitationId", parseAsString);
	const [redirectTo] = useQueryState("redirectTo", parseAsString);
	const [isLoading, setIsLoading] = useState(false);
	const providerData = oAuthProviders[provider];

	const redirectPath = invitationId
		? `/organization-invitation/${invitationId}`
		: sanitizeRedirectPath(redirectTo, config.auth.redirectAfterSignIn);
	const callbackPath = withQuery("/auth/complete", {
		redirectTo: redirectPath,
	});
	const errorCallbackPath = withQuery("/auth/error", {
		redirectTo: redirectPath,
	});

	const onSignin = async () => {
		if (isLoading) {
			return;
		}

		setIsLoading(true);
		const callbackURL = new URL(callbackPath, window.location.origin);
		const errorCallbackURL = new URL(
			errorCallbackPath,
			window.location.origin,
		);

		const { data, error } = await authClient.signIn.social({
			provider,
			callbackURL: callbackURL.toString(),
			errorCallbackURL: errorCallbackURL.toString(),
			disableRedirect: true,
		});

		if (error) {
			window.location.replace(errorCallbackURL.toString());
			return;
		}

		const redirectUrl =
			data && typeof data === "object" && "url" in data
				? data.url
				: undefined;

		if (typeof redirectUrl === "string" && redirectUrl) {
			window.location.replace(redirectUrl);
			return;
		}

		window.location.replace(errorCallbackURL.toString());
	};

	return (
		<Button
			onClick={() => void onSignin()}
			variant="outline"
			type="button"
			disabled={isLoading}
			className={`w-full justify-center ${className ?? ""}`}
		>
			{providerData.icon && (
				<span className="mr-2 inline-flex items-center">
					<providerData.icon className="size-4" aria-hidden="true" />
				</span>
			)}
			{providerData.name}
		</Button>
	);
}
