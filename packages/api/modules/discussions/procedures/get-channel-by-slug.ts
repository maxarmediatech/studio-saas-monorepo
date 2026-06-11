import { protectedProcedure } from "../../../orpc/procedures";
import { getChannelBySlugWithAccess } from "../lib/channel-access";
import { resolveDiscussionRouteContext } from "../lib/route-context";
import { getChannelBySlugInputSchema } from "../schemas";

export const getChannelBySlug = protectedProcedure
	.route({
		method: "GET",
		path: "/discussions/channels/by-slug/{slug}",
		tags: ["Discussions"],
		summary: "Get channel by slug",
	})
	.input(getChannelBySlugInputSchema)
	.handler(async ({ input, context: baseContext }) => {
		const context = await resolveDiscussionRouteContext(
			input.organizationSlug,
			baseContext,
		);

		const channel = await getChannelBySlugWithAccess(input.slug, context);
		return { data: channel };
	});
