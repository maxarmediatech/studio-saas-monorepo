import type { OrganizationMemberRole } from "@repo/auth";
import { useTranslations } from "next-intl";

export function useOrganizationMemberRoles() {
	const t = useTranslations();

	const roles: Record<string, string> = {
		owner: t("organizations.roles.owner"),
		admin: t("organizations.roles.admin"),
		manager: t("organizations.roles.manager"),
		post_production_manager: t(
			"organizations.roles.post_production_manager",
		),
		hr: t("organizations.roles.hr"),
		member: t("organizations.roles.member"),
	};

	return roles satisfies Record<OrganizationMemberRole, string>;
}
