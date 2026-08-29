import { redirect } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const instant = false;

function toQueryString(
	searchParams: Record<string, string | string[] | undefined>,
) {
	const nextParams = new URLSearchParams();

	for (const [key, value] of Object.entries(searchParams)) {
		if (typeof value === "string") {
			nextParams.set(key, value);
			continue;
		}

		for (const entry of value ?? []) {
			nextParams.append(key, entry);
		}
	}

	const query = nextParams.toString();
	return query ? `?${query}` : "";
}

export default async function LegacyCrewsPage({ params, searchParams }: Props) {
	const { organizationSlug } = await params;
	redirect(
		`/app/${organizationSlug}/people${toQueryString(await searchParams)}`,
	);
}
