import { protectedProcedure } from "../../../orpc/procedures";
import { assertChannelAccess } from "../lib/channel-access";
import { resolveDiscussionRouteContext } from "../lib/route-context";
import { getChannelInputSchema } from "../schemas";

export const getChannel = protectedProcedure
	.route({
		method: "GET",
		path: "/discussions/channels/{channelId}",
		tags: ["Discussions"],
		summary: "Get channel by ID",
	})
	.input(getChannelInputSchema)
	.handler(async ({ input, context: baseContext }) => {
		const context = await resolveDiscussionRouteContext(
			input.organizationSlug,
			baseContext,
		);

		const channel = await assertChannelAccess(input.channelId, context);
		return { data: channel };
	});
