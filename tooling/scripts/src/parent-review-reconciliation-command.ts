export type ParentReviewReconciliationArguments =
	| { mode: "report"; organizationId: string }
	| {
			mode: "repair-reviewed";
			organizationId: string;
			reviewedReportHash: string;
			reviewedByUserId: string;
	  };

function valueAfter(args: string[], index: number, flag: string) {
	const value = args[index + 1]?.trim();
	if (!value || value.startsWith("--")) {
		throw new Error(`${flag} requires a non-blank value`);
	}
	return value;
}

export function parseParentReviewReconciliationArguments(
	args: string[],
): ParentReviewReconciliationArguments {
	let mode: ParentReviewReconciliationArguments["mode"] | undefined;
	let organizationId: string | undefined;
	let reviewedReportHash: string | undefined;
	let reviewedByUserId: string | undefined;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--report" || argument === "--repair-reviewed") {
			if (mode) {
				throw new Error(
					"Use exactly one mode: --report or --repair-reviewed",
				);
			}
			mode = argument === "--report" ? "report" : "repair-reviewed";
			continue;
		}
		if (argument === "--organization-id") {
			if (organizationId) {
				throw new Error("--organization-id may only be provided once");
			}
			organizationId = valueAfter(args, index, argument);
			index += 1;
			continue;
		}
		if (argument === "--reviewed-report-hash") {
			if (reviewedReportHash) {
				throw new Error(
					"--reviewed-report-hash may only be provided once",
				);
			}
			reviewedReportHash = valueAfter(args, index, argument);
			index += 1;
			continue;
		}
		if (argument === "--reviewed-by-user-id") {
			if (reviewedByUserId) {
				throw new Error(
					"--reviewed-by-user-id may only be provided once",
				);
			}
			reviewedByUserId = valueAfter(args, index, argument);
			index += 1;
			continue;
		}
		throw new Error(`Unknown argument: ${argument}`);
	}
	if (!mode) {
		throw new Error("Use exactly one mode: --report or --repair-reviewed");
	}
	if (!organizationId) {
		throw new Error("--organization-id is required");
	}
	if (mode === "report") {
		if (reviewedReportHash || reviewedByUserId) {
			throw new Error(
				"Reviewed repair arguments are only valid with --repair-reviewed",
			);
		}
		return { mode, organizationId };
	}
	if (!reviewedReportHash || !/^[a-f0-9]{64}$/.test(reviewedReportHash)) {
		throw new Error(
			"--reviewed-report-hash requires the 64-character hash from the reviewed report",
		);
	}
	if (!reviewedByUserId) {
		throw new Error(
			"--reviewed-by-user-id is required for reviewed repair",
		);
	}
	return {
		mode,
		organizationId,
		reviewedReportHash,
		reviewedByUserId,
	};
}
