"use client";
import { OrganizationMembersList } from "./OrganizationMembersList";

export function OrganizationMembersBlock({
	organizationId,
}: {
	organizationId: string;
}) {
	return <OrganizationMembersList organizationId={organizationId} />;
}
