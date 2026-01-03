import { roleHasPermission } from "@repo/api/modules/studio/lib/roles";

/**
 * Check if a role has any of the specified actions for a resource.
 */
function any(role: string, resource: string, actions: string[]): boolean {
	return actions.some((action) =>
		roleHasPermission(role, resource as never, action as never),
	);
}

/**
 * Capabilities for header actions (New button dropdown).
 * Determines what the user can create based on their role.
 */
export interface HeaderCapabilities {
	bookingCreateOrUpdate: boolean;
	shootCreateOrUpdate: boolean;
	deliverableCreateOrUpdate: boolean;
	taskCreateOrUpdate: boolean;
	expenseCreateOrUpdate: boolean;
	paymentCreateOrUpdate: boolean;
	crewCreateOrUpdate: boolean;
	clientCreateOrUpdate: boolean;
}

/**
 * Get capabilities for a user based on their role.
 * Used to determine which "New" actions are available in the header.
 */
export function getCapabilities(userRole: string): HeaderCapabilities {
	return {
		bookingCreateOrUpdate: any(userRole, "booking", ["create", "update"]),
		shootCreateOrUpdate: any(userRole, "shoot", ["create", "update"]),
		deliverableCreateOrUpdate: any(userRole, "deliverable", [
			"create",
			"update",
		]),
		taskCreateOrUpdate: any(userRole, "task", ["create", "update"]),
		expenseCreateOrUpdate: any(userRole, "expense", ["create", "update"]),
		paymentCreateOrUpdate: any(userRole, "payment", ["create", "update"]),
		crewCreateOrUpdate: any(userRole, "crew", ["create", "update"]),
		clientCreateOrUpdate: any(userRole, "client", ["create", "update"]),
	};
}

/**
 * Select only the capabilities needed for the header.
 * Keeps the serialized props small.
 */
export function selectHeaderCaps(caps: HeaderCapabilities): HeaderCapabilities {
	return {
		bookingCreateOrUpdate: caps.bookingCreateOrUpdate,
		shootCreateOrUpdate: caps.shootCreateOrUpdate,
		deliverableCreateOrUpdate: caps.deliverableCreateOrUpdate,
		taskCreateOrUpdate: caps.taskCreateOrUpdate,
		expenseCreateOrUpdate: caps.expenseCreateOrUpdate,
		paymentCreateOrUpdate: caps.paymentCreateOrUpdate,
		crewCreateOrUpdate: caps.crewCreateOrUpdate,
		clientCreateOrUpdate: caps.clientCreateOrUpdate,
	};
}
