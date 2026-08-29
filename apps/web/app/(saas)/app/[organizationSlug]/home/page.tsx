import { HomeView } from "@saas/studio/components/home";
import { getOrganizationPageMetadata } from "@saas/studio/lib/organization-page-metadata";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export function generateMetadata({ params }: Props) {
	return getOrganizationPageMetadata(params, "Home");
}

export default function HomePage() {
	return <HomeView />;
}
