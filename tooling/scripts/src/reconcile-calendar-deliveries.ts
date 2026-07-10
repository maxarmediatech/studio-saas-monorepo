import { reconcileCalendarDeliveries } from "../../../packages/api/modules/shoots/lib/calendar-delivery";

export function parseCalendarReconciliationArguments(args: string[]) {
	const apply = args.includes("--apply");
	const organizationId = getRequiredOption(args, "--organization-id");
	if (apply && !organizationId) {
		throw new Error("--apply requires --organization-id");
	}
	return { apply, organizationId };
}

function getRequiredOption(args: string[], name: string) {
	const inline = args.find((arg) => arg.startsWith(`${name}=`));
	if (inline) {
		const value = inline.slice(name.length + 1).trim();
		if (!value || value.startsWith("-")) {
			throw new Error(`${name} requires a non-blank organization id`);
		}
		return value;
	}
	const index = args.indexOf(name);
	if (index < 0) {
		return undefined;
	}
	const value = args[index + 1]?.trim();
	if (!value || value.startsWith("-")) {
		throw new Error(`${name} requires a non-blank organization id`);
	}
	return value;
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
