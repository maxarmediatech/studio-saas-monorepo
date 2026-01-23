"use client";
import { authClient } from "@repo/auth/client";
import { sessionQueryKey, useSessionQuery } from "@saas/auth/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { SessionContext } from "../lib/session-context";

export function SessionProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();

	const { data: session } = useSessionQuery();
	const [loaded, setLoaded] = useState(!!session);
	const timezoneSyncAttemptedRef = useRef(false);

	useEffect(() => {
		if (session && !loaded) {
			setLoaded(true);
		}
	}, [session]);

	useEffect(() => {
		if (!session?.user) return;
		if (timezoneSyncAttemptedRef.current) return;

		const browserTimeZone =
			Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (!browserTimeZone) return;

		const currentTimeZone = session.user.timezone ?? null;
		if (currentTimeZone === browserTimeZone) {
			timezoneSyncAttemptedRef.current = true;
			return;
		}

		timezoneSyncAttemptedRef.current = true;
		void (async () => {
			const { error } = await authClient.updateUser({
				timezone: browserTimeZone,
			});
			if (!error) {
				const { data: newSession, error: sessionError } =
					await authClient.getSession({
						query: { disableCookieCache: true },
					});
				if (!sessionError) {
					queryClient.setQueryData(sessionQueryKey, () => newSession);
				}
			}
		})();
	}, [session?.user?.id, session?.user?.timezone]);

	return (
		<SessionContext.Provider
			value={{
				loaded,
				session: session?.session ?? null,
				user: session?.user ?? null,
				reloadSession: async () => {
					const { data: newSession, error } =
						await authClient.getSession({
							query: {
								disableCookieCache: true,
							},
						});

					if (error) {
						throw new Error(
							error.message || "Failed to fetch session",
						);
					}

					queryClient.setQueryData(sessionQueryKey, () => newSession);
				},
			}}
		>
			{children}
		</SessionContext.Provider>
	);
}
