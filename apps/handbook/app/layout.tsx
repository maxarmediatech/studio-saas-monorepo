import "./global.css";

import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import type { ReactNode } from "react";

const sans = IBM_Plex_Sans({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-handbook-sans",
});

const mono = IBM_Plex_Mono({
	subsets: ["latin"],
	weight: ["400", "500", "600"],
	variable: "--font-handbook-mono",
});

export const metadata: Metadata = {
	title: {
		default: "Studio Handbook",
		template: "%s | Studio Handbook",
	},
	description: "Internal engineering handbook for Studio SaaS.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html
			lang="en"
			className={`${sans.variable} ${mono.variable}`}
			suppressHydrationWarning
		>
			<body>
				<RootProvider>{children}</RootProvider>
			</body>
		</html>
	);
}
