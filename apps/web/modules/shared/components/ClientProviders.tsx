"use client";

import { AnalyticsScript } from "@analytics";
import { ProgressProvider } from "@bprogress/next/app";
import { Toaster } from "@repo/ui/components/sonner";
import { ApiClientProvider } from "@shared/components/ApiClientProvider";
import { ThemeProvider } from "next-themes";
import type { PropsWithChildren } from "react";

type ClientProvidersProps = PropsWithChildren<{
	defaultTheme: string;
	themes: string[];
}>;

export function ClientProviders({
	children,
	defaultTheme,
	themes,
}: ClientProvidersProps) {
	const singleTheme = themes.length === 1 ? themes[0] : undefined;

	return (
		<ApiClientProvider>
			<ProgressProvider
				height="4px"
				color="var(--color-primary)"
				options={{ showSpinner: false }}
				shallowRouting
				delay={250}
			>
				<ThemeProvider
					attribute="class"
					disableTransitionOnChange
					enableSystem={!singleTheme}
					forcedTheme={singleTheme}
					defaultTheme={singleTheme ?? defaultTheme}
					themes={themes}
				>
					<ApiClientProvider>
						{children}

						<Toaster position="top-right" />
						{/* Todo - comeback to it when goes international */}
						{/* <ConsentBanner /> */}
						<AnalyticsScript />
					</ApiClientProvider>
				</ThemeProvider>
			</ProgressProvider>
		</ApiClientProvider>
	);
}
