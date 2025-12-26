import "../modules/shared/lib/orpc-client.server";

import { config } from "@repo/config";
import "@repo/ui/globals.css";
import { cn } from "@repo/ui/lib/utils";
import { ClientProviders } from "@shared/components/ClientProviders";
import { ConsentProvider } from "@shared/components/ConsentProvider";
import {
	BoundaryProvider,
	BoundaryToggle,
} from "@/modules/ui/components/internal";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { type PropsWithChildren, Suspense } from "react";

const sansFont = Geist({
	weight: ["400", "500", "600", "700"],
	subsets: ["latin"],
	variable: "--font-sans",
});

export const metadata: Metadata = {
	title: {
		absolute: config.appName,
		default: config.appName,
		template: `%s | ${config.appName}`,
	},
};

async function ConsentWrapper({ children }: PropsWithChildren) {
	const cookieStore = await cookies();
	const consentCookie = cookieStore.get("consent");

	return (
		<ConsentProvider initialConsent={consentCookie?.value === "true"}>
			{children}
		</ConsentProvider>
	);
}

export default function RootLayout({ children }: PropsWithChildren) {
	return (
		<html
			lang={config.i18n.defaultLocale}
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
							<BoundaryProvider>
								<ClientProviders>{children}</ClientProviders>
								<BoundaryToggle />
							</BoundaryProvider>
						</ConsentWrapper>
					</Suspense>
				</NuqsAdapter>
			</body>
		</html>
	);
}
