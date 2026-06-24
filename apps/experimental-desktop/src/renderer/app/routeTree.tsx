import { createRootRoute, createRoute, Outlet } from "@tanstack/react-router";
import { CaptureRoute } from "../routes/capture";
import { ConversationRoute } from "../routes/conversation.$conversationId";
import { DraftRoute } from "../routes/draft.$draftId";
import { RootRoute } from "../routes/root";

const rootRoute = createRootRoute({
	component: () => <Outlet />,
});

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: RootRoute,
});

const draftRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/draft/$draftId",
	component: DraftRoute,
});

const conversationRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/conversation/$conversationId",
	component: ConversationRoute,
});

const captureRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/capture",
	component: CaptureRoute,
});

export const routeTree = rootRoute.addChildren([
	indexRoute,
	draftRoute,
	conversationRoute,
	captureRoute,
]);
