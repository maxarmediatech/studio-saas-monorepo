import { createHash, randomBytes } from "node:crypto";
import {
	createServer,
	type IncomingMessage,
	type ServerResponse,
} from "node:http";
import {
	createOpenAiAuthStore,
	type StoredOpenAiAuth,
} from "./sidecar-openai-storage";

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const ISSUER = "https://auth.openai.com";
const OAUTH_PORT = 1455;

type TokenResponse = {
	id_token?: string;
	access_token: string;
	refresh_token: string;
	expires_in?: number;
};

export type FreshOpenAiAuth = {
	access: string;
	accountId?: string;
};

type PkceCodes = {
	verifier: string;
	challenge: string;
};

type PendingOAuth = {
	pkce: PkceCodes;
	state: string;
	resolve: (tokens: TokenResponse) => void;
	reject: (error: Error) => void;
	timeout: NodeJS.Timeout;
};

export function createOpenAiAuthController(options: {
	getUserDataPath: () => string;
}) {
	let oauthServer: ReturnType<typeof createServer> | undefined;
	let pendingOAuth: PendingOAuth | undefined;
	const authStore = createOpenAiAuthStore({
		getUserDataPath: options.getUserDataPath,
	});

	async function getStatus() {
		const auth = await authStore.read();
		const expired = Boolean(auth && auth.expires <= Date.now());
		return {
			connected: Boolean(auth && !expired),
			expired,
			accountId: auth?.accountId ?? null,
			expires: auth?.expires ?? null,
			updatedAt: auth?.updatedAt ?? null,
		};
	}

	async function startBrowserAuth() {
		const { redirectUri } = await startOAuthServer();
		const pkce = await generatePKCE();
		const state = base64UrlEncode(randomBytes(32));
		const authUrl = buildAuthorizeUrl(redirectUri, pkce, state);

		const callbackPromise = waitForOAuthCallback(pkce, state);
		void callbackPromise
			.then(async (tokens) => {
				const accountId = extractAccountId(tokens);
				await authStore.write({
					type: "oauth",
					provider: "openai",
					access: tokens.access_token,
					refresh: tokens.refresh_token,
					expires: Date.now() + (tokens.expires_in ?? 3600) * 1000,
					...(accountId ? { accountId } : {}),
					updatedAt: new Date().toISOString(),
				});
				stopOAuthServer();
			})
			.catch(() => {
				stopOAuthServer();
			});

		return {
			url: authUrl,
			method: "auto" as const,
			instructions:
				"Complete authorization in your browser. This window will close automatically.",
		};
	}

	async function refresh() {
		const auth = await refreshStoredAuth();
		return {
			connected: Boolean(auth),
			expired: false,
			accountId: auth?.accountId ?? null,
			expires: auth?.expires ?? null,
			updatedAt: auth?.updatedAt ?? null,
		};
	}

	async function logout() {
		await authStore.write(null);
	}

	async function getFreshAuth(): Promise<FreshOpenAiAuth> {
		const auth = await authStore.read();
		if (!auth) {
			throw new Error("OpenAI auth is not connected");
		}
		if (!auth.access || auth.expires <= Date.now()) {
			const refreshed = await refreshStoredAuth();
			if (!refreshed?.access) {
				throw new Error("OpenAI auth refresh failed");
			}
			return {
				access: refreshed.access,
				...(refreshed.accountId
					? { accountId: refreshed.accountId }
					: {}),
			};
		}
		return {
			access: auth.access,
			...(auth.accountId ? { accountId: auth.accountId } : {}),
		};
	}

	async function stop() {
		await closeServer(oauthServer);
		oauthServer = undefined;
		clearPendingOAuth(new Error("Sidecar stopped"));
	}

	async function startOAuthServer(): Promise<{ redirectUri: string }> {
		if (oauthServer) {
			return {
				redirectUri: `http://localhost:${OAUTH_PORT}/auth/callback`,
			};
		}

		oauthServer = createServer((req, res) => {
			void handleOAuthRequest(req, res);
		});

		await new Promise<void>((resolve, reject) => {
			oauthServer?.once("error", (error: NodeJS.ErrnoException) => {
				oauthServer?.close(() => {});
				oauthServer = undefined;
				if (error.code === "EADDRINUSE") {
					reject(
						new Error(
							"OpenAI OAuth port 1455 is already in use. Close any other Codex/OpenCode authorization flow and try again.",
						),
					);
					return;
				}
				reject(error);
			});
			oauthServer?.listen(OAUTH_PORT, "127.0.0.1", resolve);
		});

		return { redirectUri: `http://localhost:${OAUTH_PORT}/auth/callback` };
	}

	async function handleOAuthRequest(
		req: IncomingMessage,
		res: ServerResponse,
	) {
		const url = new URL(req.url ?? "/", `http://localhost:${OAUTH_PORT}`);

		if (url.pathname !== "/auth/callback") {
			res.writeHead(404);
			res.end("Not found");
			return;
		}

		const error = url.searchParams.get("error");
		const errorDescription = url.searchParams.get("error_description");
		if (error) {
			const message = errorDescription || error;
			clearPendingOAuth(new Error(message));
			writeHtml(res, renderOAuthError(message));
			return;
		}

		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");
		if (!code) {
			clearPendingOAuth(new Error("Missing authorization code"));
			writeHtml(res, renderOAuthError("Missing authorization code"));
			return;
		}

		if (!pendingOAuth || state !== pendingOAuth.state) {
			clearPendingOAuth(new Error("Invalid OAuth state"));
			writeHtml(res, renderOAuthError("Invalid OAuth state"));
			return;
		}

		const current = pendingOAuth;
		pendingOAuth = undefined;
		clearTimeout(current.timeout);

		try {
			const tokens = await exchangeCodeForTokens(
				code,
				`http://localhost:${OAUTH_PORT}/auth/callback`,
				current.pkce,
			);
			current.resolve(tokens);
			writeHtml(res, renderOAuthSuccess());
		} catch (exchangeError) {
			current.reject(
				exchangeError instanceof Error
					? exchangeError
					: new Error(String(exchangeError)),
			);
			writeHtml(
				res,
				renderOAuthError(
					exchangeError instanceof Error
						? exchangeError.message
						: String(exchangeError),
				),
			);
		}
	}

	function waitForOAuthCallback(
		pkce: PkceCodes,
		state: string,
	): Promise<TokenResponse> {
		clearPendingOAuth(new Error("New OAuth attempt started"));

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(
				() => {
					clearPendingOAuth(new Error("OAuth callback timeout"));
				},
				5 * 60 * 1000,
			);

			pendingOAuth = {
				pkce,
				state,
				resolve,
				reject,
				timeout,
			};
		});
	}

	function clearPendingOAuth(error: Error) {
		if (!pendingOAuth) {
			return;
		}
		const current = pendingOAuth;
		pendingOAuth = undefined;
		clearTimeout(current.timeout);
		current.reject(error);
	}

	function stopOAuthServer() {
		if (!oauthServer) {
			return;
		}
		oauthServer.close(() => {});
		oauthServer = undefined;
	}

	async function refreshStoredAuth(): Promise<StoredOpenAiAuth | null> {
		const auth = await authStore.read();
		if (!auth) {
			return null;
		}
		const tokens = await refreshAccessToken(auth.refresh);
		const next = {
			...auth,
			access: tokens.access_token,
			refresh: tokens.refresh_token || auth.refresh,
			expires: Date.now() + (tokens.expires_in ?? 3600) * 1000,
			accountId: extractAccountId(tokens) ?? auth.accountId,
			updatedAt: new Date().toISOString(),
		} satisfies StoredOpenAiAuth;
		await authStore.write(next);
		return next;
	}

	return {
		getStatus,
		startBrowserAuth,
		refresh,
		getFreshAuth,
		logout,
		stop,
	};
}

