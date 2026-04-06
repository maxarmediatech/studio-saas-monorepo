import { config } from "@repo/config";
import { logger } from "@repo/logs";
import type { mailTemplates } from "../../emails";
import { send } from "../provider";
import type { TemplateId } from "./templates";
import { getTemplate } from "./templates";

export async function sendEmail<T extends TemplateId>(
	params: {
		to: string;
		locale?: keyof typeof config.i18n.locales;
	} & (
		| {
				templateId: T;
				context: Omit<
					Parameters<(typeof mailTemplates)[T]>[0],
					"locale" | "translations"
				>;
		  }
		| {
				subject: string;
				text?: string;
				html?: string;
				from?: Parameters<typeof send>[0]["from"];
				replyTo?: Parameters<typeof send>[0]["replyTo"];
				attachments?: Parameters<typeof send>[0]["attachments"];
		  }
	),
) {
	const { to, locale = config.i18n.defaultLocale } = params;

	let html: string;
	let text: string;
	let subject: string;

	if ("templateId" in params) {
		const { templateId, context } = params;
		const template = await getTemplate({
			templateId,
			context,
			locale,
		});
		subject = template.subject;
		text = template.text;
		html = template.html;
	} else {
		subject = params.subject;
		text = params.text ?? "";
		html = params.html ?? "";
	}

	try {
		await send({
			to,
			subject,
			text,
			html,
			from: "from" in params ? params.from : undefined,
			replyTo: "replyTo" in params ? params.replyTo : undefined,
			attachments:
				"attachments" in params ? params.attachments : undefined,
		});
	} catch (error) {
		logger.error("mail.send.failed", {
			error,
			subject,
			to,
		});
		throw error;
	}
}
