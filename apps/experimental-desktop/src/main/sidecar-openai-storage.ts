import { randomUUID } from "node:crypto";

export type StoredOpenAiAuth = {
	type: "oauth";
	provider: "openai";
	access: string;
	refresh: string;
	expires: number;
	accountId?: string;
	updatedAt: string;
};

type StorageRequest =
	| { type: "auth-storage:request"; id: string; operation: "read" }
	| {
			type: "auth-storage:request";
			id: string;
			operation: "write";
			auth: StoredOpenAiAuth | null;
	  };

type StorageResponse =
	| {
			type: "auth-storage:response";
			id: string;
			ok: true;
			auth?: StoredOpenAiAuth | null;
	  }
	| {
			type: "auth-storage:response";
			id: string;
			ok: false;
			error: string;
	  };

type ParentPort = {
	postMessage(message: StorageRequest): void;
	on(event: "message", listener: (event: { data: unknown }) => void): void;
	off(event: "message", listener: (event: { data: unknown }) => void): void;
};

export function createOpenAiAuthStore() {
	const parentPort = getParentPort();

	async function read(): Promise<StoredOpenAiAuth | null> {
		const response = await requestStorage(parentPort, {
			type: "auth-storage:request",
			id: randomUUID(),
			operation: "read",
		});
		return response.auth ?? null;
	}

	async function write(auth: StoredOpenAiAuth | null) {
		await requestStorage(parentPort, {
			type: "auth-storage:request",
			id: randomUUID(),
			operation: "write",
			auth,
		});
	}

	return { read, write };
}

function requestStorage(
	parentPort: ParentPort,
	message: StorageRequest,
): Promise<Extract<StorageResponse, { ok: true }>> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			parentPort.off("message", onMessage);
			reject(new Error("Auth storage request timed out"));
		}, 10_000);

		const onMessage = (event: { data: unknown }) => {
			const response = parseStorageResponse(event.data, message.id);
			if (!response) {
				return;
			}
			clearTimeout(timeout);
			parentPort.off("message", onMessage);
			if (response.ok) {
				resolve(response);
				return;
			}
			reject(new Error(response.error));
		};

		parentPort.on("message", onMessage);
		parentPort.postMessage(message);
	});
}

function parseStorageResponse(
	value: unknown,
	id: string,
): StorageResponse | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	const response = value as Partial<StorageResponse>;
	if (response.type !== "auth-storage:response" || response.id !== id) {
		return undefined;
	}
	if (response.ok === true) {
		return {
			type: "auth-storage:response",
			id,
			ok: true,
			auth: response.auth ?? null,
		};
	}
	if (response.ok === false && typeof response.error === "string") {
		return {
			type: "auth-storage:response",
			id,
			ok: false,
			error: response.error,
		};
	}
	return undefined;
}

function getParentPort() {
	const port = process.parentPort as ParentPort | undefined;
	if (!port) {
		throw new Error("Sidecar parent port unavailable");
	}
	return port;
}
