import { config } from "@repo/config";
import "@repo/ui/globals.css";
import { cn } from "@repo/ui/lib/utils";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import type { PropsWithChildren } from "react";

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
				{children}
			</body>
		</html>
	);
}
