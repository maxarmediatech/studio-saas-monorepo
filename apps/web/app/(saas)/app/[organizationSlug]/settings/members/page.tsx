import { redirect } from "next/navigation";

export const instant = false;

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export default async function LegacyMembersSettingsPage({ params }: Props) {
	const { organizationSlug } = await params;
	redirect(`/app/${organizationSlug}/settings/people?view=members`);
}
