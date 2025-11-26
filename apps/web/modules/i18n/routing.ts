import { config } from "@repo/config";

export const locales = Object.keys(config.i18n.locales);
export const defaultLocale = config.i18n.defaultLocale;
