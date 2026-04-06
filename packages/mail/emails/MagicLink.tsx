import { Link, Text } from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";
import PrimaryButton from "../src/components/PrimaryButton";
import Wrapper from "../src/components/Wrapper";
import { defaultLocale, defaultTranslations } from "../src/util/translations";
import type { BaseMailProps } from "../types";

export function MagicLink({
	url,
	locale,
	translations,
}: {
	url: string;
} & BaseMailProps) {
	const t = createTranslator({
		locale,
		messages: translations,
	});

	return (
		<Wrapper preview={t("mail.magicLink.preview")}>
			<Text>{t("mail.magicLink.body")}</Text>

			<Text>{t("mail.common.useLink")}</Text>

			<PrimaryButton href={url}>
				{t("mail.magicLink.login")} &rarr;
			</PrimaryButton>

			<Text className="mt-6 text-brandMuted text-sm leading-6">
				{t("mail.common.openLinkInBrowser")}
				<Link
					href={url}
					className="text-brandLink"
					style={{ wordBreak: "break-all" }}
				>
					{url}
				</Link>
			</Text>
		</Wrapper>
	);
}

MagicLink.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
	url: "#",
};

export default MagicLink;
