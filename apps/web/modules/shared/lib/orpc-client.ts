import { createORPCClient, onError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ApiRouterClient } from "@repo/api/orpc/router";
import { getBaseUrl } from "@repo/utils";

declare global {
	var $orpcClient: ApiRouterClient | undefined;
}

const link = new RPCLink({
	url: () => {
		if (typeof window === "undefined") {
			throw new Error("RPCLink should not be used on the server side.");
		}
		return `${getBaseUrl()}/api/rpc`;
	},
	headers: () => ({
		"x-user-timezone":
			Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
	}),
	interceptors: [
		onError((error) => {
			if (error instanceof Error && error.name === "AbortError") {
				return;
			}

			console.error(error);
		}),
	],
});

export const orpcClient: ApiRouterClient =
	globalThis.$orpcClient ?? createORPCClient(link);
