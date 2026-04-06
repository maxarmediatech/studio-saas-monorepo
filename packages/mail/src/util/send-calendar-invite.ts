import { sendEmail } from "./send";

export async function sendCalendarInviteEmail(params: {
	to: string;
	subject: string;
	text: string;
	html?: string;
	icsFilename?: string;
	icsContent: string;
}) {
	const filename = params.icsFilename ?? "invite.ics";

	const content = Buffer.from(params.icsContent, "utf8").toString("base64");

	await sendEmail({
		to: params.to,
		subject: params.subject,
		text: params.text,
		html: params.html,
		attachments: [
			{
				filename,
				content,
				contentType: "text/calendar; charset=utf-8",
			},
		],
	});
}
