import { redirect } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string; crewId: string }>;
};

export default async function LegacyCrewDetailPage({ params }: Props) {
	const { organizationSlug, crewId } = await params;
	redirect(`/app/${organizationSlug}/people/${crewId}`);
}
