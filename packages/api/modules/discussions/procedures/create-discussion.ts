import { ORPCError } from "@orpc/server";
import {
	crews,
	db,
	discussionLinks,
	discussionMentions,
	discussions,
	inArray,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { assertChannelAccess } from "../lib/channel-access";
import { verifyLinkEntityExists } from "../lib/verify-link-entity";
import { createDiscussionInputSchema } from "../schemas";

interface ExtractedMention {
	id: string;
	label: string;
}

function extractMentionsFromJson(
	node: Record<string, unknown>,
): ExtractedMention[] {
	const mentions: ExtractedMention[] = [];

	if (node.type === "mention" && node.attrs) {
		const attrs = node.attrs as Record<string, unknown>;
		if (typeof attrs.id === "string" && typeof attrs.label === "string") {
			mentions.push({ id: attrs.id, label: attrs.label });
		}
	}

	if (Array.isArray(node.content)) {
		for (const child of node.content) {
			mentions.push(
				...extractMentionsFromJson(child as Record<string, unknown>),
			);
		}
	}

	return mentions;
}

function extractTextFromJson(node: Record<string, unknown>): string {
	if (node.type === "text" && typeof node.text === "string") {
		return node.text;
	}
	if (
		node.type === "mention" &&
		node.attrs &&
		typeof (node.attrs as Record<string, unknown>).label === "string"
	) {
		return `@${(node.attrs as Record<string, unknown>).label}`;
	}
	if (node.type === "hardBreak") {
		return "\n";
	}
	if (Array.isArray(node.content)) {
		return node.content
			.map((child) =>
				extractTextFromJson(child as Record<string, unknown>),
			)
			.join(
				node.type === "paragraph" || node.type === "heading"
					? "\n"
					: "",
			);
	}
	return "";
}

export const createDiscussion = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/discussions/posts",
		tags: ["Discussions"],
		summary: "Create a new discussion",
	})
	.input(createDiscussionInputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "discussion", "create");
		await assertChannelAccess(input.channelId, context);

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

		const contentText = input.contentJson
			? extractTextFromJson(input.contentJson as Record<string, unknown>)
			: (input.content ?? "");

		return await db.transaction(async (tx) => {
			const [discussion] = await tx
				.insert(discussions)
				.values({
					organizationId: context.organizationId,
					channelId: input.channelId,
					title: input.title,
					content: input.content ?? contentText,
					contentJson: input.contentJson,
					contentText,
					createdBy: context.user.id,
					updatedBy: context.user.id,
					lastActivityAt: new Date(),
				})
				.returning();

			if (input.links?.length) {
				await tx.insert(discussionLinks).values(
					input.links.map((link) => ({
						discussionId: discussion.id,
						organizationId: context.organizationId,
						entityType: link.entityType,
						entityId: link.entityId,
						createdBy: context.user.id,
					})),
				);
			}

			if (input.contentJson) {
				const mentions = extractMentionsFromJson(
					input.contentJson as Record<string, unknown>,
				);

				if (mentions.length > 0) {
					const crewIds = [...new Set(mentions.map((m) => m.id))];
					const crewsWithUsers = await tx.query.crews.findMany({
						where: inArray(crews.id, crewIds),
						columns: { id: true, userId: true },
					});

					const mentionsToInsert = crewsWithUsers
						.filter((c) => c.userId !== null)
						.map((c) => ({
							entityType: "discussion" as const,
							entityId: discussion.id,
							mentionedUserId: c.userId as string,
						}));

					if (mentionsToInsert.length > 0) {
						await tx
							.insert(discussionMentions)
							.values(mentionsToInsert)
							.onConflictDoNothing();
					}
				}
			}

			return { data: discussion };
		});
	});
