import { LoginForm } from "@saas/auth/components/LoginForm";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("auth.login.title"),
	};
}

export default function LoginPage() {
	return (
		<AuthWrapper>
			<LoginForm />
		</AuthWrapper>
	);
}
