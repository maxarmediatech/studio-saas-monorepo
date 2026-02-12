import type { PaymentScheduleStatus } from "@repo/api/modules/studio/schemas/common";
import {
	AlertTriangleIcon,
	CalendarClockIcon,
	CheckCircle2Icon,
	CircleDashedIcon,
	type LucideIcon,
	XCircleIcon,
} from "lucide-react";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_LABELS: Record<PaymentScheduleStatus, string> = {
	pending: "Pending",
	partial: "Partial",
	completed: "Completed",
	overdue: "Overdue",
	cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<PaymentScheduleStatus, BadgeVariant> = {
	pending: "default",
	partial: "secondary",
	completed: "default",
	overdue: "destructive",
	cancelled: "outline",
};

const STATUS_ICONS: Record<PaymentScheduleStatus, LucideIcon> = {
	pending: CircleDashedIcon,
	partial: CalendarClockIcon,
	completed: CheckCircle2Icon,
	overdue: AlertTriangleIcon,
	cancelled: XCircleIcon,
};

const STATUS_COMPACT_CLASS_NAMES: Record<PaymentScheduleStatus, string> = {
	pending:
		"text-yellow-700 bg-yellow-50 ring-yellow-600/20 dark:text-yellow-400 dark:bg-yellow-950 dark:ring-yellow-500/20",
	partial:
		"text-amber-700 bg-amber-50 ring-amber-600/20 dark:text-amber-400 dark:bg-amber-950 dark:ring-amber-500/20",
	completed:
		"text-green-700 bg-green-50 ring-green-600/20 dark:text-green-400 dark:bg-green-950 dark:ring-green-500/20",
	overdue:
		"text-red-700 bg-red-50 ring-red-600/10 dark:text-red-400 dark:bg-red-950 dark:ring-red-500/20",
	cancelled:
		"text-gray-700 bg-gray-100 ring-gray-600/20 dark:text-gray-300 dark:bg-gray-900 dark:ring-gray-500/30",
};

function isPaymentScheduleStatus(
	value: string,
): value is PaymentScheduleStatus {
	return Object.hasOwn(STATUS_LABELS, value);
}

export function getScheduleStatusLabel(status: string): string {
	return isPaymentScheduleStatus(status) ? STATUS_LABELS[status] : "Unknown";
}

export function getScheduleStatusVariant(status: string): BadgeVariant {
	return isPaymentScheduleStatus(status)
		? STATUS_VARIANTS[status]
		: "outline";
}

export function getScheduleStatusIcon(status: string): LucideIcon {
	return isPaymentScheduleStatus(status)
		? STATUS_ICONS[status]
		: CircleDashedIcon;
}

export function getScheduleStatusCompactClassName(status: string): string {
	return isPaymentScheduleStatus(status)
		? STATUS_COMPACT_CLASS_NAMES[status]
		: "text-gray-700 bg-gray-100 ring-gray-600/20 dark:text-gray-300 dark:bg-gray-900 dark:ring-gray-500/30";
}
