"use client";

import type { QuickActionItem } from "@repo/api/modules/studio/schemas/dashboard";
import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import {
	AlertCircleIcon,
	ArrowRightIcon,
	CalendarIcon,
	CheckSquareIcon,
	CreditCardIcon,
	InboxIcon,
	PackageIcon,
} from "lucide-react";
import Link from "next/link";

interface NeedsAttentionProps {
	actions: QuickActionItem[];
	totalCount: number;
	organizationSlug: string;
}

const iconMap: Record<string, typeof AlertCircleIcon> = {
	booking: AlertCircleIcon,
	shoot: CalendarIcon,
	task: CheckSquareIcon,
	deliverable: PackageIcon,
	payment: CreditCardIcon,
	submission: InboxIcon,
};

const priorityColors: Record<string, string> = {
	high: "bg-destructive/10 text-destructive border-destructive/20",
	medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
	low: "bg-muted text-muted-foreground border-muted",
};

function getEntityLink(
	organizationSlug: string,
	entityType: string,
	entityId: string,
	bookingId?: string,
): string {
	const base = `/app/${organizationSlug}`;
	switch (entityType) {
		case "booking":
			return `${base}/bookings/${entityId}`;
		case "shoot":
			return `${base}/shoots/${entityId}`;
		case "task":
			return `${base}/tasks/${entityId}`;
		case "deliverable":
			return `${base}/deliverables/${entityId}`;
		case "payment":
			return bookingId
				? `${base}/bookings/${bookingId}?tab=payments`
				: `${base}/payments`;
		case "submission":
			return `${base}/reviews`;
		default:
			return base;
	}
}

export function NeedsAttention({
	actions,
	totalCount,
	organizationSlug,
}: NeedsAttentionProps) {
	const displayActions = actions.slice(0, 5);

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base font-semibold flex items-center gap-2">
						<AlertCircleIcon className="size-4 text-amber-500" />
						Needs Attention
						{totalCount > 0 && (
							<Badge variant="secondary" className="ml-1">
								{totalCount}
							</Badge>
						)}
					</CardTitle>
				</div>
			</CardHeader>
			<CardContent className="pb-4">
				{displayActions.length === 0 ? (
					<p className="text-sm text-muted-foreground text-center py-4">
						All caught up! No items need immediate attention.
					</p>
				) : (
					<div className="space-y-2">
						{displayActions.map((action) => {
							const Icon =
								iconMap[action.entityType] ?? AlertCircleIcon;
							const href = getEntityLink(
								organizationSlug,
								action.entityType,
								action.entityId,
								action.bookingId,
							);

							return (
								<Link
									key={`${action.type}-${action.entityId}`}
									href={href}
									className="flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-muted/50"
								>
									<div className="flex items-center gap-3 min-w-0">
										<div
											className={cn(
												"flex size-8 items-center justify-center rounded-lg border",
												priorityColors[action.priority],
											)}
										>
											<Icon className="size-4" />
										</div>
										<div className="min-w-0">
											<p className="text-sm font-medium truncate">
												{action.title}
											</p>
											<p className="text-xs text-muted-foreground truncate">
												{action.description}
											</p>
										</div>
									</div>
									<ArrowRightIcon className="size-4 text-muted-foreground flex-shrink-0" />
								</Link>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
