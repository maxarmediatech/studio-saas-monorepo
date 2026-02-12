"use client";

import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import { Button } from "@repo/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { setActiveOrganizationSlugCookie } from "@saas/organizations/lib/active-organization-cookie";
import {
	ArrowLeftIcon,
	Loader2Icon,
	LogOutIcon,
	RotateCcwIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const DEFAULT_BACK_PATH = "/new-organization?redirectTo=%2Fapp";
const DEFAULT_RESTART_PATH = `/onboarding?redirectTo=${encodeURIComponent(
	DEFAULT_BACK_PATH,
)}`;

type Props = {
	backHref?: string;
	restartRedirectHref?: string;
	showBack?: boolean;
	showRestart?: boolean;
};

const SESSION_REFRESH_RETRY_DELAYS_MS = [0, 200, 400, 800] as const;

async function ensureOnboardingResetSession() {
	for (const delayMs of SESSION_REFRESH_RETRY_DELAYS_MS) {
		if (delayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}

		const { data, error } = await authClient.getSession({
			query: { disableCookieCache: true },
		});

		if (!error && data && data.user.onboardingComplete === false) {
			return;
		}
	}

	throw new Error("Session refresh did not reflect onboarding reset");
}

export function ChoosePlanRecoveryActions({
	backHref = DEFAULT_BACK_PATH,
	restartRedirectHref = DEFAULT_RESTART_PATH,
	showBack = true,
	showRestart = false,
}: Props) {
	const [isResetting, setIsResetting] = useState(false);
	const [isSigningOut, setIsSigningOut] = useState(false);

	const onResetSetup = async () => {
		if (isResetting || isSigningOut) {
			return;
		}

		setIsResetting(true);
		try {
			const { error } = await authClient.updateUser({
				onboardingComplete: false,
			});

			if (error) {
				throw error;
			}

			await ensureOnboardingResetSession();

			setActiveOrganizationSlugCookie(null);
			window.location.href = restartRedirectHref;
		} catch {
			setIsResetting(false);
			toast.error("Could not reset setup. Please try again.");
		}
	};

	const onSignOut = () => {
		if (isResetting || isSigningOut) {
			return;
		}

		setIsSigningOut(true);
		authClient.signOut({
			fetchOptions: {
				onSuccess: async () => {
					window.location.href = new URL(
						config.auth.redirectAfterLogout,
						window.location.origin,
					).toString();
				},
			},
		});
	};

	return (
		<div className="flex flex-wrap items-center justify-end gap-2">
			{showBack && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							aria-label="Back"
							onClick={() => {
								window.location.href = backHref;
							}}
							disabled={isResetting || isSigningOut}
						>
							<ArrowLeftIcon className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">Back</TooltipContent>
				</Tooltip>
			)}

			{showRestart && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="icon"
							aria-label="Restart setup"
							onClick={() => void onResetSetup()}
							disabled={isResetting || isSigningOut}
						>
							{isResetting ? (
								<Loader2Icon className="size-4 animate-spin" />
							) : (
								<RotateCcwIcon className="size-4" />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">Restart setup</TooltipContent>
				</Tooltip>
			)}

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						aria-label="Sign out"
						onClick={onSignOut}
						disabled={isResetting || isSigningOut}
					>
						{isSigningOut ? (
							<Loader2Icon className="size-4 animate-spin" />
						) : (
							<LogOutIcon className="size-4" />
						)}
					</Button>
				</TooltipTrigger>
				<TooltipContent side="bottom">Sign out</TooltipContent>
			</Tooltip>
		</div>
	);
}
