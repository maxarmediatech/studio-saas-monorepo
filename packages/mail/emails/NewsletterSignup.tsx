import { Heading, Text } from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";
import Wrapper from "../src/components/Wrapper";
import { defaultLocale, defaultTranslations } from "../src/util/translations";
import type { BaseMailProps } from "../types";

export function NewsletterSignup({ locale, translations }: BaseMailProps) {
	const t = createTranslator({
		locale,
		messages: translations,
	});

	return (
		<Wrapper preview={t("mail.newsletterSignup.preview")}>
			<Heading className="m-0 text-2xl font-semibold text-brandInk">
				{t("mail.newsletterSignup.subject")}
			</Heading>
			<Text className="mt-4 leading-7">
				{t("mail.newsletterSignup.body")}
			</Text>
		</Wrapper>
	);
}

NewsletterSignup.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
};

export default NewsletterSignup;
