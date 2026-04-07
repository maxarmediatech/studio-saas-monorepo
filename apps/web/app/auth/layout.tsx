import { SessionProvider } from "@saas/auth/components/SessionProvider";
import { FullPageLoader } from "@shared/components/LogoSpinner";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { type PropsWithChildren, Suspense } from "react";

async function AuthContent({ children }: PropsWithChildren) {
	const locale = await getLocale();
	const messages = await getMessages();

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			<SessionProvider>{children}</SessionProvider>
		</NextIntlClientProvider>
	);
}

export default function AuthLayout({ children }: PropsWithChildren) {
	return (
		<Suspense fallback={<FullPageLoader />}>
			<AuthContent>{children}</AuthContent>
		</Suspense>
	);
}
