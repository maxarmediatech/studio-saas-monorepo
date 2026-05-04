import { ForgotPasswordForm } from "@saas/auth/components/ForgotPasswordForm";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("auth.forgotPassword.title"),
	};
}

export default function ForgotPasswordPage() {
	return (
		<AuthWrapper>
			<ForgotPasswordForm />
		</AuthWrapper>
	);
}
