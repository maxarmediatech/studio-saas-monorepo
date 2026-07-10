import { reconcileCalendarDeliveries } from "../../../packages/api/modules/shoots/lib/calendar-delivery";

function getOption(args: string[], name: string) {
	const inline = args.find((arg) => arg.startsWith(`${name}=`));
	if (inline) {
		return inline.slice(name.length + 1);
	}
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}

export async function main(args = process.argv.slice(2)) {
	const apply = args.includes("--apply");
	const organizationId = getOption(args, "--organization-id");
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
