import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";

type JsonRpcId = string | number;

type JsonRpcResponse =
	| { id: JsonRpcId; result?: unknown; error?: never }
	| {
			id: JsonRpcId;
			result?: never;
			error: { message?: string; code?: number };
	  };

type PendingRequest = {
	method: string;
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timeout: NodeJS.Timeout;
};

type IncomingRequest = {
	id: JsonRpcId;
	method: string;
	params?: unknown;
};

export type CodexIncomingRequest = IncomingRequest;

export type CodexProtocol = {
	request: (method: string, params?: unknown) => Promise<unknown>;
	notify: (method: string, params?: unknown) => void;
	stop: () => void;
};

export function createCodexProtocol(
	child: ChildProcessWithoutNullStreams,
	input: {
		onNotification?: (method: string, params: unknown) => void;
		onRequest?: (
			request: CodexIncomingRequest,
		) => Promise<unknown> | unknown;
		onStderr?: (text: string) => void;
		autoAnswerUserInput?: boolean;
		requestTimeoutMs?: number;
	},
): CodexProtocol {
	const pending = new Map<string, PendingRequest>();
	let nextId = 1;
	let stdoutRemainder = "";
	let stopped = false;
	const requestTimeoutMs = input.requestTimeoutMs ?? 30_000;

	child.stdout.on("data", (chunk: Buffer) => {
		stdoutRemainder = readLines(
			`${stdoutRemainder}${chunk.toString("utf8")}`,
			handleStdoutLine,
		);
	});
	child.stderr.on("data", (chunk: Buffer) => {
		input.onStderr?.(chunk.toString("utf8"));
	});
	child.once("error", (error) => {
		failAll(error);
	});
	child.once("exit", (code, signal) => {
		failAll(
			new Error(
				`codex app-server exited${code === null ? "" : ` with code ${code}`}${signal ? ` and signal ${signal}` : ""}`,
			),
		);
	});

	function request(method: string, params?: unknown) {
		if (stopped) {
			return Promise.reject(
				new Error("codex app-server protocol is stopped"),
			);
		}
		const id = nextId++;
		const requestId = String(id);
		const message =
			params === undefined ? { id, method } : { id, method, params };
		return new Promise<unknown>((resolve, reject) => {
			const timeout = setTimeout(() => {
				pending.delete(requestId);
				reject(
					new Error(
						`codex app-server request '${method}' timed out after ${requestTimeoutMs}ms`,
					),
				);
			}, requestTimeoutMs);
			pending.set(requestId, { method, resolve, reject, timeout });
			writeMessage(message).catch((error: unknown) => {
				clearTimeout(timeout);
				pending.delete(requestId);
				reject(
					error instanceof Error ? error : new Error(String(error)),
				);
			});
		});
	}

	function notify(method: string, params?: unknown) {
		if (stopped) {
			throw new Error("codex app-server protocol is stopped");
		}
		const message = params === undefined ? { method } : { method, params };
		void writeMessage(message);
	}

	function stop() {
		stopped = true;
		failAll(new Error("codex app-server protocol stopped"));
	}

	function handleStdoutLine(line: string) {
		if (!line.trim()) {
			return;
		}
		let message: unknown;
		try {
			message = JSON.parse(line);
		} catch {
			failAll(
				new Error(
					`codex app-server sent invalid JSON: ${line.slice(0, 200)}`,
				),
			);
			return;
		}
		if (isResponse(message)) {
			handleResponse(message);
			return;
		}
		if (isIncomingRequest(message)) {
			handleIncomingRequest(message);
			return;
		}
		if (isNotification(message)) {
			input.onNotification?.(message.method, message.params);
		}
	}

	function handleResponse(response: JsonRpcResponse) {
		const requestId = String(response.id);
		const entry = pending.get(requestId);
		if (!entry) {
			return;
		}
		pending.delete(requestId);
		clearTimeout(entry.timeout);
		if ("error" in response && response.error) {
			entry.reject(
				new Error(
					`codex app-server request '${entry.method}' failed: ${
						response.error.message ?? JSON.stringify(response.error)
					}`,
				),
			);
			return;
		}
		entry.resolve(response.result);
	}

	function handleIncomingRequest(requestMessage: IncomingRequest) {
		if (
			requestMessage.method === "item/tool/requestUserInput" &&
			input.autoAnswerUserInput
		) {
			const questions = getQuestionList(requestMessage.params);
			void writeMessage({
				id: requestMessage.id,
				result: {
					answers: Object.fromEntries(
						questions.map((question) => [
							question.id,
							{
								answers:
									question.options.length > 0
										? [question.options[0]]
										: ["ok"],
							},
						]),
					),
				},
			});
			return;
		}
		if (input.onRequest) {
			Promise.resolve(input.onRequest(requestMessage))
				.then((result) =>
					writeMessage({ id: requestMessage.id, result }),
				)
				.catch((error: unknown) =>
					writeMessage({
						id: requestMessage.id,
						error: {
							code: -32000,
							message:
								error instanceof Error
									? error.message
									: String(error),
						},
					}),
				);
			return;
		}
		void writeMessage({
			id: requestMessage.id,
			error: {
				code: -32601,
				message: `Unsupported codex app-server request '${requestMessage.method}'`,
			},
		});
	}

	function writeMessage(message: Record<string, unknown>) {
		return new Promise<void>((resolve, reject) => {
			const payload = `${JSON.stringify(message)}\n`;
			child.stdin.write(payload, (error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	}

	function failAll(error: Error) {
		for (const entry of pending.values()) {
			clearTimeout(entry.timeout);
			entry.reject(error);
		}
		pending.clear();
	}

	return { request, notify, stop };
}

function readLines(input: string, onLine: (line: string) => void) {
	const lines = input.split("\n");
	const remainder = lines.pop() ?? "";
	for (const line of lines) {
		onLine(line.replace(/\r$/, ""));
	}
	return remainder;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
	return typeof value === "string" || typeof value === "number";
}

function isResponse(value: unknown): value is JsonRpcResponse {
	return (
		isRecord(value) &&
		isJsonRpcId(value.id) &&
		("result" in value || "error" in value) &&
		!("method" in value)
	);
}

function isIncomingRequest(value: unknown): value is IncomingRequest {
	return (
		isRecord(value) &&
		isJsonRpcId(value.id) &&
		typeof value.method === "string"
	);
}

function isNotification(
	value: unknown,
): value is { method: string; params?: unknown } {
	return (
		isRecord(value) && typeof value.method === "string" && !("id" in value)
	);
}

function getQuestionList(params: unknown) {
	if (!isRecord(params) || !Array.isArray(params.questions)) {
		return [];
	}
	return params.questions.map((question) => {
		if (!isRecord(question)) {
			return { id: randomUUID(), options: [] };
		}
		return {
			id:
				typeof question.id === "string" && question.id.trim()
					? question.id
					: randomUUID(),
			options: Array.isArray(question.options)
				? question.options
						.map((option) =>
							isRecord(option) && typeof option.label === "string"
								? option.label
								: undefined,
						)
						.filter((label): label is string => !!label)
				: [],
		};
	});
}
