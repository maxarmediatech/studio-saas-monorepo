import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { type PropsWithChildren, Suspense } from "react";

type Props = PropsWithChildren & {
	params: Promise<{ locale: string }>;
};

async function PublicContent({
	children,
	locale,
}: PropsWithChildren & { locale: string }) {
	const messages = await getMessages();

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			{children}
		</NextIntlClientProvider>
	);
}

export default async function PublicLayout({ children, params }: Props) {
	const { locale } = await params;

	// Enable static rendering with cacheComponents
	setRequestLocale(locale);

	return (
		<Suspense fallback={null}>
			<PublicContent locale={locale}>{children}</PublicContent>
		</Suspense>
	);
}
