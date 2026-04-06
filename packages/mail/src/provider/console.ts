import { logger } from "@repo/logs";
import type { SendEmailHandler } from "../../types";

export const send: SendEmailHandler = async ({
	to,
	subject,
	text,
	from,
	replyTo,
	attachments,
}) => {
	let formattedOutput = `Sending email to ${to} with subject ${subject}\n\n`;
	if (from) {
		formattedOutput += `From: ${from.name ? `${from.name} <${from.address}>` : from.address}\n`;
	}
	if (replyTo) {
		formattedOutput += `Reply-To: ${replyTo}\n`;
	}
	if (from || replyTo) {
		formattedOutput += "\n";
	}

	formattedOutput += `Text: ${text}\n\n`;
	if (attachments && attachments.length > 0) {
		formattedOutput += `Attachments: ${attachments
			.map((a) => a.filename)
			.join(", ")}\n\n`;
	}

	logger.log(formattedOutput);
};
