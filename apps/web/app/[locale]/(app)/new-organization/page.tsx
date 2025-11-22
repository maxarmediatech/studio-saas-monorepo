import { config } from "@repo/config";
import { getOrganizationList } from "@saas/auth/lib/server";
import { CreateOrganizationForm } from "@saas/organizations/components/CreateOrganizationForm";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { redirect } from "next/navigation";

type Props = {
	params: Promise<{ locale: string }>;
	searchParams: Promise<{ redirectTo?: string }>;
};

export default async function NewOrganizationPage({
	params,
	searchParams,
}: Props) {
	const [{ locale }, rawSearchParams] = await Promise.all([
		params,
		searchParams,
	]);
	const redirectTo = Array.isArray(rawSearchParams.redirectTo)
		? rawSearchParams.redirectTo[0]
		: rawSearchParams.redirectTo;

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
			<CreateOrganizationForm
				redirectTo={redirectTo ?? `/${locale}/choose-plan`}
			/>
		</AuthWrapper>
	);
}
