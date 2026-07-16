import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { safeNotifySubscribers } from "../../notifications/lib/notification-service";

vi.mock("../../notifications/lib/notification-service", () => ({
	safeAutoSubscribe: vi.fn(),
	safeNotifySubscribers: vi.fn(),
}));

vi.mock("../../studio/lib/permissions", () => ({
	requirePermission: vi.fn(),
}));

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const originalDatabaseUrl = process.env.DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;
type DatabaseModule = typeof import("@repo/database");
type ClaimServiceModule = typeof import("./review-claim-service");
let activities: DatabaseModule["activities"];
let and: DatabaseModule["and"];
let assignmentSubmissions: DatabaseModule["assignmentSubmissions"];
let bookings: DatabaseModule["bookings"];
let crews: DatabaseModule["crews"];
let db: DatabaseModule["db"];
let deliverableAssignments: DatabaseModule["deliverableAssignments"];
let deliverables: DatabaseModule["deliverables"];
let eq: DatabaseModule["eq"];
let members: DatabaseModule["members"];
let organizations: DatabaseModule["organizations"];
let sql: DatabaseModule["sql"];
let submissionFiles: DatabaseModule["submissionFiles"];
let taskAssignments: DatabaseModule["taskAssignments"];
let tasks: DatabaseModule["tasks"];
let users: DatabaseModule["users"];
let persistWorkSubmission: typeof import("./persist-work-submission")["persistWorkSubmission"];
let lockParentReviewEvidence: typeof import("./parent-review-aggregate")["lockParentReviewEvidence"];
let lockSubmissionParent: typeof import("./parent-review-aggregate")["lockSubmissionParent"];
let recomputeParentReviewAggregate: typeof import("./parent-review-aggregate")["recomputeParentReviewAggregate"];
let administrativelyReassignReview: ClaimServiceModule["administrativelyReassignReview"];
let administrativelyReleaseReview: ClaimServiceModule["administrativelyReleaseReview"];
let claimSubmissionForReview: ClaimServiceModule["claimSubmissionForReview"];
let releaseSubmissionReview: ClaimServiceModule["releaseSubmissionReview"];
let decideSubmissionReview: typeof import("./review-decision-service")["decideSubmissionReview"];
let assignCrewToTask: typeof import("../../tasks/procedures/assign-crew")["assignCrewToTask"];
let unassignCrewFromTask: typeof import("../../tasks/procedures/unassign-crew")["unassignCrewFromTask"];
let assignCrewToDeliverable: typeof import("../../deliverables/procedures/assign-crew")["assignCrewToDeliverable"];
let unassignCrewFromDeliverable: typeof import("../../deliverables/procedures/unassign-crew")["unassignCrewFromDeliverable"];
const suffix = `${process.pid}_${Date.now()}`;
const ids = {
	organization: `submission_org_${suffix}`,
	otherOrganization: `submission_other_org_${suffix}`,
	admin: `submission_admin_${suffix}`,
	reviewerA: `submission_reviewer_a_${suffix}`,
	reviewerB: `submission_reviewer_b_${suffix}`,
	crewUser: `submission_crew_user_${suffix}`,
	crew: `submission_crew_${suffix}`,
	crewB: `submission_crew_b_${suffix}`,
	booking: `submission_booking_${suffix}`,
};

type Actor = {
	organizationId: string;
	user: { id: string; name: string; email: string };
};

const actor = (
	userId: string,
	name: string,
	organizationId = ids.organization,
): Actor => ({
	organizationId,
	user: { id: userId, name, email: `${userId}@example.test` },
});
const reviewerA = actor(ids.reviewerA, "Reviewer A");
const reviewerB = actor(ids.reviewerB, "Reviewer B");
const admin = actor(ids.admin, "Admin");
const crewActor = actor(ids.crewUser, "Crew User");

