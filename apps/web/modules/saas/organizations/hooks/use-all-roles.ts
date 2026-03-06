"use client";

import {
	editableRoleMeta,
	isProfileOnlyRole,
} from "@repo/auth/lib/permissions";
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

const STATIC_ROLE_KEYS = ["owner", "admin", "member"] as const;
const EDITABLE_ROLE_KEYS = new Map<string, (typeof editableRoleMeta)[number]>(
	editableRoleMeta.map((role) => [role.key, role]),
);

export function useAllRoles(options?: { enabled?: boolean }) {
	const t = useTranslations();

	const { data: customRoles, isLoading } = useQuery({
		...orpc.organizations.roles.list.queryOptions({}),
		enabled: options?.enabled ?? true,
	});

	const staticRoles: RoleOption[] = STATIC_ROLE_KEYS.map((key) => ({
		value: key,
		label: t(`organizations.roles.${key}`),
		isStatic: true,
	}));

	const dynamicRoles: RoleOption[] = (customRoles ?? [])
		.filter((role) => !isProfileOnlyRole(role.role))
		.map((role) => {
			const defaultRole = EDITABLE_ROLE_KEYS.get(role.role);
			return {
				value: role.role,
				label: defaultRole
					? t(`organizations.roles.${role.role}`)
					: role.role
							.replace(/_/g, " ")
							.replace(/\b\w/g, (c) => c.toUpperCase()),
				isStatic: false,
				description:
					role.description ?? defaultRole?.description ?? undefined,
				color: role.color ?? undefined,
			};
		});

	return {
		roles: [...staticRoles, ...dynamicRoles],
		staticRoles,
		customRoles: dynamicRoles,
		isLoading,
		getRoleLabel: (roleKey: string): string => {
			const staticRole = staticRoles.find((r) => r.value === roleKey);
			if (staticRole) {
				return staticRole.label;
			}

			const customRole = dynamicRoles.find((r) => r.value === roleKey);
			if (customRole) {
				return customRole.label;
			}

			return roleKey
				.replace(/_/g, " ")
				.replace(/\b\w/g, (c) => c.toUpperCase());
		},
	};
}
