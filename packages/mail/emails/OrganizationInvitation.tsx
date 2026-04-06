import { Heading, Link, Text } from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";
import PrimaryButton from "../src/components/PrimaryButton";
import Wrapper from "../src/components/Wrapper";
import { defaultLocale, defaultTranslations } from "../src/util/translations";
import type { BaseMailProps } from "../types";

export function OrganizationInvitation({
	url,
	organizationName,
	locale,
	translations,
}: {
	url: string;
	organizationName: string;
} & BaseMailProps) {
	const t = createTranslator({
		locale,
		messages: translations,
	});

	return (
		<Wrapper
			preview={t("mail.organizationInvitation.preview", {
				organizationName,
			})}
		>
			<Heading className="m-0 text-2xl font-semibold text-brandInk">
				{t("mail.organizationInvitation.headline", {
					organizationName,
				})}
			</Heading>
			<Text className="mt-4 leading-7">
				{t("mail.organizationInvitation.body", { organizationName })}
			</Text>

			<PrimaryButton href={url}>
				{t("mail.organizationInvitation.join", { organizationName })}
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

OrganizationInvitation.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
	url: "#",
	organizationName: "Stuwiz",
};

export default OrganizationInvitation;
