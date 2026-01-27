import { logger } from "@repo/logs";
import type { SendEmailHandler } from "../../types";

export const send: SendEmailHandler = async ({
	to,
	subject,
	text,
	attachments,
}) => {
	let formattedOutput = `Sending email to ${to} with subject ${subject}\n\n`;

	formattedOutput += `Text: ${text}\n\n`;
	if (attachments && attachments.length > 0) {
		formattedOutput += `Attachments: ${attachments
			.map((a) => a.filename)
			.join(", ")}\n\n`;
	}

	logger.log(formattedOutput);
};
