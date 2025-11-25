import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import { useQuery } from "@tanstack/react-query";

export type UserPasskey = {
	id: string;
	name?: string | null;
	deviceType?: string | null;
	createdAt: string | Date;
};

export type PasskeyClient = {
	listUserPasskeys?: () => Promise<{
		data: UserPasskey[];
		error?: unknown;
	}>;
	addPasskey?: (options?: unknown) => Promise<unknown>;
	deletePasskey?: (options: { id: string }) => Promise<unknown>;
};

const passkeyClient = (authClient as { passkey?: PasskeyClient }).passkey;

export const hasPasskeySupport = Boolean(passkeyClient?.listUserPasskeys);
export const getPasskeyClient = () => passkeyClient;

export const sessionQueryKey = ["user", "session"] as const;

export const useSessionQuery = () => {
	return useQuery({
		queryKey: sessionQueryKey,
		queryFn: async () => {
			const { data, error } = await authClient.getSession({
				query: {
					disableCookieCache: true,
				},
			});

			if (error) {
				throw new Error(error.message || "Failed to fetch session");
			}

			return data;
		},
		staleTime: Number.POSITIVE_INFINITY,
		refetchOnWindowFocus: false,
		retry: false,
		enabled: config.ui.saas.enabled,
	});
};

export const userAccountQueryKey = ["user", "accounts"] as const;
export const useUserAccountsQuery = () => {
	return useQuery({
		queryKey: userAccountQueryKey,
		queryFn: async () => {
			const { data, error } = await authClient.listAccounts();

			if (error) {
				throw error;
			}

			return data;
		},
	});
};

export const userPasskeyQueryKey = ["user", "passkeys"] as const;
export const useUserPasskeysQuery = () => {
	return useQuery({
		queryKey: userPasskeyQueryKey,
		queryFn: async () => {
			if (!passkeyClient?.listUserPasskeys) {
				return [];
			}

			const { data, error } = await passkeyClient.listUserPasskeys();

			if (error) {
				throw error;
			}

			return data ?? [];
		},
		enabled: Boolean(passkeyClient?.listUserPasskeys),
	});
};
