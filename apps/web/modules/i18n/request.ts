import { getUserLocale } from "@i18n/lib/locale-cookie";
import { defaultLocale, locales } from "@i18n/routing";
import { getMessagesForLocale } from "@repo/i18n";
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
	let locale = await getUserLocale();

	if (!locales.includes(locale)) {
		locale = defaultLocale;
	}

	return {
		locale,
		messages: await getMessagesForLocale(locale),
	};
});
