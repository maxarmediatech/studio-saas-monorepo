import { config } from "@repo/config";
import { SignupForm } from "@saas/auth/components/SignupForm";
import { getInvitation } from "@saas/auth/lib/server";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { withQuery } from "ufo";

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("auth.signup.title"),
	};
}
export default async function SignupPage({
	searchParams,
}: {
	searchParams: Promise<{
		[key: string]: string | string[] | undefined;
		invitationId?: string;
	}>;
}) {
	const params = await searchParams;
	const { invitationId } = params;

	if (!(config.auth.enableSignup || invitationId)) {
		redirect(withQuery("/auth/login", params));
	}

	if (invitationId) {
		const invitation = await getInvitation(invitationId);

		if (
			!invitation ||
			invitation.status !== "pending" ||
			invitation.expiresAt.getTime() < Date.now()
		) {
			redirect(withQuery("/auth/login", params));
		}

		return (
			<AuthWrapper>
				<SignupForm prefillEmail={invitation.email} />
			</AuthWrapper>
		);
	}

	return (
		<AuthWrapper>
			<SignupForm />
		</AuthWrapper>
	);
}
