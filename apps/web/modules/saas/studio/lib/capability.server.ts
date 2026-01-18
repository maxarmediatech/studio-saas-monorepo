import {
	type AnyAction,
	checkStaticRolePermission,
	type Resource,
} from "@repo/auth/lib/permissions";

function any(role: string, resource: Resource, actions: AnyAction[]): boolean {
	return actions.some((action) =>
		checkStaticRolePermission(role, resource, action),
	);
}

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
