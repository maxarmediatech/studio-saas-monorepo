import {
	type AnyAction,
	type CustomRolePermissions,
	checkRolePermission,
	type Resource,
} from "@repo/auth/lib/permissions";

function any(
	role: string | string[],
	resource: Resource,
	actions: AnyAction[],
	customRolePermissions?: CustomRolePermissions,
): boolean {
	return actions.some((action) =>
		checkRolePermission(role, resource, action, customRolePermissions),
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

export function getCapabilities(
	userRole: string | string[],
	customRolePermissions?: CustomRolePermissions,
): HeaderCapabilities {
	return {
		bookingCreateOrUpdate: any(
			userRole,
			"booking",
			["create", "update"],
			customRolePermissions,
		),
		shootCreateOrUpdate: any(
			userRole,
			"shoot",
			["create", "update"],
			customRolePermissions,
		),
		deliverableCreateOrUpdate: any(
			userRole,
			"deliverable",
			["create", "update"],
			customRolePermissions,
		),
		taskCreateOrUpdate: any(
			userRole,
			"task",
			["create", "update"],
			customRolePermissions,
		),
		expenseCreateOrUpdate: any(
			userRole,
			"expense",
			["create", "update"],
			customRolePermissions,
		),
		paymentCreateOrUpdate: any(
			userRole,
			"payment",
			["create", "update"],
			customRolePermissions,
		),
		crewCreateOrUpdate: any(
			userRole,
			"crew",
			["create", "update"],
			customRolePermissions,
		),
		clientCreateOrUpdate: any(
			userRole,
			"client",
			["create", "update"],
			customRolePermissions,
		),
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