async function createTaskSubmission({
	organizationId = ids.organization,
	status = "submitted" as const,
	reviewedBy = null as string | null,
	reviewClaimedAt = null as Date | null,
}: {
	organizationId?: string;
	status?: "submitted" | "in_review" | "revision_requested";
	reviewedBy?: string | null;
	reviewClaimedAt?: Date | null;
} = {}) {
	const token = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
	const bookingId = `${organizationId}_booking_${token}`;
	const taskId = `${organizationId}_task_${token}`;
	const submissionId = `${organizationId}_submission_${token}`;
	await db.insert(bookings).values({
		id: bookingId,
		organizationId,
		referenceNumber: `SUB-${token}`,
		name: "Submission test booking",
		bookingType: "test",
		packageType: "test",
		packageCost: "100.00",
	});
	await db.insert(tasks).values({
		id: taskId,
		organizationId,
		bookingId,
		name: "Submission test task",
		workflowStatus:
			status === "revision_requested"
				? "revision_requested"
				: "submitted",
	});
	await db.insert(taskAssignments).values({
		taskId,
		crewId: ids.crew,
		assignedBy: ids.admin,
	});
	await db.insert(assignmentSubmissions).values({
		id: submissionId,
		organizationId,
		taskId,
		submittedBy: ids.crew,
		status,
		submittedAt: new Date(),
		reviewedBy,
		reviewClaimedAt,
		reviewedAt: status === "revision_requested" ? new Date() : null,
		reviewNote: status === "revision_requested" ? "Please revise" : null,
	});
	return { bookingId, submissionId, taskId };
}

async function getSubmission(id: string) {
	return db.query.assignmentSubmissions.findFirst({
		where: eq(assignmentSubmissions.id, id),
	});
}

