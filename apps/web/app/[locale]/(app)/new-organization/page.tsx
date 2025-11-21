import { config } from "@repo/config";
import { getOrganizationList } from "@saas/auth/lib/server";
import { CreateOrganizationForm } from "@saas/organizations/components/CreateOrganizationForm";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { redirect } from "next/navigation";

type Props = {
	params: Promise<{ locale: string }>;
};

export default async function NewOrganizationPage({ params }: Props) {
	const { locale } = await params;
	const organizations = await getOrganizationList();

	if (
		!config.organizations.enable ||
		(!config.organizations.enableUsersToCreateOrganizations &&
			(!config.organizations.requireOrganization || organizations.length > 0))
	) {
		redirect(`/${locale}`);
	}

	return (
		<AuthWrapper>
			<CreateOrganizationForm />
		</AuthWrapper>
	);
}
