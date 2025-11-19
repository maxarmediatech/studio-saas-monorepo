import { Document } from "@shared/components/Document";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { type PropsWithChildren, Suspense } from "react";

type Props = PropsWithChildren & {
	params: Promise<{ locale?: string }>;
};

async function PublicContent({
	children,
	locale,
}: PropsWithChildren & { locale: string }) {
	const messages = await getMessages();

	return (
		<Document locale={locale}>
			<NextIntlClientProvider messages={messages}>
				{children}
			</NextIntlClientProvider>
		</Document>
	);
}

export default async function PublicLayout({ children, params }: Props) {
	const { locale } = await params;

	// Enable static rendering with cacheComponents
	if (locale) {
		setRequestLocale(locale);
	}

	return (
		<Suspense fallback={null}>
			<PublicContent locale={locale || "en"}>{children}</PublicContent>
		</Suspense>
	);
}
