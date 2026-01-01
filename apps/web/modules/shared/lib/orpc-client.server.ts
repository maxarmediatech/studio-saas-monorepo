import "server-only";

import { createRouterClient } from "@orpc/server";
import type { ApiRouterClient } from "@repo/api/orpc/router";
import { router } from "@repo/api/orpc/router";
import { headers } from "next/headers";

declare global {
	var $orpcClient: ApiRouterClient | undefined;
}

globalThis.$orpcClient = createRouterClient(router, {
	context: async () => ({
		headers: await headers(),
	}),
}) as ApiRouterClient;

export const orpcClient: ApiRouterClient = globalThis.$orpcClient;