async function createReviewPair(type: "task" | "deliverable") {
	const token = `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
	const bookingId = `${ids.organization}_booking_${token}`;
	const parentId = `${ids.organization}_${type}_${token}`;
	const submissionA = `${ids.organization}_submission_a_${token}`;
	const submissionB = `${ids.organization}_submission_b_${token}`;
	await db.insert(bookings).values({
		id: bookingId,
		organizationId: ids.organization,
		referenceNumber: `PAIR-${token}`,
		name: "Aggregate review booking",
		bookingType: "test",
		packageType: "test",
		packageCost: "100.00",
	});
	if (type === "task") {
		await db.insert(tasks).values({
			id: parentId,
			organizationId: ids.organization,
			bookingId,
			name: "Aggregate review task",
			workflowStatus: "in_review",
		});
		await db.insert(taskAssignments).values([
			{ taskId: parentId, crewId: ids.crew, assignedBy: ids.admin },
			{ taskId: parentId, crewId: ids.crewB, assignedBy: ids.admin },
		]);
	} else {
		await db.insert(deliverables).values({
			id: parentId,
			organizationId: ids.organization,
			bookingId,
			name: "Aggregate review deliverable",
			workflowStatus: "in_review",
		});
		await db.insert(deliverableAssignments).values([
			{
				deliverableId: parentId,
				crewId: ids.crew,
				assignedBy: ids.admin,
			},
			{
				deliverableId: parentId,
				crewId: ids.crewB,
				assignedBy: ids.admin,
			},
		]);
	}
	await db.insert(assignmentSubmissions).values([
		{
			id: submissionA,
			organizationId: ids.organization,
			taskId: type === "task" ? parentId : null,
			deliverableId: type === "deliverable" ? parentId : null,
			submittedBy: ids.crew,
			status: "in_review",
			submittedAt: new Date(),
			reviewedBy: reviewerA.user.id,
			reviewClaimedAt: new Date(),
		},
		{
			id: submissionB,
			organizationId: ids.organization,
			taskId: type === "task" ? parentId : null,
			deliverableId: type === "deliverable" ? parentId : null,
			submittedBy: ids.crewB,
			status: "in_review",
			submittedAt: new Date(),
			reviewedBy: reviewerB.user.id,
			reviewClaimedAt: new Date(),
		},
	]);
	return { parentId, submissionA, submissionB, type };
}

async function getParent(type: "task" | "deliverable", id: string) {
	if (type === "task") {
		const task = await db.query.tasks.findFirst({
			where: eq(tasks.id, id),
			columns: { workflowStatus: true, completedAt: true },
		});
		return task
			? {
					workflowStatus: task.workflowStatus,
					approvedAt: task.completedAt,
				}
			: undefined;
	}
	const deliverable = await db.query.deliverables.findFirst({
		where: eq(deliverables.id, id),
		columns: { workflowStatus: true, deliveredAt: true },
	});
	return deliverable
		? {
				workflowStatus: deliverable.workflowStatus,
				approvedAt: deliverable.deliveredAt,
			}
		: undefined;
}

describePostgres("submission review transitions on PostgreSQL", () => {
	beforeAll(async () => {
		if (!databaseUrl) {
			return;
		}
		process.env.DATABASE_URL = databaseUrl;
		const database = await import("@repo/database");
		({
			activities,
			and,
			assignmentSubmissions,
			bookings,
			crews,
			db,
			deliverableAssignments,
			deliverables,
			eq,
			members,
			organizations,
			sql,
			submissionFiles,
			taskAssignments,
			tasks,
			users,
		} = database);
		({ persistWorkSubmission } = await import("./persist-work-submission"));
		({
			lockParentReviewEvidence,
			lockSubmissionParent,
			recomputeParentReviewAggregate,
		} = await import("./parent-review-aggregate"));
		({
			administrativelyReassignReview,
			administrativelyReleaseReview,
			claimSubmissionForReview,
			releaseSubmissionReview,
		} = await import("./review-claim-service"));
		({ decideSubmissionReview } = await import(
			"./review-decision-service"
		));
		({ assignCrewToTask } = await import(
			"../../tasks/procedures/assign-crew"
		));
		({ unassignCrewFromTask } = await import(
			"../../tasks/procedures/unassign-crew"
		));
		({ assignCrewToDeliverable } = await import(
			"../../deliverables/procedures/assign-crew"
		));
		({ unassignCrewFromDeliverable } = await import(
			"../../deliverables/procedures/unassign-crew"
		));
		await db.insert(organizations).values([
			{
				id: ids.organization,
				name: "Submission transition tests",
				slug: `submission-tests-${suffix}`,
			},
			{
				id: ids.otherOrganization,
				name: "Other submission organization",
				slug: `submission-tests-other-${suffix}`,
			},
		]);
		await db.insert(users).values([
			{
				id: ids.admin,
				name: "Admin",
				email: `${ids.admin}@example.test`,
			},
			{
				id: ids.reviewerA,
				name: "Reviewer A",
				email: `${ids.reviewerA}@example.test`,
			},
			{
				id: ids.reviewerB,
				name: "Reviewer B",
				email: `${ids.reviewerB}@example.test`,
			},
			{
				id: ids.crewUser,
				name: "Crew User",
				email: `${ids.crewUser}@example.test`,
			},
		]);
		await db.insert(members).values(
			[ids.admin, ids.reviewerA, ids.reviewerB, ids.crewUser].map(
				(userId) => ({
					organizationId: ids.organization,
					userId,
					role: userId === ids.admin ? "admin" : "member",
				}),
			),
		);
		await db.insert(crews).values([
			{
				id: ids.crew,
				organizationId: ids.organization,
				userId: ids.crewUser,
				name: "Submission Crew",
			},
			{
				id: ids.crewB,
				organizationId: ids.organization,
				name: "Submission Crew B",
			},
		]);
	});

	beforeEach(() => {
		vi.mocked(safeNotifySubscribers).mockReset();
		vi.mocked(safeNotifySubscribers).mockResolvedValue(0);
	});

	afterAll(async () => {
		if (!databaseUrl) {
			return;
		}
		await db
			.delete(organizations)
			.where(and(eq(organizations.id, ids.organization)));
		await db
			.delete(organizations)
			.where(eq(organizations.id, ids.otherOrganization));
		for (const id of [
			ids.admin,
			ids.reviewerA,
			ids.reviewerB,
			ids.crewUser,
		]) {
			await db.delete(users).where(eq(users.id, id));
		}
		if (originalDatabaseUrl) {
			process.env.DATABASE_URL = originalDatabaseUrl;
		} else {
			delete process.env.DATABASE_URL;
		}
	});

	it("allows exactly one reviewer to claim and makes same-reviewer retry idempotent", async () => {
		const { submissionId } = await createTaskSubmission();
		const results = await Promise.allSettled([
			claimSubmissionForReview(reviewerA, submissionId),
			claimSubmissionForReview(reviewerB, submissionId),
		]);
		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		const claimed = await getSubmission(submissionId);
		expect(claimed?.status).toBe("in_review");
		expect(claimed?.reviewClaimedAt).toBeInstanceOf(Date);
		const winner =
			claimed?.reviewedBy === reviewerA.user.id ? reviewerA : reviewerB;
		await expect(
			claimSubmissionForReview(winner, submissionId),
		).resolves.toMatchObject({
			alreadyClaimed: true,
		});
		const claimActivities = await db.query.activities.findMany({
			where: and(
				eq(activities.entityId, submissionId),
				eq(activities.action, "status_changed"),
			),
		});
		expect(claimActivities).toHaveLength(1);
	});

	it("rejects a losing reviewer decision without changing the parent", async () => {
		const { submissionId, taskId } = await createTaskSubmission();
		await claimSubmissionForReview(reviewerA, submissionId);
		await expect(
			decideSubmissionReview(reviewerB, {
				id: submissionId,
				decision: "approve",
			}),
		).rejects.toThrow("another user");
		expect((await getSubmission(submissionId))?.status).toBe("in_review");
		expect(
			(await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) }))
				?.workflowStatus,
		).toBe("in_review");
		expect(safeNotifySubscribers).not.toHaveBeenCalled();
	});

	it("serializes decisions against release and stale reassignment", async () => {
		const releaseRace = await createTaskSubmission();
		await claimSubmissionForReview(reviewerA, releaseRace.submissionId);
		const decisionVsRelease = await Promise.allSettled([
			decideSubmissionReview(reviewerA, {
				id: releaseRace.submissionId,
				decision: "approve",
			}),
			releaseSubmissionReview(reviewerA, {
				id: releaseRace.submissionId,
				reason: "Hand back to queue",
			}),
		]);
		expect(
			decisionVsRelease.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);

		const reassignmentRace = await createTaskSubmission({
			status: "in_review",
			reviewedBy: reviewerA.user.id,
			reviewClaimedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
		});
		const decisionVsReassign = await Promise.allSettled([
			decideSubmissionReview(reviewerA, {
				id: reassignmentRace.submissionId,
				decision: "approve",
			}),
			administrativelyReassignReview(admin, {
				id: reassignmentRace.submissionId,
				reason: "Reviewer unavailable",
				reviewerId: reviewerB.user.id,
			}),
		]);
		expect(
			decisionVsReassign.filter(
				(result) => result.status === "fulfilled",
			),
		).toHaveLength(1);
	});

	it("rolls back the decision and suppresses notification when aggregate parent update fails", async () => {
		const { submissionId, taskId } = await createTaskSubmission();
		await claimSubmissionForReview(reviewerA, submissionId);
		await db.execute(
			sql.raw(`
				CREATE OR REPLACE FUNCTION reject_parent_aggregate_test()
				RETURNS trigger AS $$
				BEGIN
					IF NEW.id = '${taskId}' THEN
						RAISE EXCEPTION 'forced aggregate update failure';
					END IF;
					RETURN NEW;
				END;
				$$ LANGUAGE plpgsql
			`),
		);
		await db.execute(sql`
			CREATE TRIGGER reject_parent_aggregate_test_trigger
			BEFORE UPDATE ON tasks
			FOR EACH ROW EXECUTE FUNCTION reject_parent_aggregate_test()
		`);
		try {
			await expect(
				decideSubmissionReview(reviewerA, {
					id: submissionId,
					decision: "reject",
					reviewNote: "Cannot accept",
				}),
			).rejects.toThrow("Failed query");
			expect((await getSubmission(submissionId))?.status).toBe(
				"in_review",
			);
			expect(safeNotifySubscribers).not.toHaveBeenCalled();
		} finally {
			await db.execute(sql`
				DROP TRIGGER IF EXISTS reject_parent_aggregate_test_trigger ON tasks
			`);
			await db.execute(sql`
				DROP FUNCTION IF EXISTS reject_parent_aggregate_test()
			`);
		}
	});

	it("notifies only after a successful decision commit", async () => {
		const { submissionId } = await createTaskSubmission();
		await claimSubmissionForReview(reviewerA, submissionId);
		let statusObservedByNotification: string | undefined;
		vi.mocked(safeNotifySubscribers).mockImplementation(async () => {
			statusObservedByNotification = (await getSubmission(submissionId))
				?.status;
			return 1;
		});
		await decideSubmissionReview(reviewerA, {
			id: submissionId,
			decision: "approve",
		});
		expect(safeNotifySubscribers).toHaveBeenCalledOnce();
		expect(statusObservedByNotification).toBe("approved");
	});

	it.each([
		{ type: "task", order: "A→B" },
		{ type: "task", order: "B→A" },
		{ type: "deliverable", order: "A→B" },
		{ type: "deliverable", order: "B→A" },
	] as const)("approves a $type only after both assignees approve in $order order", async ({
		type,
		order,
	}) => {
		const pair = await createReviewPair(type);
		const first =
			order === "A→B"
				? { actor: reviewerA, id: pair.submissionA }
				: { actor: reviewerB, id: pair.submissionB };
		const second =
			order === "A→B"
				? { actor: reviewerB, id: pair.submissionB }
				: { actor: reviewerA, id: pair.submissionA };
		await decideSubmissionReview(first.actor, {
			id: first.id,
			decision: "approve",
		});
		const afterFirst = await getParent(type, pair.parentId);
		expect(afterFirst?.workflowStatus).toBe("in_review");
		expect(afterFirst?.approvedAt).toBeNull();
		expect(safeNotifySubscribers).toHaveBeenCalledTimes(1);
		expect(
			vi.mocked(safeNotifySubscribers).mock.calls[0]?.[0],
		).toMatchObject({
			title: `Submission approved for ${type === "task" ? "Task" : "Deliverable"}: Aggregate review ${type}`,
			metadata: {
				outcome: "approved",
				parentStatus: "in_review",
				scope: "submission_decision",
			},
		});

		await decideSubmissionReview(second.actor, {
			id: second.id,
			decision: "approve",
		});
		const approved = await getParent(type, pair.parentId);
		expect(approved?.workflowStatus).toBe("approved");
		expect(approved?.approvedAt).toBeInstanceOf(Date);
		expect(safeNotifySubscribers).toHaveBeenCalledTimes(2);
		expect(
			vi
				.mocked(safeNotifySubscribers)
				.mock.calls.every(
					([notification]) => notification.entityType === type,
				),
		).toBe(true);
		expect(
			vi.mocked(safeNotifySubscribers).mock.calls[1]?.[0],
		).toMatchObject({
			title: `${type === "task" ? "Task" : "Deliverable"} approved: Aggregate review ${type}`,
			metadata: {
				outcome: "approved",
				parentStatus: "approved",
				scope: "parent_aggregate",
			},
		});
	});

	it.each([
		"task",
		"deliverable",
	] as const)("keeps a %s unapproved when a sibling is assigned but has not submitted", async (type) => {
		const pair = await createReviewPair(type);
		await db
			.delete(assignmentSubmissions)
			.where(eq(assignmentSubmissions.id, pair.submissionB));
		await decideSubmissionReview(reviewerA, {
			id: pair.submissionA,
			decision: "approve",
		});
		expect(await getParent(type, pair.parentId)).toMatchObject({
			workflowStatus: "submitted",
			approvedAt: null,
		});
		expect(safeNotifySubscribers).toHaveBeenCalledOnce();
		expect(
			vi.mocked(safeNotifySubscribers).mock.calls[0]?.[0],
		).toMatchObject({
			title: `Submission approved for ${type === "task" ? "Task" : "Deliverable"}: Aggregate review ${type}`,
			metadata: {
				parentStatus: "submitted",
				scope: "submission_decision",
			},
		});
	});

	it("serializes concurrent sibling approvals without rejecting either decision", async () => {
		const pair = await createReviewPair("task");
		const results = await Promise.allSettled([
			decideSubmissionReview(reviewerA, {
				id: pair.submissionA,
				decision: "approve",
			}),
			decideSubmissionReview(reviewerB, {
				id: pair.submissionB,
				decision: "approve",
			}),
		]);
		expect(results.every((result) => result.status === "fulfilled")).toBe(
			true,
		);
		expect((await getParent("task", pair.parentId))?.workflowStatus).toBe(
			"approved",
		);
	});

	it("gives revision precedence and converges after resubmission and approval", async () => {
		const pair = await createReviewPair("deliverable");
		await decideSubmissionReview(reviewerA, {
			id: pair.submissionA,
			decision: "approve",
		});
		await decideSubmissionReview(reviewerB, {
			id: pair.submissionB,
			decision: "request_revision",
			reviewNote: "Please revise",
		});
		expect(
			(await getParent("deliverable", pair.parentId))?.workflowStatus,
		).toBe("revision_requested");

		await persistWorkSubmission(crewActor, {
			crew: { id: ids.crewB, name: "Submission Crew B" },
			entity: {
				id: pair.parentId,
				name: "Aggregate review deliverable",
				type: "deliverable",
			},
			submissionNote: "Revised",
		});
		expect(
			(await getParent("deliverable", pair.parentId))?.workflowStatus,
		).toBe("submitted");

		await claimSubmissionForReview(reviewerB, pair.submissionB);
		await decideSubmissionReview(reviewerB, {
			id: pair.submissionB,
			decision: "approve",
		});
		expect(
			(await getParent("deliverable", pair.parentId))?.workflowStatus,
		).toBe("approved");
	});

	it("adding and removing assignments reopens and reapproves atomically", async () => {
		const pair = await createReviewPair("task");
		await decideSubmissionReview(reviewerA, {
			id: pair.submissionA,
			decision: "approve",
		});
		await decideSubmissionReview(reviewerB, {
			id: pair.submissionB,
			decision: "approve",
		});
		const extraCrewId = `${ids.crewB}_extra_${Date.now()}`;
		await db.insert(crews).values({
			id: extraCrewId,
			organizationId: ids.organization,
			name: "Extra Crew",
		});

		await db.transaction(async (tx) => {
			const parent = await lockSubmissionParent(tx, ids.organization, {
				id: pair.parentId,
				type: "task",
			});
			expect(parent).not.toBeNull();
			if (!parent) {
				return;
			}
			await lockParentReviewEvidence(tx, ids.organization, parent);
			await tx.insert(taskAssignments).values({
				taskId: pair.parentId,
				crewId: extraCrewId,
				assignedBy: admin.user.id,
			});
			await recomputeParentReviewAggregate(tx, admin, parent, {
				actionTime: new Date(),
				cause: "assignment_added",
			});
		});
		const reopened = await getParent("task", pair.parentId);
		expect(reopened?.workflowStatus).toBe("submitted");
		expect(reopened?.approvedAt).toBeNull();

		await db.transaction(async (tx) => {
			const parent = await lockSubmissionParent(tx, ids.organization, {
				id: pair.parentId,
				type: "task",
			});
			if (!parent) {
				return;
			}
			await lockParentReviewEvidence(tx, ids.organization, parent);
			await tx
				.delete(taskAssignments)
				.where(
					and(
						eq(taskAssignments.taskId, pair.parentId),
						eq(taskAssignments.crewId, extraCrewId),
					),
				);
			await recomputeParentReviewAggregate(tx, admin, parent, {
				actionTime: new Date(),
				cause: "assignment_removed",
			});
		});
		const reapproved = await getParent("task", pair.parentId);
		expect(reapproved?.workflowStatus).toBe("approved");
		expect(reapproved?.approvedAt).toBeInstanceOf(Date);
	});

	it.each([
		"task",
		"deliverable",
	] as const)("recomputes a %s through its real assign and unassign procedures", async (type) => {
		const pair = await createReviewPair(type);
		await decideSubmissionReview(reviewerA, {
			id: pair.submissionA,
			decision: "approve",
		});
		await decideSubmissionReview(reviewerB, {
			id: pair.submissionB,
			decision: "approve",
		});
		const extraCrewId = `${ids.crewB}_${type}_procedure_${Date.now()}`;
		await db.insert(crews).values({
			id: extraCrewId,
			organizationId: ids.organization,
			name: `Procedure ${type} crew`,
		});
		const context = { ...admin, headers: new Headers() };
		if (type === "task") {
			await (assignCrewToTask as any)["~orpc"].handler({
				context,
				input: { taskId: pair.parentId, crewId: extraCrewId },
			});
		} else {
			await (assignCrewToDeliverable as any)["~orpc"].handler({
				context,
				input: {
					deliverableId: pair.parentId,
					crewId: extraCrewId,
					isLead: false,
				},
			});
		}
		expect(await getParent(type, pair.parentId)).toMatchObject({
			workflowStatus: "submitted",
			approvedAt: null,
		});

		if (type === "task") {
			await (unassignCrewFromTask as any)["~orpc"].handler({
				context,
				input: { taskId: pair.parentId, crewId: extraCrewId },
			});
		} else {
			await (unassignCrewFromDeliverable as any)["~orpc"].handler({
				context,
				input: {
					deliverableId: pair.parentId,
					crewId: extraCrewId,
				},
			});
		}
		expect(await getParent(type, pair.parentId)).toMatchObject({
			workflowStatus: "approved",
			approvedAt: expect.any(Date),
		});
	});

	it("makes unchanged aggregation a no-op and preserves approval time", async () => {
		const pair = await createReviewPair("deliverable");
		await decideSubmissionReview(reviewerA, {
			id: pair.submissionA,
			decision: "approve",
		});
		await decideSubmissionReview(reviewerB, {
			id: pair.submissionB,
			decision: "approve",
		});
		const before = await getParent("deliverable", pair.parentId);
		const activitiesBefore = await db.query.activities.findMany({
			where: and(
				eq(activities.entityId, pair.parentId),
				eq(activities.action, "workflow_changed"),
			),
		});

		const transition = await db.transaction(async (tx) => {
			const parent = await lockSubmissionParent(tx, ids.organization, {
				id: pair.parentId,
				type: "deliverable",
			});
			if (!parent) {
				throw new Error("Missing test deliverable");
			}
			await lockParentReviewEvidence(tx, ids.organization, parent);
			return recomputeParentReviewAggregate(tx, admin, parent, {
				actionTime: new Date(Date.now() + 60_000),
				cause: "test_noop",
			});
		});

		expect(transition.changed).toBe(false);
		expect(
			(await getParent("deliverable", pair.parentId))?.approvedAt,
		).toEqual(before?.approvedAt);
		const activitiesAfter = await db.query.activities.findMany({
			where: and(
				eq(activities.entityId, pair.parentId),
				eq(activities.action, "workflow_changed"),
			),
		});
		expect(activitiesAfter).toHaveLength(activitiesBefore.length);
	});

	it("rolls back ownership when its transaction-consistent audit insert fails", async () => {
		const { submissionId } = await createTaskSubmission();
		await db.execute(
			sql.raw(`
				CREATE OR REPLACE FUNCTION reject_submission_audit_test()
				RETURNS trigger AS $$
				BEGIN
					IF NEW.entity_id = '${submissionId}' THEN
						RAISE EXCEPTION 'forced submission audit failure';
					END IF;
					RETURN NEW;
				END;
				$$ LANGUAGE plpgsql
			`),
		);
		await db.execute(sql`
			CREATE TRIGGER reject_submission_audit_test_trigger
			BEFORE INSERT ON activities
			FOR EACH ROW EXECUTE FUNCTION reject_submission_audit_test()
		`);
		try {
			await expect(
				claimSubmissionForReview(reviewerA, submissionId),
			).rejects.toThrow("Failed query");
			expect((await getSubmission(submissionId))?.status).toBe(
				"submitted",
			);
		} finally {
			await db.execute(sql`
				DROP TRIGGER IF EXISTS reject_submission_audit_test_trigger ON activities
			`);
			await db.execute(sql`
				DROP FUNCTION IF EXISTS reject_submission_audit_test()
			`);
		}
	});

	it("keeps tenant boundaries on the conditional claim", async () => {
		const { submissionId } = await createTaskSubmission();
		await expect(
			claimSubmissionForReview(
				actor(ids.reviewerA, "Reviewer A", ids.otherOrganization),
				submissionId,
			),
		).rejects.toThrow("not found");
		expect((await getSubmission(submissionId))?.status).toBe("submitted");
	});

	it("requires staleness for reasoned admin actions and records override audit", async () => {
		const recent = await createTaskSubmission({
			status: "in_review",
			reviewedBy: reviewerA.user.id,
			reviewClaimedAt: new Date(),
		});
		await expect(
			administrativelyReleaseReview(admin, {
				id: recent.submissionId,
				reason: "Too soon",
			}),
		).rejects.toThrow("not stale yet");

		await db
			.update(assignmentSubmissions)
			.set({
				reviewClaimedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
			})
			.where(eq(assignmentSubmissions.id, recent.submissionId));
		await administrativelyReassignReview(admin, {
			id: recent.submissionId,
			reason: "Original reviewer is unavailable",
			reviewerId: reviewerB.user.id,
		});
		const reassigned = await getSubmission(recent.submissionId);
		expect(reassigned?.reviewedBy).toBe(reviewerB.user.id);
		expect(reassigned?.reviewClaimedAt?.getTime()).toBeGreaterThan(
			Date.now() - 60_000,
		);
		const activity = await db.query.activities.findFirst({
			where: and(
				eq(activities.entityId, recent.submissionId),
				eq(activities.action, "assigned"),
			),
		});
		expect(activity?.metadata).toMatchObject({
			overrideBasis: "stale_claim",
			reason: "Original reviewer is unavailable",
			priorReviewerId: reviewerA.user.id,
			newReviewerId: reviewerB.user.id,
		});
	});

	it("resubmits the same revision record, replaces files, and clears review ownership", async () => {
		const revision = await createTaskSubmission({
			status: "revision_requested",
			reviewedBy: reviewerA.user.id,
			reviewClaimedAt: new Date(Date.now() - 60_000),
		});
		await db.insert(submissionFiles).values({
			submissionId: revision.submissionId,
			fileName: "old.txt",
			fileUrl: "old-key",
		});
		const result = await persistWorkSubmission(crewActor, {
			crew: { id: ids.crew, name: "Submission Crew" },
			entity: {
				id: revision.taskId,
				name: "Submission test task",
				type: "task",
			},
			files: [
				{
					key: "new-key",
					name: "new.txt",
					size: 12,
					type: "text/plain",
				},
			],
			submissionNote: "Updated work",
		});
		expect(result).toMatchObject({
			id: revision.submissionId,
			wasResubmitted: true,
		});
		const submission = await getSubmission(revision.submissionId);
		expect(submission).toMatchObject({
			status: "submitted",
			reviewedBy: null,
			reviewClaimedAt: null,
			reviewedAt: null,
			reviewNote: null,
			submissionNote: "Updated work",
		});
		const files = await db.query.submissionFiles.findMany({
			where: eq(submissionFiles.submissionId, revision.submissionId),
		});
		expect(files.map((file) => file.fileName)).toEqual(["new.txt"]);
	});
});
