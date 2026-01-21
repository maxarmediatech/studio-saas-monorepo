import { studioProtectedProcedure } from "../../../orpc/procedures";
import { getChannelBySlugWithAccess } from "../lib/channel-access";
import { getChannelBySlugInputSchema } from "../schemas";

export const getChannelBySlug = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/discussions/channels/by-slug/{slug}",
		tags: ["Discussions"],
		summary: "Get channel by slug",
	})
	.input(getChannelBySlugInputSchema)
	.handler(async ({ input, context }) => {
		const channel = await getChannelBySlugWithAccess(input.slug, context);
		return { data: channel };
	});