async function generatePKCE(): Promise<PkceCodes> {
	const verifier = base64UrlEncode(randomBytes(48));
	const challenge = base64UrlEncode(
		createHash("sha256").update(verifier).digest(),
	);
	return { verifier, challenge };
}

function buildAuthorizeUrl(
	redirectUri: string,
	pkce: PkceCodes,
	state: string,
): string {
	const params = new URLSearchParams({
		response_type: "code",
		client_id: CLIENT_ID,
		redirect_uri: redirectUri,
		scope: "openid profile email offline_access",
		code_challenge: pkce.challenge,
		code_challenge_method: "S256",
		id_token_add_organizations: "true",
		codex_cli_simplified_flow: "true",
		state,
		originator: "opencode",
	});
	return `${ISSUER}/oauth/authorize?${params.toString()}`;
}

async function exchangeCodeForTokens(
	code: string,
	redirectUri: string,
	pkce: PkceCodes,
): Promise<TokenResponse> {
	const response = await fetch(`${ISSUER}/oauth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: redirectUri,
			client_id: CLIENT_ID,
			code_verifier: pkce.verifier,
		}).toString(),
	});
	if (!response.ok) {
		throw new Error(`Token exchange failed: ${response.status}`);
	}
	return response.json() as Promise<TokenResponse>;
}

async function refreshAccessToken(
	refreshToken: string,
): Promise<TokenResponse> {
	const response = await fetch(`${ISSUER}/oauth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: CLIENT_ID,
		}).toString(),
	});
	if (!response.ok) {
		throw new Error(`Token refresh failed: ${response.status}`);
	}
	return response.json() as Promise<TokenResponse>;
}

