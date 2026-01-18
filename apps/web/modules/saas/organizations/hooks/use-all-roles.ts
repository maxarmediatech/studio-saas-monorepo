"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

export interface RoleOption {
	value: string;
	label: string;
	isStatic: boolean;
	description?: string;
	color?: string;
}

const STATIC_ROLE_KEYS = [
	"owner",
	"admin",
	"manager",
	"post_production_manager",
	"hr",
	"member",
	"crew",
] as const;

export function useAllRoles(options?: { enabled?: boolean }) {
	const t = useTranslations();

	const { data: customRoles, isLoading } = useQuery(
		{
			...orpc.organizations.roles.list.queryOptions({}),
			enabled: options?.enabled ?? true,
		},
	);

	const staticRoles: RoleOption[] = STATIC_ROLE_KEYS.map((key) => ({
		value: key,
		label: t(`organizations.roles.${key}`),
		isStatic: true,
	}));

	const dynamicRoles: RoleOption[] = (customRoles ?? []).map((role) => ({
		value: role.role,
		label: role.role
			.replace(/_/g, " ")
			.replace(/\b\w/g, (c) => c.toUpperCase()),
		isStatic: false,
		description: role.description ?? undefined,
		color: role.color ?? undefined,
	}));

	return {
		roles: [...staticRoles, ...dynamicRoles],
		staticRoles,
		customRoles: dynamicRoles,
		isLoading,
		getRoleLabel: (roleKey: string): string => {
			const staticRole = staticRoles.find((r) => r.value === roleKey);
			if (staticRole) return staticRole.label;

			const customRole = dynamicRoles.find((r) => r.value === roleKey);
			if (customRole) return customRole.label;

			return roleKey
				.replace(/_/g, " ")
				.replace(/\b\w/g, (c) => c.toUpperCase());
		},
	};
}
