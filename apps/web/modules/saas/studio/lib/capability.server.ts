import {
	type CustomRolePermissions,
	checkRolePermission,
	type PermissionAction,
	type Resource,
} from "@repo/auth/lib/permissions";

function any(
	role: string | string[],
	resource: Resource,
	actions: PermissionAction[],
	customRolePermissions?: CustomRolePermissions,
): boolean {
	return actions.some((action) =>
		checkRolePermission(role, resource, action, customRolePermissions),
	);
}

export interface HeaderCapabilities {
	bookingCreateOrUpdate: boolean;
	quoteCreate: boolean;
	quoteReadOperational: boolean;
	quoteUpdate: boolean;
	quoteSend: boolean;
	quoteRevise: boolean;
	quoteAccept: boolean;
	quoteDecline: boolean;
	quoteExpire: boolean;
	quoteConvert: boolean;
	shootCreateOrUpdate: boolean;
	deliverableCreateOrUpdate: boolean;
	deliverableUpdate: boolean;
	deliverableList: boolean;
	taskCreateOrUpdate: boolean;
	taskCreate: boolean;
	taskRead: boolean;
	taskListOrReference: boolean;
	bookingReadOrList: boolean;
	bookingReadOrReference: boolean;
	shootReadOrList: boolean;
	deliverableReadOrList: boolean;
	taskReadOrList: boolean;
	expenseCreateOrUpdate: boolean;
	paymentCreateOrUpdate: boolean;
	expenseReadOrReference: boolean;
	paymentReadOrReference: boolean;
	crewCreateOrUpdate: boolean;
	clientCreateOrUpdate: boolean;
	clientList: boolean;
	configurationCreateOrUpdate: boolean;
	activityRead: boolean;
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
		quoteCreate: any(userRole, "quote", ["create"], customRolePermissions),
		quoteReadOperational: any(
			userRole,
			"quote",
			["readOperational"],
			customRolePermissions,
		),
		quoteUpdate: any(userRole, "quote", ["update"], customRolePermissions),
		quoteSend: any(userRole, "quote", ["send"], customRolePermissions),
		quoteRevise: any(userRole, "quote", ["revise"], customRolePermissions),
		quoteAccept: any(userRole, "quote", ["accept"], customRolePermissions),
		quoteDecline: any(
			userRole,
			"quote",
			["decline"],
			customRolePermissions,
		),
		quoteExpire: any(userRole, "quote", ["expire"], customRolePermissions),
		quoteConvert: any(
			userRole,
			"quote",
			["convert"],
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
		deliverableUpdate: any(
			userRole,
			"deliverable",
			["update"],
			customRolePermissions,
		),
		deliverableList: any(
			userRole,
			"deliverable",
			["list"],
			customRolePermissions,
		),
		taskCreateOrUpdate: any(
			userRole,
			"task",
			["create", "update"],
			customRolePermissions,
		),
		taskCreate: any(userRole, "task", ["create"], customRolePermissions),
		taskRead: any(userRole, "task", ["read"], customRolePermissions),
		taskListOrReference: any(
			userRole,
			"task",
			["list", "reference"],
			customRolePermissions,
		),
		bookingReadOrList: any(
			userRole,
			"booking",
			["read", "list"],
			customRolePermissions,
		),
		bookingReadOrReference: any(
			userRole,
			"booking",
			["read", "list", "reference"],
			customRolePermissions,
		),
		shootReadOrList: any(
			userRole,
			"shoot",
			["read", "list"],
			customRolePermissions,
		),
		deliverableReadOrList: any(
			userRole,
			"deliverable",
			["read", "list"],
			customRolePermissions,
		),
		taskReadOrList: any(
			userRole,
			"task",
			["read", "list"],
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
		expenseReadOrReference: any(
			userRole,
			"expense",
			["read", "list", "reference"],
			customRolePermissions,
		),
		paymentReadOrReference: any(
			userRole,
			"payment",
			["read", "list", "reference"],
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
		clientList: any(userRole, "client", ["list"], customRolePermissions),
		configurationCreateOrUpdate: any(
			userRole,
			"configuration",
			["create", "update"],
			customRolePermissions,
		),
		activityRead: any(
			userRole,
			"dashboard",
			["read"],
			customRolePermissions,
		),
	};
}

export function selectHeaderCaps(caps: HeaderCapabilities): HeaderCapabilities {
	return {
		bookingCreateOrUpdate: caps.bookingCreateOrUpdate,
		quoteCreate: caps.quoteCreate,
		quoteReadOperational: caps.quoteReadOperational,
		quoteUpdate: caps.quoteUpdate,
		quoteSend: caps.quoteSend,
		quoteRevise: caps.quoteRevise,
		quoteAccept: caps.quoteAccept,
		quoteDecline: caps.quoteDecline,
		quoteExpire: caps.quoteExpire,
		quoteConvert: caps.quoteConvert,
		shootCreateOrUpdate: caps.shootCreateOrUpdate,
		deliverableCreateOrUpdate: caps.deliverableCreateOrUpdate,
		deliverableUpdate: caps.deliverableUpdate,
		deliverableList: caps.deliverableList,
		taskCreateOrUpdate: caps.taskCreateOrUpdate,
		taskCreate: caps.taskCreate,
		taskRead: caps.taskRead,
		taskListOrReference: caps.taskListOrReference,
		bookingReadOrList: caps.bookingReadOrList,
		bookingReadOrReference: caps.bookingReadOrReference,
		shootReadOrList: caps.shootReadOrList,
		deliverableReadOrList: caps.deliverableReadOrList,
		taskReadOrList: caps.taskReadOrList,
		expenseCreateOrUpdate: caps.expenseCreateOrUpdate,
		paymentCreateOrUpdate: caps.paymentCreateOrUpdate,
		expenseReadOrReference: caps.expenseReadOrReference,
		paymentReadOrReference: caps.paymentReadOrReference,
		crewCreateOrUpdate: caps.crewCreateOrUpdate,
		clientCreateOrUpdate: caps.clientCreateOrUpdate,
		clientList: caps.clientList,
		configurationCreateOrUpdate: caps.configurationCreateOrUpdate,
		activityRead: caps.activityRead,
	};
}