function extractAccountId(tokens: TokenResponse): string | undefined {
	const idClaims = tokens.id_token
		? parseJwtClaims(tokens.id_token)
		: undefined;
	const accessClaims = tokens.access_token
		? parseJwtClaims(tokens.access_token)
		: undefined;
	return (
		extractAccountIdFromClaims(idClaims) ??
		extractAccountIdFromClaims(accessClaims)
	);
}

function parseJwtClaims(token: string): Record<string, unknown> | undefined {
	const parts = token.split(".");
	if (parts.length !== 3) {
		return undefined;
	}
	try {
		return JSON.parse(
			Buffer.from(parts[1], "base64url").toString(),
		) as Record<string, unknown>;
	} catch {
		return undefined;
	}
}

function extractAccountIdFromClaims(
	claims: Record<string, unknown> | undefined,
): string | undefined {
	if (!claims) {
		return undefined;
	}
	if (typeof claims.chatgpt_account_id === "string") {
		return claims.chatgpt_account_id;
	}
	const apiAuth = claims["https://api.openai.com/auth"];
	if (
		apiAuth &&
		typeof apiAuth === "object" &&
		"chatgpt_account_id" in apiAuth &&
		typeof apiAuth.chatgpt_account_id === "string"
	) {
		return apiAuth.chatgpt_account_id;
	}
	const organizations = claims.organizations;
	if (Array.isArray(organizations)) {
		const first = organizations[0];
		if (
			first &&
			typeof first === "object" &&
			"id" in first &&
			typeof first.id === "string"
		) {
			return first.id;
		}
	}
	return undefined;
}

function writeHtml(res: ServerResponse, body: string) {
	res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
	res.end(body);
}

function renderOAuthSuccess() {
	return `<!doctype html><html><head><title>Authorization Successful</title></head><body style="font-family: system-ui; background: #101114; color: #f2efe7; display: grid; place-items: center; min-height: 100vh;"><main><h1>Authorization Successful</h1><p>You can close this window and return to the desktop app.</p></main><script>setTimeout(() => window.close(), 2000)</script></body></html>`;
}

function renderOAuthError(error: string) {
	return `<!doctype html><html><head><title>Authorization Failed</title></head><body style="font-family: system-ui; background: #101114; color: #f2efe7; display: grid; place-items: center; min-height: 100vh;"><main><h1>Authorization Failed</h1><p>${escapeHtml(error)}</p></main></body></html>`;
}

function escapeHtml(input: string) {
	return input
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function base64UrlEncode(buffer: Uint8Array | Buffer) {
	return Buffer.from(buffer).toString("base64url");
}

function closeServer(server: ReturnType<typeof createServer> | undefined) {
	return new Promise<void>((resolve) => {
		if (!server) {
			resolve();
			return;
		}
		server.close(() => resolve());
	});
}
