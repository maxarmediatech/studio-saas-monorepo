import { Img } from "@react-email/components";
import { config } from "@repo/config";
import React from "react";

function getAssetUrl(path: string) {
	const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
		? process.env.NEXT_PUBLIC_SITE_URL
		: process.env.NEXT_PUBLIC_VERCEL_URL
			? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
			: "http://localhost:3000";

	return new URL(path, baseUrl).toString();
}

export function Logo({ withLabel = true }: { withLabel?: boolean }) {
	return (
		<Img
			alt={`${config.appName} logo`}
			height={withLabel ? 40 : 48}
			src={getAssetUrl(
				withLabel ? "/images/brand/stuwiz-logo-dark.png" : "/icon.png",
			)}
			style={{ display: "block" }}
			width={withLabel ? 153 : 48}
		/>
	);
}
