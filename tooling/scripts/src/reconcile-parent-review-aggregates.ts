import { pathToFileURL } from "node:url";
import {
	queryParentReviewMismatches,
	repairReviewedParentReviewMismatches,
} from "../../../packages/api/modules/submissions/lib/parent-review-reconciliation";
import { parseParentReviewReconciliationArguments } from "./parent-review-reconciliation-command";

export async function main(args = process.argv.slice(2)) {
	const parsed = parseParentReviewReconciliationArguments(args);
	if (parsed.mode === "report") {
		const report = await queryParentReviewMismatches(parsed.organizationId);
		console.log(JSON.stringify({ mode: parsed.mode, ...report }, null, 2));
		return report.mismatches.length > 0 ? 1 : 0;
	}
	const result = await repairReviewedParentReviewMismatches(parsed);
	console.log(JSON.stringify({ mode: parsed.mode, ...result }, null, 2));
	return result.after.mismatches.length > 0 ? 1 : 0;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	main()
		.then((exitCode) => {
			process.exitCode = exitCode;
		})
		.catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : error);
			process.exitCode = 2;
		});
}
