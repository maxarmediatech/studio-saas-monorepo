import { spawn } from "node:child_process";
import { createCodexProtocol } from "./sidecar-codex-protocol";
import {
	type CodexProviderConfig,
	getCodexProviderEnv,
	getCodexProviderStatus,
	getDefaultCodexProvider,
	getEffectiveCodexHome,
} from "./sidecar-provider";

type CodexRuntime = {
	provider: CodexProviderConfig;
	initialize: () => Promise<unknown>;
	readAccount: () => Promise<unknown>;
	stop: () => Promise<void>;
};

export async function probeCodexAppServer(
	provider = getDefaultCodexProvider(),
) {
	const status = await getCodexProviderStatus(provider);
	if (!status.binary.available) {
		throw new Error(
			`Codex binary unavailable at '${status.binary.path}': ${status.binary.error}`,
		);
	}
	const runtime = startCodexRuntime(provider, {
		autoAnswerUserInput: true,
	});
	try {
		const initialized = await runtime.initialize();
		const account = await runtime.readAccount();
		return {
			ok: true,
			provider: {
				id: provider.id,
				displayName: provider.displayName,
				binaryPath: provider.binaryPath,
				codexHome: provider.codexHome,
				shadowHome: provider.shadowHome ?? null,
				effectiveCodexHome: getEffectiveCodexHome(provider),
			},
			initialized,
			account,
		};
	} finally {
		await runtime.stop();
	}
}

function startCodexRuntime(
	provider: CodexProviderConfig,
	options: { autoAnswerUserInput?: boolean } = {},
): CodexRuntime {
	const child = spawn(provider.binaryPath, ["app-server"], {
		cwd: process.cwd(),
		env: getCodexProviderEnv(provider),
		stdio: "pipe",
	});
	const protocol = createCodexProtocol(child, {
		autoAnswerUserInput: options.autoAnswerUserInput ?? false,
		requestTimeoutMs: 30_000,
		onStderr: (text) => {
			const trimmed = text.trimEnd();
			if (trimmed) {
				console.warn(`[codex app-server] ${trimmed}`);
			}
		},
		onNotification: (method, params) => {
			console.log(
				`[codex app-server] notification ${method} ${JSON.stringify(params ?? {}).slice(0, 500)}`,
			);
		},
	});
	let stopped = false;

	async function initialize() {
		const initialized = await protocol.request("initialize", {
			clientInfo: {
				name: "experimental-desktop",
				title: "Experimental Desktop",
				version: "0.0.0",
			},
			capabilities: {
				experimentalApi: true,
				optOutNotificationMethods: null,
			},
		});
		protocol.notify("initialized");
		return initialized;
	}

	function readAccount() {
		return protocol.request("account/read", {});
	}

	async function stop() {
		if (stopped) {
			return;
		}
		stopped = true;
		protocol.stop();
		child.kill();
		await new Promise<void>((resolve) => {
			const timeout = setTimeout(() => {
				child.kill("SIGKILL");
				resolve();
			}, 2000);
			child.once("exit", () => {
				clearTimeout(timeout);
				resolve();
			});
		});
	}

	return { provider, initialize, readAccount, stop };
}
