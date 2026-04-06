import { Button } from "@react-email/components";
import React, { type PropsWithChildren } from "react";

export default function PrimaryButton({
	href,
	children,
}: PropsWithChildren<{
	href: string;
}>) {
	return (
		<Button
			href={href}
			className="rounded-full px-5 py-3 text-base font-semibold no-underline"
			style={{
				backgroundColor: "#18181b",
				color: "#ffffff",
				display: "inline-block",
				fontWeight: 600,
				textDecoration: "none",
			}}
		>
			{children}
		</Button>
	);
}
