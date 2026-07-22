import { organizationRouteMiddleware } from "../../../orpc/organization-route";
import { protectedProcedure } from "../../../orpc/procedures";
import { assertChannelAccess } from "../lib/channel-access";
import { getChannelInputSchema } from "../schemas";

export const getChannel = protectedProcedure
	.route({
		method: "GET",
		path: "/discussions/channels/{channelId}",
		tags: ["Discussions"],
		summary: "Get channel by ID",
	})
	.input(getChannelInputSchema)
	.use(organizationRouteMiddleware, (input) => input.organizationSlug)
	.handler(async ({ input, context }) => {
		const channel = await assertChannelAccess(input.channelId, context);
		return { data: channel };
	});
