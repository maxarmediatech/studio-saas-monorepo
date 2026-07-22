"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@repo/ui/components/empty";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Spinner } from "@repo/ui/components/spinner";
import { deliverablesMutations, tasksApi } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	LinkIcon,
	ListTodoIcon,
	PlusIcon,
	Trash2Icon,
	TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type LinkKind = "required" | "optional" | "reference";

interface DeliverableTaskLinkItem {
	id: string;
	taskId: string;
	kind: LinkKind;
	task: {
		id: string;
		name: string;
		workflowStatus: string;
		dueDate: string | null;
	};
}

interface DeliverableTaskLinksProps {
	deliverableId: string;
	bookingId: string;
	organizationSlug: string;
	trackingMode: "direct" | "task_based";
	completedAt: string | null;
	deliveredAt: string | null;
	taskLinks: DeliverableTaskLinkItem[];
	canManage: boolean;
	canLinkTasks: boolean;
}

export function DeliverableTaskLinks({
	deliverableId,
	bookingId,
	organizationSlug,
	trackingMode,
	completedAt,
	deliveredAt,
	taskLinks,
	canManage,
	canLinkTasks,
}: DeliverableTaskLinksProps) {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [taskId, setTaskId] = useState("");
	const [kind, setKind] = useState<LinkKind>("required");
	const tasksQuery = useQuery({
		...tasksApi.listMinimalOptions({ bookingId, limit: 100 }),
		enabled: dialogOpen,
	});
	const linkedTaskIds = useMemo(
		() => new Set(taskLinks.map((link) => link.taskId)),
		[taskLinks],
	);
	const availableTasks =
		tasksQuery.data?.data.filter((task) => !linkedTaskIds.has(task.id)) ??
		[];

	const invalidate = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: orpc.deliverables.key(),
			}),
			queryClient.invalidateQueries({ queryKey: orpc.tasks.key() }),
			queryClient.invalidateQueries({ queryKey: orpc.activities.key() }),
		]);
	};
	const linkMutation = useMutation({
		...deliverablesMutations.linkTask(),
		onSuccess: async () => {
			await invalidate();
			setDialogOpen(false);
			setTaskId("");
			setKind("required");
			toast.success("Task linked");
		},
		onError: (error) => toast.error(error.message || "Failed to link task"),
	});
	const unlinkMutation = useMutation({
		...deliverablesMutations.unlinkTask(),
		onSuccess: async () => {
			await invalidate();
			toast.success("Task unlinked");
		},
		onError: (error) =>
			toast.error(error.message || "Failed to unlink task"),
	});
	const deliveryMutation = useMutation({
		...deliverablesMutations.setDelivery(),
		onSuccess: async (_response, variables) => {
			await invalidate();
			toast.success(
				variables.deliveredAt === null
					? "Delivery timestamp cleared"
					: "Marked as delivered",
			);
		},
		onError: (error) =>
			toast.error(error.message || "Failed to update delivery"),
	});

	return (
		<section className="mt-8 flex flex-col gap-4 border-t pt-6">
			{deliveredAt && !completedAt ? (
				<div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
					<TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
					<div>
						<p className="font-medium">
							Delivered work needs attention
						</p>
						<p className="mt-0.5 text-amber-800/80 dark:text-amber-200/80">
							Required work changed after delivery. The delivery
							record is preserved; clear it only if the client
							delivery should no longer count.
						</p>
					</div>
				</div>
			) : null}
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h2 className="font-semibold">Production workflow</h2>
					<p className="text-sm text-muted-foreground">
						{trackingMode === "task_based"
							? "Required tasks automatically drive this deliverable."
							: "Link booking tasks without changing direct delivery work."}
					</p>
				</div>
				{canManage ? (
					<div className="flex flex-wrap gap-2">
						{completedAt || deliveredAt ? (
							<Button
								variant="outline"
								size="sm"
								disabled={deliveryMutation.isPending}
								onClick={() =>
									deliveryMutation.mutate({
										id: deliverableId,
										deliveredAt: deliveredAt
											? null
											: undefined,
									})
								}
							>
								{deliveryMutation.isPending ? (
									<Spinner data-icon="inline-start" />
								) : (
									<CheckCircle2Icon data-icon="inline-start" />
								)}
								{deliveredAt
									? "Clear delivery"
									: "Mark delivered"}
							</Button>
						) : null}
						{canLinkTasks ? (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setDialogOpen(true)}
							>
								<PlusIcon data-icon="inline-start" />
								Link task
							</Button>
						) : null}
					</div>
				) : null}
			</div>

			{taskLinks.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<LinkIcon />
						</EmptyMedia>
						<EmptyTitle>No linked tasks</EmptyTitle>
						<EmptyDescription>
							Required links make task progress the source of
							truth.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<div className="divide-y rounded-lg border">
					{taskLinks.map((taskLink) => (
						<div
							key={taskLink.id}
							className="flex items-center justify-between gap-3 px-4 py-3"
						>
							<div className="flex min-w-0 items-center gap-3">
								<ListTodoIcon className="size-4 shrink-0 text-muted-foreground" />
								<div className="min-w-0">
									<Link
										href={`/app/${organizationSlug}/tasks/${taskLink.task.id}`}
										className="block truncate text-sm font-medium hover:underline"
									>
										{taskLink.task.name}
									</Link>
									<div className="mt-1 flex flex-wrap gap-2">
										<Badge variant="secondary">
											{taskLink.kind}
										</Badge>
										<Badge variant="outline">
											{taskLink.task.workflowStatus.replaceAll(
												"_",
												" ",
											)}
										</Badge>
									</div>
								</div>
							</div>
							{canManage ? (
								<Button
									variant="ghost"
									size="icon-sm"
									disabled={unlinkMutation.isPending}
									onClick={() =>
										unlinkMutation.mutate({
											deliverableId,
											taskId: taskLink.taskId,
										})
									}
								>
									<Trash2Icon />
									<span className="sr-only">Unlink task</span>
								</Button>
							) : null}
						</div>
					))}
				</div>
			)}

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Link a booking task</DialogTitle>
						<DialogDescription>
							Required tasks control progress and readiness.
							Optional and reference tasks do not block delivery.
						</DialogDescription>
					</DialogHeader>
					<FieldGroup>
						<Field>
							<FieldLabel>Task</FieldLabel>
							<Select value={taskId} onValueChange={setTaskId}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Choose a task" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{availableTasks.map((task) => (
											<SelectItem
												key={task.id}
												value={task.id}
											>
												{task.name}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel>Relationship</FieldLabel>
							<Select
								value={kind}
								onValueChange={(value) =>
									setKind(value as LinkKind)
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										<SelectItem value="required">
											Required
										</SelectItem>
										<SelectItem value="optional">
											Optional
										</SelectItem>
										<SelectItem value="reference">
											Reference
										</SelectItem>
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							disabled={!taskId || linkMutation.isPending}
							onClick={() =>
								linkMutation.mutate({
									deliverableId,
									taskId,
									kind,
								})
							}
						>
							{linkMutation.isPending ? (
								<Spinner data-icon="inline-start" />
							) : (
								<LinkIcon data-icon="inline-start" />
							)}
							Link task
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}
