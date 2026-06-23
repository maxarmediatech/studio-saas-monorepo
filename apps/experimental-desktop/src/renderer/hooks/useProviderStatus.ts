import { useCallback, useEffect, useState } from "react";
import type {
	CodexProviderStatus,
	OpenAiAuthStatus,
} from "../../preload/types";

type ProviderState = {
	openAiStatus?: OpenAiAuthStatus;
	codexStatus?: CodexProviderStatus;
	statusLabel: string;
	detail: string;
	busy: boolean;
};

const initialState: ProviderState = {
	statusLabel: "Checking sidecar...",
	detail: "Sidecar starts on demand.",
	busy: false,
};

export function useProviderStatus() {
	const [state, setState] = useState<ProviderState>(initialState);

	const refresh = useCallback(async () => {
		setState((current) => ({ ...current, busy: true }));
		try {
			const [openAiStatus, codexStatus] = await Promise.all([
				window.experimentalDesktop.getOpenAiAuthStatus(),
				window.experimentalDesktop.getCodexProviderStatus(),
			]);
			setState({
				openAiStatus,
				codexStatus,
				statusLabel: openAiStatus.connected
					? "Connected"
					: openAiStatus.expired
						? "Expired"
						: "Not connected",
				detail: openAiStatus.connected
					? `Account ${openAiStatus.accountId ?? "unknown"} · expires ${openAiStatus.expires ? new Date(openAiStatus.expires).toLocaleString() : "unknown"}`
					: openAiStatus.expired
						? "Token exists but is expired. Refresh or reconnect."
						: "Use browser OAuth to connect a ChatGPT Pro/Plus account.",
				busy: false,
			});
		} catch (error) {
			setState((current) => ({
				...current,
				statusLabel: "Sidecar error",
				detail: error instanceof Error ? error.message : String(error),
				busy: false,
			}));
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	async function connect() {
		setState((current) => ({
			...current,
			statusLabel: "Starting browser OAuth...",
			busy: true,
		}));
		const auth = await window.experimentalDesktop.startOpenAiBrowserAuth();
		setState((current) => ({
			...current,
			detail: auth.instructions,
			busy: false,
		}));
		await window.experimentalDesktop.openExternal(auth.url);
	}

	async function refreshAuth() {
		setState((current) => ({ ...current, busy: true }));
		await window.experimentalDesktop
			.refreshOpenAiAuth()
			.catch(() => undefined);
		await refresh();
	}

	async function logout() {
		await window.experimentalDesktop.logoutOpenAi();
		await refresh();
	}

	async function probe() {
		setState((current) => ({
			...current,
			statusLabel: "Probing Codex app-server...",
			busy: true,
		}));
		try {
			const status =
				await window.experimentalDesktop.getCodexProviderStatus();
			if (!status.binary.available) {
				throw new Error(
					`Codex binary unavailable at '${status.binary.path}': ${status.binary.error}`,
				);
			}
			const result =
				await window.experimentalDesktop.probeCodexAppServer();
			setState((current) => ({
				...current,
				codexStatus: status,
				statusLabel: "Codex app-server ready",
				detail: `Codex ${status.binary.version ?? "unknown"} · ${result.provider.effectiveCodexHome}`,
				busy: false,
			}));
		} catch (error) {
			setState((current) => ({
				...current,
				statusLabel: "Codex app-server probe failed",
				detail: error instanceof Error ? error.message : String(error),
				busy: false,
			}));
		}
	}

	async function updateCodex() {
		setState((current) => ({
			...current,
			statusLabel: "Updating Codex...",
			busy: true,
		}));
		try {
			const codexStatus =
				await window.experimentalDesktop.updateCodexProvider();
			setState((current) => ({
				...current,
				codexStatus,
				statusLabel:
					codexStatus.updateState?.status === "succeeded"
						? "Codex updated"
						: codexStatus.updateState?.status === "unchanged"
							? "Codex still behind"
							: codexStatus.updateState?.status === "failed"
								? "Codex update failed"
								: "Codex update finished",
				detail:
					codexStatus.updateState?.message ??
					`Codex ${codexStatus.binary.version ?? "unknown"}`,
				busy: false,
			}));
		} catch (error) {
			setState((current) => ({
				...current,
				statusLabel: "Codex update failed",
				detail: error instanceof Error ? error.message : String(error),
				busy: false,
			}));
		}
	}

	return {
		...state,
		refresh,
		connect,
		refreshAuth,
		logout,
		probe,
		updateCodex,
	};
}
