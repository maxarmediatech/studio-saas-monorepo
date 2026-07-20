"use client";
import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import { Button } from "@repo/ui/components/button";
import { Progress } from "@repo/ui/components/progress";
import { setActiveOrganizationSlugCookie } from "@saas/organizations/lib/active-organization-cookie";
import { useRouter } from "@shared/hooks/router";
import { sanitizeRedirectPath } from "@shared/lib/sanitize-redirect-path";
import { ArrowLeftIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { withQuery } from "ufo";
import { OnboardingStep1 } from "./OnboardingStep1";

export function OnboardingForm() {
	const t = useTranslations();
	const router = useRouter();
	const searchParams = useSearchParams();

	const stepSearchParam = searchParams.get("step");
	const redirectTo = searchParams.get("redirectTo");
	const onboardingStepRaw = stepSearchParam
		? Number.parseInt(stepSearchParam, 10)
		: 1;

	const resolveRedirectPath = async (path: string) => {
		if (path !== "/app" && path !== "/app/") {
			return path;
		}

		if (!config.organizations.enable) {
			return path;
		}

		try {
			const { data, error } = await authClient.organization.list();

			if (error) {
				throw error;
			}

			const organization = data?.[0];
			if (organization?.slug) {
				setActiveOrganizationSlugCookie(organization.slug);
				return `/app/${organization.slug}/home`;
			}

			if (config.organizations.requireOrganization) {
				return `/new-organization?redirectTo=${encodeURIComponent("/app")}`;
			}

			return path;
		} catch {
			return path;
		}
	};

	const onCompleted = async () => {
		const safeRedirectPath = sanitizeRedirectPath(
			redirectTo,
			config.auth.redirectAfterSignIn,
		);
		const resolvedRedirectPath =
			await resolveRedirectPath(safeRedirectPath);
		router.replace(resolvedRedirectPath);
		router.refresh();
	};

	const steps = [
		{
			component: <OnboardingStep1 onCompleted={onCompleted} />,
		},
	];
	const totalSteps = steps.length;
	const onboardingStep = Number.isNaN(onboardingStepRaw)
		? 1
		: Math.min(Math.max(onboardingStepRaw, 1), totalSteps);
	const canGoBack = onboardingStep > 1;

	const setStep = (step: number) => {
		const normalizedStep = Math.min(Math.max(step, 1), totalSteps);
		router.replace(
			withQuery(window.location.search ?? "", {
				step: normalizedStep,
			}),
		);
	};

	return (
		<div>
			<h1 className="font-bold text-xl md:text-2xl">
				{t("onboarding.title")}
			</h1>
			<p className="mt-2 mb-6 text-foreground/60">
				{t("onboarding.message")}
			</p>

			{canGoBack && (
				<Button
					variant="ghost"
					className="-ml-3 mb-2 h-8 px-2 text-foreground/70"
					onClick={() => setStep(onboardingStep - 1)}
				>
					<ArrowLeftIcon className="size-4" />
					Back
				</Button>
			)}

			{totalSteps > 1 && (
				<div className="mb-6 flex items-center gap-3">
					<Progress
						value={(onboardingStep / totalSteps) * 100}
						className="h-2"
					/>
					<span className="shrink-0 text-foreground/60 text-xs">
						{t("onboarding.step", {
							step: onboardingStep,
							total: totalSteps,
						})}
					</span>
				</div>
			)}

			{steps[onboardingStep - 1]?.component}
		</div>
	);
}
