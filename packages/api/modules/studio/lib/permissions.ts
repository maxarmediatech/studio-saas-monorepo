import { ORPCError } from "@orpc/server";
import { auth } from "@repo/auth";
import {
	type Action,
	hasAnyRole,
	type PermissionAction,
	type Resource,
} from "@repo/auth/lib/permissions";

export interface StudioContext {
	headers: Headers;
	organizationId: string;
	membership: {
		id: string;
		role: string | string[];
		organization: {
			id: string;
			name: string;
			slug: string | null;
			timezone: string;
		};
	};
	user: {
		id: string;
		email: string;
		name: string;
		timezone?: string | null;
	};
	session: {
		id: string;
		userId: string;
		activeOrganizationId: string | null;
	};
}

export async function hasPermission<R extends Resource>(
	context: Pick<StudioContext, "headers" | "organizationId">,
	resource: R,
	action: Action<R>,
): Promise<boolean> {
	const result = await auth.api.hasPermission({
		headers: context.headers,
		body: {
			organizationId: context.organizationId,
			permissions: { [resource]: [action] },
		},
	});
	return !!result?.success;
}

export async function requirePermission<R extends Resource>(
	context: Pick<StudioContext, "headers" | "organizationId">,
	resource: R,
	action: Action<R>,
): Promise<void> {
	const allowed = await hasPermission(context, resource, action);
	if (!allowed) {
		throw new ORPCError("FORBIDDEN", {
			message: `Permission denied: cannot ${action} ${resource}`,
		});
	}
}

export function requireOrganizationAdmin(
	context: Pick<StudioContext, "membership">,
): void {
	if (!hasAnyRole(context.membership.role, ["owner", "admin"])) {
		throw new ORPCError("FORBIDDEN", {
			message: "Only organization owners and admins can manage roles",
		});
	}
}

export async function requireAnyPermission(
	context: Pick<StudioContext, "headers" | "organizationId">,
	permissions: Array<{ resource: Resource; action: PermissionAction }>,
): Promise<void> {
	const results = await Promise.all(
		permissions.map(({ resource, action }) =>
			hasPermission(context, resource, action as Action<typeof resource>),
		),
	);

	if (!results.some(Boolean)) {
		const permStr = permissions
			.map(({ resource, action }) => `${action} ${resource}`)
			.join(" or ");
		throw new ORPCError("FORBIDDEN", {
			message: `Permission denied: requires ${permStr}`,
		});
	}
}

export async function requireAllPermissions(
	context: Pick<StudioContext, "headers" | "organizationId">,
	permissions: Array<{ resource: Resource; action: PermissionAction }>,
): Promise<void> {
	for (const { resource, action } of permissions) {
		await requirePermission(
			context,
			resource,
			action as Action<typeof resource>,
		);
	}
}

export type {
	Action,
	AnyAction,
	PermissionAction,
	Resource,
} from "@repo/auth/lib/permissions";
