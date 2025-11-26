import { SessionProvider } from "@saas/auth/components/SessionProvider";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { PropsWithChildren } from "react";

export default async function SaasLayout({
	children,
}: PropsWithChildren) {
	const locale = await getLocale();
	const messages = await getMessages();

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			<SessionProvider>{children}</SessionProvider>
		</NextIntlClientProvider>
	);
}
