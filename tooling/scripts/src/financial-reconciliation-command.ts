import { isCalendarDate } from "./financial-reconciliation";

export type ReconciliationArguments = {
	mode: "report" | "fix-safe";
	organizationId: string;
	asOf: string;
};

export function resultRows<T>(result: unknown): T[] {
	if (
		!result ||
		typeof result !== "object" ||
		!("rows" in result) ||
		!Array.isArray(result.rows)
	) {
		throw new Error("Database query returned an unexpected result shape");
	}

	return result.rows as T[];
}

function readFlagValue(
	argv: string[],
	index: number,
	flag: "--organization-id" | "--as-of",
): string {
	const value = argv[index + 1];
	if (!value || value.startsWith("--")) {
		throw new Error(`${flag} requires a value`);
	}
	return value;
}

export function parseReconciliationArguments(
	argv: string[],
	now = new Date(),
): ReconciliationArguments {
	let mode: ReconciliationArguments["mode"] | undefined;
	let organizationId: string | undefined;
	let asOf: string | undefined;

	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];
		if (argument === "--report" || argument === "--fix-safe") {
			if (mode) {
				throw new Error("Use exactly one mode: --report or --fix-safe");
			}
			mode = argument === "--fix-safe" ? "fix-safe" : "report";
			continue;
		}
		if (argument === "--organization-id") {
			if (organizationId !== undefined) {
				throw new Error("--organization-id may only be provided once");
			}
			organizationId = readFlagValue(argv, index, argument);
			index++;
			continue;
		}
		if (argument === "--as-of") {
			if (asOf !== undefined) {
				throw new Error("--as-of may only be provided once");
			}
			asOf = readFlagValue(argv, index, argument);
			index++;
			continue;
		}
		throw new Error(`Unknown argument: ${argument}`);
	}

	if (!mode) {
		throw new Error("Use exactly one mode: --report or --fix-safe");
	}
	if (!organizationId) {
		throw new Error("--organization-id is required");
	}

	const effectiveAsOf = asOf ?? now.toISOString().slice(0, 10);
	if (!isCalendarDate(effectiveAsOf)) {
		throw new Error(
			"--as-of must be a real calendar date in YYYY-MM-DD format",
		);
	}

	return { mode, organizationId, asOf: effectiveAsOf };
}
