import { config } from "@repo/config";
import { getOrganizationList } from "@saas/auth/lib/server";
import { CreateOrganizationForm } from "@saas/organizations/components/CreateOrganizationForm";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { redirect } from "next/navigation";

type Props = {
	searchParams: Promise<{ redirectTo?: string }>;
};

export default async function NewOrganizationPage({ searchParams }: Props) {
	const rawSearchParams = await searchParams;
	const redirectTo = Array.isArray(rawSearchParams.redirectTo)
		? rawSearchParams.redirectTo[0]
		: rawSearchParams.redirectTo;

	const organizations = await getOrganizationList();

	if (
		!config.organizations.enable ||
		(!config.organizations.enableUsersToCreateOrganizations &&
			(!config.organizations.requireOrganization ||
				organizations.length > 0))
	) {
		redirect("/app");
	}

	return (
		<AuthWrapper>
			<CreateOrganizationForm redirectTo={redirectTo ?? "/app"} />
		</AuthWrapper>
	);
}
