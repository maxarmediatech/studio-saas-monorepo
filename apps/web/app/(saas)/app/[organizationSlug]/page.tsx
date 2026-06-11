import { redirect } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export default async function OrganizationPage({ params }: Props) {
	const { organizationSlug } = await params;

	redirect(`/app/${organizationSlug}/home`);
}
