import { addChannelMember } from "./procedures/add-channel-member";
import { addDiscussionLink } from "./procedures/add-discussion-link";
import { createChannel } from "./procedures/create-channel";
import { createDiscussion } from "./procedures/create-discussion";
import { createMessage } from "./procedures/create-message";
import { deleteChannel } from "./procedures/delete-channel";
import { deleteDiscussion } from "./procedures/delete-discussion";
import { deleteMessage } from "./procedures/delete-message";
import { getChannel } from "./procedures/get-channel";
import { getChannelBySlug } from "./procedures/get-channel-by-slug";
import { getDiscussion } from "./procedures/get-discussion";
import { listChannels } from "./procedures/list-channels";
import { listDiscussions } from "./procedures/list-discussions";
import { listMessages } from "./procedures/list-messages";
import { removeChannelMember } from "./procedures/remove-channel-member";
import { removeDiscussionLink } from "./procedures/remove-discussion-link";
import { reopenDiscussion } from "./procedures/reopen-discussion";
import { resolveDiscussion } from "./procedures/resolve-discussion";
import { toggleSubscription } from "./procedures/toggle-subscription";
import { updateChannel } from "./procedures/update-channel";
import { updateDiscussion } from "./procedures/update-discussion";
import { updateMessage } from "./procedures/update-message";

export const discussionsRouter = {
	createChannel,
	listChannels,
	getChannel,
	getChannelBySlug,
	updateChannel,
	deleteChannel,
	addChannelMember,
	removeChannelMember,
	toggleSubscription,
	createDiscussion,
	listDiscussions,
	getDiscussion,
	updateDiscussion,
	deleteDiscussion,
	resolveDiscussion,
	reopenDiscussion,
	addDiscussionLink,
	removeDiscussionLink,
	createMessage,
	listMessages,
	updateMessage,
	deleteMessage,
};
