"use client";

import type {
	YourWorkEntityType,
	YourWorkItem,
} from "@repo/api/modules/studio/schemas/your-work";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Camera, ListTodoIcon, Package } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { getYourWorkEntityHref } from "./routes";
import { SubmitForReviewDialog } from "./submit-for-review-dialog";
import { SubscribeButton } from "./subscribe-button";

interface YourWorkGroup {
	id: "assigned" | "created" | "subscribed";
	title: string;
	items: YourWorkItem[];
	isLoading: boolean;
}

interface YourWorkGroupedListProps {
	organizationSlug: string;
	entityType: "all" | YourWorkEntityType;
	groups: YourWorkGroup[];
}

function formatDate(dateString: string | null): string {
	if (!dateString) {
		return "-";
	}
	const date = new Date(dateString);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function getEntityLabel(entityType: YourWorkItem["entityType"]) {
	switch (entityType) {
		case "task":
			return "Task";
		case "deliverable":
			return "Deliverable";
		case "shoot":
			return "Shoot";
		default:
			return "Item";
	}
}

function getEntityIcon(entityType: YourWorkItem["entityType"]) {
	switch (entityType) {
		case "task":
			return <ListTodoIcon className="size-3.5" />;
		case "deliverable":
			return <Package className="size-3.5" />;
		case "shoot":
			return <Camera className="size-3.5" />;
		default:
			return null;
	}
}

function getStatusBadge(status: string | null) {
	if (!status) {
		return <Badge variant="outline">-</Badge>;
	}
	return <Badge variant="secondary">{status}</Badge>;
}

function GroupRow({
	organizationSlug,
	item,
	showEntityType,
	groupId,
	onSubmitForReview,
}: {
	organizationSlug: string;
	item: YourWorkItem;
	showEntityType: boolean;
	groupId: YourWorkGroup["id"];
	onSubmitForReview: (item: YourWorkItem) => void;
}) {
	const isSubmittableEntity =
		item.entityType === "task" || item.entityType === "deliverable";
	const submitBlocked =
		item.workflowStatus === "submitted" ||
		item.workflowStatus === "in_review" ||
		item.workflowStatus === "approved";
	const showSubmitAction = groupId === "assigned" && isSubmittableEntity;
	const submitLabel = submitBlocked
		? item.workflowStatus === "in_review"
			? "In review"
			: item.workflowStatus === "approved"
				? "Approved"
				: "Submitted"
		: "Update status";

	return (
		<div className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
			<div className="flex min-w-0 flex-wrap items-center gap-3">
				{showEntityType ? (
					<span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
						{getEntityIcon(item.entityType)}
						{getEntityLabel(item.entityType)}
					</span>
				) : null}
				<Link
					href={getYourWorkEntityHref(organizationSlug, item)}
					className="truncate text-sm font-medium text-neutral-900 hover:underline"
				>
					{item.name}
				</Link>
				<span className="truncate text-sm text-neutral-500">
					{item.bookingName ?? "-"}
				</span>
			</div>
			<div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
				{getStatusBadge(item.status)}
				<span>{formatDate(item.date)}</span>
				{showSubmitAction ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={submitBlocked}
						onClick={() => onSubmitForReview(item)}
					>
						{submitLabel}
					</Button>
				) : null}
				<SubscribeButton
					entityType={item.entityType}
					entityId={item.entityId}
					isSubscribed={item.isSubscribed}
				/>
			</div>
		</div>
	);
}

export function YourWorkGroupedList({
	organizationSlug,
	entityType,
	groups,
}: YourWorkGroupedListProps) {
	const showEntityType = entityType === "all";
	const [activeItem, setActiveItem] = useState<YourWorkItem | null>(null);

	const handleDialogOpenChange = (open: boolean) => {
		if (!open) {
			setActiveItem(null);
		}
	};

	return (
		<div className="flex flex-col gap-5">
			{groups.map((group) => (
				<div
					key={group.id}
					className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
				>
					<div className="flex items-center gap-2 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-700">
						<span>{group.title}</span>
						<span className="text-xs text-neutral-500">
							{group.items.length}
						</span>
					</div>
					<div className="divide-y divide-neutral-100">
						{group.isLoading ? (
							<div className="px-4 py-6 text-sm text-neutral-500">
								Loading {group.title.toLowerCase()} items...
							</div>
						) : group.items.length === 0 ? (
							<div className="px-4 py-6 text-sm text-neutral-500">
								No {group.title.toLowerCase()} items.
							</div>
						) : (
							group.items.map((item) => (
								<GroupRow
									key={item.id}
									organizationSlug={organizationSlug}
									item={item}
									showEntityType={showEntityType}
									groupId={group.id}
									onSubmitForReview={setActiveItem}
								/>
							))
						)}
					</div>
				</div>
			))}
			<SubmitForReviewDialog
				item={activeItem}
				isOpen={Boolean(activeItem)}
				onOpenChange={handleDialogOpenChange}
			/>
		</div>
	);
}
