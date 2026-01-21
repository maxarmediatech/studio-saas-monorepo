import { studioProtectedProcedure } from "../../../orpc/procedures";
import { assertChannelAccess } from "../lib/channel-access";
import { getChannelInputSchema } from "../schemas";

export const getChannel = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/discussions/channels/{channelId}",
		tags: ["Discussions"],
		summary: "Get channel by ID",
	})
	.input(getChannelInputSchema)
	.handler(async ({ input, context }) => {
		const channel = await assertChannelAccess(input.channelId, context);
		return { data: channel };
	});
