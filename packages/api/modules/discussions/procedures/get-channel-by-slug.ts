import { organizationRouteMiddleware } from "../../../orpc/organization-route";
import { protectedProcedure } from "../../../orpc/procedures";
import { getChannelBySlugWithAccess } from "../lib/channel-access";
import { getChannelBySlugInputSchema } from "../schemas";

export const getChannelBySlug = protectedProcedure
	.route({
		method: "GET",
		path: "/discussions/channels/by-slug/{slug}",
		tags: ["Discussions"],
		summary: "Get channel by slug",
	})
	.input(getChannelBySlugInputSchema)
	.use(organizationRouteMiddleware, (input) => input.organizationSlug)
	.handler(async ({ input, context }) => {
		const channel = await getChannelBySlugWithAccess(input.slug, context);
		return { data: channel };
	});
