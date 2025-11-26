import { SessionProvider } from "@saas/auth/components/SessionProvider";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { type PropsWithChildren, Suspense } from "react";

async function AuthContent({ children }: PropsWithChildren) {
	const locale = await getLocale();
	const messages = await getMessages();

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			<SessionProvider>
				<AuthWrapper>{children}</AuthWrapper>
			</SessionProvider>
		</NextIntlClientProvider>
	);
}

export default function AuthLayout({ children }: PropsWithChildren) {
	return (
		<Suspense fallback={null}>
			<AuthContent>{children}</AuthContent>
		</Suspense>
	);
}
