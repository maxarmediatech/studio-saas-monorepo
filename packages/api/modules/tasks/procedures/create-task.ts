import { ORPCError } from "@orpc/server";
import {
	and,
	asc,
	bookings,
	db,
	deliverables,
	deliverableTaskLinks,
	eq,
	inArray,
	isNull,
	tasks,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { safeTrackActivity } from "../../activities/lib";
import { safeAutoSubscribe } from "../../notifications/lib/notification-service";
import { requirePermission } from "../../studio/lib/permissions";
import { taskMetadataForCreate } from "../../studio/lib/relationship-metadata";
import {
	createTaskInputSchema,
	createTaskOutputSchema,
} from "../../studio/schemas/task";

export const createTask = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/tasks",
		tags: ["Tasks"],
		summary: "Create task",
		description:
			"Create a new task for a booking, optionally linked to deliverables for context",
	})
	.input(createTaskInputSchema)
	.output(createTaskOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "task", "create");
		const deliverableIds = [...(input.deliverableIds ?? [])].sort();
		if (deliverableIds.length > 0) {
			await requirePermission(context, "deliverable", "update");
		}

		const {
			bookingId,
			name,
			description,
			status,
			priority,
			dueDate,
			metadata,
		} = input;

		const result = await db.transaction(async (tx) => {
			const booking = await tx.query.bookings.findFirst({
				where: and(
					eq(bookings.id, bookingId),
					eq(bookings.organizationId, context.organizationId),
					isNull(bookings.deletedAt),
				),
			});
			if (!booking) {
				throw new ORPCError("NOT_FOUND", {
					message: "Booking not found",
				});
			}

			const selectedDeliverables =
				deliverableIds.length === 0
					? []
					: await tx
							.select({
								id: deliverables.id,
								name: deliverables.name,
								bookingId: deliverables.bookingId,
							})
							.from(deliverables)
							.where(
								and(
									inArray(deliverables.id, deliverableIds),
									eq(
										deliverables.organizationId,
										context.organizationId,
									),
									isNull(deliverables.deletedAt),
								),
							)
							.orderBy(asc(deliverables.id));
			if (selectedDeliverables.length !== deliverableIds.length) {
				throw new ORPCError("NOT_FOUND", {
					message: "One or more deliverables were not found",
				});
			}
			if (
				selectedDeliverables.some(
					(deliverable) => deliverable.bookingId !== bookingId,
				)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Task and deliverables must belong to the same booking",
				});
			}

			const [created] = await tx
				.insert(tasks)
				.values({
					organizationId: context.organizationId,
					bookingId,
					name,
					description: description ?? null,
					status: status ?? "pending",
					priority: priority ?? "normal",
					dueDate: dueDate ?? null,
					metadata: taskMetadataForCreate(metadata ?? null),
					createdBy: context.user.id,
				})
				.returning({ id: tasks.id });
			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create task",
				});
			}

			if (deliverableIds.length > 0) {
				await tx.insert(deliverableTaskLinks).values(
					deliverableIds.map((deliverableId) => ({
						organizationId: context.organizationId,
						bookingId,
						deliverableId,
						taskId: created.id,
						kind: "reference" as const,
						createdBy: context.user.id,
					})),
				);
			}

			return { created, booking, selectedDeliverables };
		});

		await safeTrackActivity(
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "task",
				entityId: result.created.id,
				entityName: name,
				action: "created",
				parentEntityType: "booking",
				parentEntityId: bookingId,
				parentEntityName: result.booking.name,
				metadata: { priority: priority ?? "normal" },
			},
		);
		await Promise.all(
			result.selectedDeliverables.map((deliverable) =>
				safeTrackActivity(context, {
					entityType: "deliverable",
					entityId: deliverable.id,
					entityName: deliverable.name,
					action: "task_linked",
					parentEntityType: "booking",
					parentEntityId: bookingId,
					metadata: {
						taskId: result.created.id,
						taskName: name,
						kind: "reference",
					},
				}),
			),
		);
		await safeAutoSubscribe({
			organizationId: context.organizationId,
			userId: context.user.id,
			entityType: "task",
			entityId: result.created.id,
		});

		return {
			data: { id: result.created.id },
			message: "Task created successfully",
		};
	});
