import { reconcileCalendarDeliveries } from "../../../packages/api/modules/shoots/lib/calendar-delivery";

export function parseCalendarReconciliationArguments(args: string[]) {
	let apply = false;
	let organizationId: string | undefined;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--apply") {
			if (apply) {
				throw new Error("Duplicate argument: --apply");
			}
			apply = true;
			continue;
		}
		if (
			argument === "--organization-id" ||
			argument?.startsWith("--organization-id=")
		) {
			if (organizationId !== undefined) {
				throw new Error("Duplicate argument: --organization-id");
			}
			const value = argument.includes("=")
				? argument.slice(argument.indexOf("=") + 1).trim()
				: args[++index]?.trim();
			if (!value || value.startsWith("-")) {
				throw new Error(
					"--organization-id requires a non-blank organization id",
				);
			}
			organizationId = value;
			continue;
		}
		throw new Error(`Unknown argument: ${argument}`);
	}
	if (apply && !organizationId) {
		throw new Error("--apply requires --organization-id");
	}
	return { apply, organizationId };
}

export async function main(args = process.argv.slice(2)) {
	const { apply, organizationId } =
		parseCalendarReconciliationArguments(args);
	const result = await reconcileCalendarDeliveries({
		organizationId,
		apply,
	});

	console.log(
		JSON.stringify(
			{
				mode: apply ? "apply" : "report",
				organizationId: organizationId ?? "all",
				...result,
			},
			null,
			2,
		),
	);
	return result.failed > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main()
		.then((code) => {
			process.exitCode = code;
		})
		.catch((error) => {
			console.error(
				error instanceof Error ? error.message : String(error),
			);
			process.exitCode = 1;
		});
}
