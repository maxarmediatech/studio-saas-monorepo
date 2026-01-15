import { getSubscriptionStatus } from "./procedures/get-subscription-status";
import { listYourWork } from "./procedures/list-your-work";
import { subscribeToEntity } from "./procedures/subscribe";
import { unsubscribeFromEntity } from "./procedures/unsubscribe";

export const yourWorkRouter = {
	list: listYourWork,
	subscribe: subscribeToEntity,
	unsubscribe: unsubscribeFromEntity,
	subscriptionStatus: getSubscriptionStatus,
};
