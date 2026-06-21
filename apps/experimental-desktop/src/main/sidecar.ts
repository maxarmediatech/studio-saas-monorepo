import {
	createServer,
	type IncomingMessage,
	type ServerResponse,
} from "node:http";
import { proxyCodexResponses, SidecarHttpError } from "./sidecar-codex";
import { createOpenAiAuthController } from "./sidecar-openai";
import { createSessionController } from "./sidecar-sessions";

const MAX_BODY_BYTES = 1024 * 1024;

type StartCommand = {
	type: "start";
	hostname: string;
	port: number;
	username: string;
	password: string;
};

type StopCommand = { type: "stop" };
type SidecarCommand = StartCommand | StopCommand;

type SidecarMessage =
	| { type: "ready" }
	| { type: "stopped" }
	| { type: "error"; error: { message: string; stack?: string } };

type ParentPort = {
	postMessage(message: SidecarMessage): void;
	on(event: "message", listener: (event: { data: unknown }) => void): void;
};

const parentPort = getParentPort();
let apiServer: ReturnType<typeof createServer> | undefined;
let commandState: StartCommand | undefined;
const openAiAuth = createOpenAiAuthController();
const sessions = createSessionController({
	getFreshAuth: () => openAiAuth.getFreshAuth(),
});

parentPort.on("message", (event) => {
	const command = parseCommand(event.data);
	if (!command) {
		return;
	}
	if (command.type === "stop") {
		void stop();
		return;
	}
	void start(command);
});

async function start(command: StartCommand) {
	try {
		commandState = command;

		apiServer = createServer((req, res) => {
			void handleApiRequest(req, res);
		});

		await new Promise<void>((resolve, reject) => {
			apiServer?.once("error", reject);
			apiServer?.listen(command.port, command.hostname, resolve);
		});

		parentPort.postMessage({ type: "ready" });
	} catch (error) {
		parentPort.postMessage({ type: "error", error: serializeError(error) });
		setImmediate(() => process.exit(1));
	}
}

async function stop() {
	await Promise.all([closeServer(apiServer), openAiAuth.stop()]);
	apiServer = undefined;
	commandState = undefined;
	parentPort.postMessage({ type: "stopped" });
	setImmediate(() => process.exit(0));
}

async function handleApiRequest(req: IncomingMessage, res: ServerResponse) {
	try {
		if (req.method === "GET" && req.url === "/health") {
			writeJson(res, 200, { ok: true });
			return;
		}

		if (!isAuthorized(req)) {
			res.setHeader("WWW-Authenticate", "Basic");
			writeJson(res, 401, { error: "Authentication required" });
			return;
		}

		const url = new URL(req.url ?? "/", "http://127.0.0.1");
		if (req.method === "GET" && url.pathname === "/auth/openai/status") {
			writeJson(res, 200, await openAiAuth.getStatus());
			return;
		}

		if (
			req.method === "POST" &&
			url.pathname === "/auth/openai/browser/start"
		) {
			writeJson(res, 200, await openAiAuth.startBrowserAuth());
			return;
		}

		if (req.method === "POST" && url.pathname === "/auth/openai/refresh") {
			writeJson(res, 200, await openAiAuth.refresh());
			return;
		}

		if (req.method === "POST" && url.pathname === "/auth/openai/logout") {
			await openAiAuth.logout();
			writeJson(res, 200, { ok: true });
			return;
		}

		if (req.method === "POST" && url.pathname === "/codex/responses") {
			writeJson(
				res,
				200,
				await proxyCodexResponses({
					auth: await openAiAuth.getFreshAuth(),
					body: await readJsonBody(req),
				}),
			);
			return;
		}

		if (req.method === "POST" && url.pathname === "/sessions") {
			writeJson(res, 200, sessions.create());
			return;
		}

		const sessionMessageMatch = url.pathname.match(
			/^\/sessions\/([^/]+)\/messages$/,
		);
		if (req.method === "POST" && sessionMessageMatch) {
			writeJson(
				res,
				200,
				await sessions.sendMessage(
					decodeURIComponent(sessionMessageMatch[1]),
					await readJsonBody(req),
				),
			);
			return;
		}

		const sessionEventsMatch = url.pathname.match(
			/^\/sessions\/([^/]+)\/events$/,
		);
		if (req.method === "GET" && sessionEventsMatch) {
			writeJson(
				res,
				200,
				sessions.events(decodeURIComponent(sessionEventsMatch[1])),
			);
			return;
		}

		writeJson(res, 404, { error: "Not found" });
	} catch (error) {
		writeJson(res, error instanceof SidecarHttpError ? error.status : 500, {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

function isAuthorized(req: IncomingMessage) {
	if (!commandState) {
		return false;
	}
	const authorization = req.headers.authorization;
	if (!authorization?.startsWith("Basic ")) {
		return false;
	}
	const decoded = Buffer.from(
		authorization.slice("Basic ".length),
		"base64",
	).toString("utf8");
	return decoded === `${commandState.username}:${commandState.password}`;
}

function writeJson(res: ServerResponse, status: number, body: unknown) {
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Access-Control-Allow-Origin": "*",
	});
	res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage) {
	const body = await readRequestBody(req);
	if (!body) {
		return null;
	}
	try {
		return JSON.parse(body) as unknown;
	} catch {
		throw new SidecarHttpError(400, "Request body must be valid JSON");
	}
}

function readRequestBody(req: IncomingMessage) {
	return new Promise<string>((resolve, reject) => {
		let size = 0;
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => {
			size += chunk.byteLength;
			if (size > MAX_BODY_BYTES) {
				reject(new Error("Request body too large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("error", reject);
		req.on("end", () => {
			resolve(Buffer.concat(chunks).toString("utf8"));
		});
	});
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

function parseCommand(value: unknown): SidecarCommand | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	const command = value as Partial<StartCommand | StopCommand>;
	if (command.type === "stop") {
		return { type: "stop" };
	}
	if (command.type !== "start") {
		return undefined;
	}
	if (typeof command.hostname !== "string") {
		return undefined;
	}
	if (typeof command.port !== "number") {
		return undefined;
	}
	if (typeof command.username !== "string") {
		return undefined;
	}
	if (typeof command.password !== "string") {
		return undefined;
	}
	return {
		type: "start",
		hostname: command.hostname,
		port: command.port,
		username: command.username,
		password: command.password,
	};
}

function serializeError(error: unknown) {
	if (error instanceof Error) {
		return { message: error.message, stack: error.stack };
	}
	return { message: String(error) };
}

function getParentPort() {
	const port = process.parentPort as ParentPort | undefined;
	if (!port) {
		throw new Error("Sidecar parent port unavailable");
	}
	return port;
}
