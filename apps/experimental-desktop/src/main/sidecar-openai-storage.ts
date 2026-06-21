import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { safeStorage } from "electron";

export type StoredOpenAiAuth = {
	type: "oauth";
	provider: "openai";
	access: string;
	refresh: string;
	expires: number;
	accountId?: string;
	updatedAt: string;
};

type StoredAuthEnvelope = {
	encoding: "electron-safe-storage";
	data: string;
	updatedAt: string;
};

export function createOpenAiAuthStore(options: {
	getUserDataPath: () => string;
}) {
	async function read(): Promise<StoredOpenAiAuth | null> {
		try {
			const raw = await readFile(authPath(), "utf8");
			const parsed = parseStoredAuth(raw);
			return parsed.provider === "openai" ? parsed : null;
		} catch {
			return null;
		}
	}

	async function write(auth: StoredOpenAiAuth | null) {
		const file = authPath();
		await mkdir(dirname(file), { recursive: true });
		if (!auth) {
			await unlink(file).catch(() => undefined);
			return;
		}
		await writeFile(file, serializeStoredAuth(auth), { mode: 0o600 });
	}

	function authPath() {
		return join(options.getUserDataPath(), "sidecar-auth", "openai.json");
	}

	return { read, write };
}

function parseStoredAuth(raw: string): StoredOpenAiAuth {
	const parsed = JSON.parse(raw) as StoredOpenAiAuth | StoredAuthEnvelope;
	if ("encoding" in parsed && parsed.encoding === "electron-safe-storage") {
		const decrypted = safeStorage.decryptString(
			Buffer.from(parsed.data, "base64"),
		);
		return JSON.parse(decrypted) as StoredOpenAiAuth;
	}
	return parsed as StoredOpenAiAuth;
}

function serializeStoredAuth(auth: StoredOpenAiAuth) {
	if (safeStorage.isEncryptionAvailable()) {
		const encrypted = safeStorage.encryptString(JSON.stringify(auth));
		const envelope: StoredAuthEnvelope = {
			encoding: "electron-safe-storage",
			data: encrypted.toString("base64"),
			updatedAt: new Date().toISOString(),
		};
		return JSON.stringify(envelope, null, 2);
	}
	return JSON.stringify(auth, null, 2);
}
