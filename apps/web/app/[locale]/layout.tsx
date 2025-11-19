import { routing } from "@i18n/routing";
import { cn } from "@repo/ui/lib/utils";
import { ClientProviders } from "@shared/components/ClientProviders";
import { ConsentProvider } from "@shared/components/ConsentProvider";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { type PropsWithChildren, Suspense } from "react";

const sansFont = Geist({
	weight: ["400", "500", "600", "700"],
	subsets: ["latin"],
	variable: "--font-sans",
});

type Props = PropsWithChildren & {
	params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
	return routing.locales.map((locale) => ({ locale }));
}

async function ConsentWrapper({ children }: PropsWithChildren) {
	const cookieStore = await cookies();
	const consentCookie = cookieStore.get("consent");

	return (
		<ConsentProvider initialConsent={consentCookie?.value === "true"}>
			{children}
		</ConsentProvider>
	);
}

export default async function LocaleLayout({ children, params }: Props) {
	const { locale } = await params;

	// Ensure the locale is valid
	if (!routing.locales.includes(locale as any)) {
		notFound();
	}

	// Enable static rendering with cacheComponents
	setRequestLocale(locale);

	return (
		<html
			lang={locale}
			suppressHydrationWarning
			className={sansFont.className}
		>
			<body
				className={cn(
					"min-h-screen bg-background text-foreground antialiased",
				)}
			>
				<NuqsAdapter>
					<Suspense fallback={null}>
						<ConsentWrapper>
							<ClientProviders>{children}</ClientProviders>
						</ConsentWrapper>
					</Suspense>
				</NuqsAdapter>
			</body>
		</html>
	);
}
