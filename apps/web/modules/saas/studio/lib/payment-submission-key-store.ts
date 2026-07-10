export interface SubmissionKeyStorage {
	getItem(key: string): string | null;
	removeItem(key: string): void;
	setItem(key: string, value: string): void;
}

interface StoredSubmissionKey {
	fingerprint: string;
	key: string;
	version: 1;
}

const STORAGE_PREFIX = "stuwiz:payment-submission:v1:";

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(canonicalize);
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, child]) => [key, canonicalize(child)]),
		);
	}
	return value;
}

function parseStored(value: string | null): StoredSubmissionKey | null {
	if (!value) {
		return null;
	}
	try {
		const parsed = JSON.parse(value) as Partial<StoredSubmissionKey>;
		return parsed.version === 1 &&
			typeof parsed.fingerprint === "string" &&
			typeof parsed.key === "string"
			? (parsed as StoredSubmissionKey)
			: null;
	} catch {
		return null;
	}
}

function browserSessionStorage(): SubmissionKeyStorage | null {
	try {
		return typeof window === "undefined" ? null : window.sessionStorage;
	} catch {
		return null;
	}
}

export function createPaymentSubmissionKeyStore({
	namespace,
	storage = browserSessionStorage,
	generateKey = () => crypto.randomUUID(),
}: {
	namespace: string;
	storage?: () => SubmissionKeyStorage | null;
	generateKey?: () => string;
}) {
	const storageKey = `${STORAGE_PREFIX}${namespace}`;
	let memory: StoredSubmissionKey | null = null;

	function read(): StoredSubmissionKey | null {
		try {
			const persisted = parseStored(
				storage()?.getItem(storageKey) ?? null,
			);
			if (persisted) {
				memory = persisted;
				return persisted;
			}
		} catch {
			return memory;
		}
		return memory;
	}

	function write(value: StoredSubmissionKey | null): void {
		memory = value;
		try {
			const target = storage();
			if (value) {
				target?.setItem(storageKey, JSON.stringify(value));
			} else {
				target?.removeItem(storageKey);
			}
		} catch {
			// In-memory reuse still protects retries while this instance is mounted.
		}
	}

	return {
		abandon: () => write(null),
		acknowledgeSuccess: () => write(null),
		keyFor(payload: Record<string, unknown>) {
			const fingerprint = JSON.stringify(canonicalize(payload));
			const current = read();
			if (current?.fingerprint === fingerprint) {
				return current.key;
			}

			const next = {
				fingerprint,
				key: generateKey(),
				version: 1,
			} as const;
			write(next);
			return next.key;
		},
	};
}
