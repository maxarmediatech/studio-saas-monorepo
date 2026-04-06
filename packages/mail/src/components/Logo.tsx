import { Img } from "@react-email/components";
import { config } from "@repo/config";
import { getPublicAssetBaseUrl } from "@repo/utils";
import React from "react";

function getAssetUrl(path: string) {
	// Email images must stay on a public asset host; auth/invite action links are
	// intentionally built from the active app origin elsewhere.
	return new URL(path, getPublicAssetBaseUrl()).toString();
}

export function Logo({ withLabel = true }: { withLabel?: boolean }) {
	return (
		<Img
			alt={`${config.appName} logo`}
			height={withLabel ? 46 : 40}
			src={getAssetUrl(
				withLabel
					? "/images/brand/stuwiz-logo-dark.png"
					: "/images/brand/stuwiz-mark-tight.png",
			)}
			style={{ display: "block", marginBottom: "8px" }}
			width={withLabel ? 176 : 64}
		/>
	);
}
