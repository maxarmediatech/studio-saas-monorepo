import { ORPCError } from "@orpc/server";
import { checkins, db, eq } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { buildRichTextContent } from "../../discussions/lib/rich-text";
import { assertCheckinOwnership } from "../lib/checkin-access";
import { updateCheckinInputSchema } from "../schemas";

export const updateCheckin = studioProtectedProcedure
	.route({
		method: "PATCH",
		path: "/checkins/posts/{checkinId}",
		tags: ["Checkins"],
		summary: "Update a checkin",
	})
	.input(updateCheckinInputSchema)
	.handler(async ({ input, context }) => {
		await assertCheckinOwnership(input.checkinId, context);

		let derivedContent:
			| {
					content: string | null;
					contentJson: unknown;
					contentText: string;
			  }
			| undefined;

		if (input.content || input.contentJson) {
			const richText = buildRichTextContent({
				content: input.content,
				contentJson: input.contentJson,
				maxBytes: 200 * 1024,
			});

			if (!richText.validation.ok) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Invalid checkin content",
				});
			}

			derivedContent = {
				content: richText.text || null,
				contentJson: richText.json,
				contentText: richText.text,
			};
		}

		const [updated] = await db
			.update(checkins)
			.set({
				content: derivedContent?.content,
				contentJson: derivedContent?.contentJson,
				contentText: derivedContent?.contentText,
				updatedBy: context.user.id,
				updatedAt: new Date(),
			})
			.where(eq(checkins.id, input.checkinId))
			.returning();

		return { data: updated };
	});
