"use client";

import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import { Button } from "@repo/ui/components/button";
import { sanitizeRedirectPath } from "@shared/lib/sanitize-redirect-path";
import { parseAsString, useQueryState } from "nuqs";
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
	const providerData = oAuthProviders[provider];

	const redirectPath = invitationId
		? `/organization-invitation/${invitationId}`
		: sanitizeRedirectPath(redirectTo, config.auth.redirectAfterSignIn);

	const onSignin = () => {
		const callbackURL = new URL(redirectPath, window.location.origin);
		authClient.signIn.social({
			provider,
			callbackURL: callbackURL.toString(),
		});
	};

	return (
		<Button
			onClick={() => onSignin()}
			variant="outline"
			type="button"
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
