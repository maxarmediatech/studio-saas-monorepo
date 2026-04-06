import {
	Body,
	Container,
	Head,
	Html,
	Preview,
	Section,
	Tailwind,
} from "@react-email/components";
import React, { type PropsWithChildren } from "react";
import { Logo } from "./Logo";

export default function Wrapper({
	children,
	preview,
}: PropsWithChildren<{
	preview: string;
}>) {
	return (
		<Html lang="en">
			<Head />
			<Preview>{preview}</Preview>
			<Tailwind
				config={{
					theme: {
						extend: {
							colors: {
								brandBg: "#f6f3ee",
								brandBorder: "#e7e0d6",
								brandCard: "#ffffff",
								brandInk: "#1f2937",
								brandMuted: "#6b7280",
								brandLink: "#111827",
							},
						},
					},
				}}
			>
				<Body
					className="m-0 bg-brandBg p-0 text-brandInk"
					style={{
						fontFamily:
							'"Helvetica Neue", Arial, "Segoe UI", sans-serif',
						margin: 0,
					}}
				>
					<Section className="bg-brandBg px-4 py-8">
						<Container className="mx-auto rounded-3xl border border-solid border-brandBorder bg-brandCard px-8 py-8 text-brandInk">
							<Logo />
							{children}
						</Container>
					</Section>
				</Body>
			</Tailwind>
		</Html>
	);
}
