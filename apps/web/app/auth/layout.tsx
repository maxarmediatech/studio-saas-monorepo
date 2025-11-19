import { SessionProvider } from "@saas/auth/components/SessionProvider";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { Document } from "@shared/components/Document";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { type PropsWithChildren, Suspense } from "react";

type Props = PropsWithChildren & {
	params: Promise<{ locale?: string }>;
};

async function AuthContent({
	children,
	locale,
}: PropsWithChildren & { locale: string }) {
	const messages = await getMessages();

	return (
		<Document locale={locale}>
			<NextIntlClientProvider messages={messages}>
				<SessionProvider>
					<AuthWrapper>{children}</AuthWrapper>
				</SessionProvider>
			</NextIntlClientProvider>
		</Document>
	);
}

export default async function AuthLayout({ children, params }: Props) {
	const { locale } = await params;

	// Enable static rendering with cacheComponents
	if (locale) {
		setRequestLocale(locale);
	}

	return (
		<Suspense fallback={null}>
			<AuthContent locale={locale || "en"}>{children}</AuthContent>
		</Suspense>
	);
}
