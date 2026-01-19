"use client";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { useTranslations } from "next-intl";
import { OrganizationMembersList } from "./OrganizationMembersList";

export function OrganizationMembersBlock({
	organizationId,
}: {
	organizationId: string;
}) {
	const t = useTranslations();

	return (
		<SettingsItem
			title={t("organizations.settings.members.title")}
			description={t("organizations.settings.members.description")}
		>
			<OrganizationMembersList organizationId={organizationId} />
		</SettingsItem>
	);
}
