import { pathToFileURL } from "node:url";
import { isCalendarDate } from "./financial-reconciliation";
import type { FinancialReconciliationReport } from "./reconcile-financials";

type PreflightDependencies = {
	listOrganizationIds: () => Promise<string[]>;
	queryOrganization: (
		organizationId: string,
		asOf: string,
	) => Promise<FinancialReconciliationReport>;
};

const defaultDependencies: PreflightDependencies = {
	listOrganizationIds: async () => {
		const { asc, db, organizations } = await import("@repo/database");
		const rows = await db
			.select({ id: organizations.id })
			.from(organizations)
			.orderBy(asc(organizations.id));
		return rows.map((row) => row.id);
	},
	queryOrganization: async (organizationId, asOf) => {
		const { queryFinancialMismatches } = await import(
			"./reconcile-financials"
		);
		return queryFinancialMismatches(organizationId, asOf);
	},
};

export function parseFinancialMigrationPreflightArguments(
	argv: string[],
	now = new Date(),
) {
	let asOf: string | undefined;
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument !== "--as-of") {
			throw new Error(`Unknown argument: ${argument}`);
		}
		if (asOf !== undefined) {
			throw new Error("--as-of may only be provided once");
		}
		const value = argv[index + 1];
		if (!value || value.startsWith("--")) {
			throw new Error("--as-of requires a value");
		}
		asOf = value;
		index += 1;
	}

	const effectiveAsOf = asOf ?? now.toISOString().slice(0, 10);
	if (!isCalendarDate(effectiveAsOf)) {
		throw new Error(
			"--as-of must be a real calendar date in YYYY-MM-DD format",
		);
	}
	return { asOf: effectiveAsOf };
}

export async function buildFinancialMigrationPreflight(
	asOf: string,
	dependencies: PreflightDependencies = defaultDependencies,
) {
	const organizationIds = (await dependencies.listOrganizationIds()).sort();
	const reports: FinancialReconciliationReport[] = [];
	for (const organizationId of organizationIds) {
		reports.push(
			await dependencies.queryOrganization(organizationId, asOf),
		);
	}

	const mismatchedOrganizations = reports.filter(
		(report) => report.mismatches.length > 0,
	);
	return {
		reportVersion: 1 as const,
		mode: "financial_migration_preflight" as const,
		asOf,
		organizationCount: organizationIds.length,
		mismatchedOrganizationCount: mismatchedOrganizations.length,
		mismatchCount: mismatchedOrganizations.reduce(
			(total, report) => total + report.mismatches.length,
			0,
		),
		organizations: mismatchedOrganizations,
	};
}

export async function main(argv = process.argv.slice(2)) {
	const { asOf } = parseFinancialMigrationPreflightArguments(argv);
	const report = await buildFinancialMigrationPreflight(asOf);
	console.log(JSON.stringify(report));
	return report.mismatchCount === 0 ? 0 : 1;
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
