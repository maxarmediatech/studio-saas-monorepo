import { ORPCError } from "@orpc/server";
import { checkinLinks, checkins, db } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { buildRichTextContent } from "../../discussions/lib/rich-text";
import { verifyLinkEntityExists } from "../../discussions/lib/verify-link-entity";
import { normalizeTimeZone } from "../../studio/lib/date-helpers";
import { assertCheckinTypeAccess } from "../lib/checkin-access";
import { computeCheckinDate } from "../lib/checkin-date";
import { createCheckinInputSchema } from "../schemas";

export const createCheckin = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/checkins/posts",
		tags: ["Checkins"],
		summary: "Create a new checkin",
	})
	.input(createCheckinInputSchema)
	.handler(async ({ input, context }) => {
		const checkinType = await assertCheckinTypeAccess(
			input.checkinTypeId,
			context,
		);
		const headerTimeZone = context.headers.get("x-user-timezone");
		const timezone = normalizeTimeZone(
			headerTimeZone ??
				context.user.timezone ??
				context.membership.organization.timezone,
		);
		const effectiveCheckinDate = computeCheckinDate({
			scheduledTime: checkinType.scheduledTime,
			frequency: checkinType.frequency,
			timezone,
		});

		if (input.links?.length) {
			for (const link of input.links) {
				const exists = await verifyLinkEntityExists(
					link.entityType,
					link.entityId,
					context.organizationId,
				);
				if (!exists) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Linked ${link.entityType} not found or access denied`,
					});
				}
			}
		}

		try {
			return await db.transaction(async (tx) => {
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

				const [checkin] = await tx
					.insert(checkins)
					.values({
						organizationId: context.organizationId,
						checkinTypeId: input.checkinTypeId,
						content:
							derivedContent?.content ?? input.content ?? null,
						contentJson: derivedContent?.contentJson ?? null,
						contentText: derivedContent?.contentText ?? null,
						checkinDate: new Date(effectiveCheckinDate),
						createdBy: context.user.id,
						updatedBy: context.user.id,
					})
					.returning();

				if (input.links?.length) {
					await tx.insert(checkinLinks).values(
						input.links.map((link) => ({
							checkinId: checkin.id,
							organizationId: context.organizationId,
							entityType: link.entityType,
							entityId: link.entityId,
							createdBy: context.user.id,
						})),
					);
				}

				return { data: checkin };
			});
		} catch (error) {
			const errorString = String(error);
			const causeString =
				error instanceof Error && "cause" in error
					? String(error.cause)
					: "";

			if (
				errorString.includes("checkins_type_user_date_unique") ||
				causeString.includes("checkins_type_user_date_unique")
			) {
				throw new ORPCError("CONFLICT", {
					message:
						"You have already posted a checkin for this period. Edit your existing checkin instead.",
				});
			}
			throw error;
		}
	});
