import { ORPCError } from "@orpc/client";
import { config } from "@repo/config";
import { logger } from "@repo/logs";
import { sendEmail } from "@repo/mail";
import { localeMiddleware } from "../../../orpc/middleware/locale-middleware";
import { publicProcedure } from "../../../orpc/procedures";
import { contactFormSchema } from "../types";

export const submitContactForm = publicProcedure
	.route({
		method: "POST",
		path: "/contact",
		tags: ["Contact"],
		summary: "Submit contact form",
	})
	.input(contactFormSchema)
	.use(localeMiddleware)
	.handler(
		async ({ input: { email, name, message }, context: { locale } }) => {
			try {
				await sendEmail({
					to: config.contactForm.to,
					locale,
					replyTo: email,
					subject: config.contactForm.subject,
					text: `Name: ${name}\n\nEmail: ${email}\n\nMessage: ${message}`,
				});
			} catch (error) {
				logger.error("contact.email.send_failed", {
					email,
					error,
					name,
				});
				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}
		},
	);
