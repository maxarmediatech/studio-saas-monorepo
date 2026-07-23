import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const originalDatabaseUrl = process.env.DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;
type DatabaseModule = typeof import("@repo/database");
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
let taskAssignments: DatabaseModule["taskAssignments"];
let tasks: DatabaseModule["tasks"];
let users: DatabaseModule["users"];
let queryParentReviewMismatches: typeof import("./parent-review-reconciliation")["queryParentReviewMismatches"];
let repairReviewedParentReviewMismatches: typeof import("./parent-review-reconciliation")["repairReviewedParentReviewMismatches"];

const suffix = `${process.pid}_${Date.now()}`;
const ids = {
	organization: `parent_review_repair_org_${suffix}`,
	otherOrganization: `parent_review_repair_other_org_${suffix}`,
	admin: `parent_review_repair_admin_${suffix}`,
	crewA: `parent_review_repair_crew_a_${suffix}`,
	crewB: `parent_review_repair_crew_b_${suffix}`,
	booking: `parent_review_repair_booking_${suffix}`,
	staleTask: `parent_review_repair_stale_task_${suffix}`,
	approvedDeliverable: `parent_review_repair_deliverable_${suffix}`,
	taskBasedDeliverable: `parent_review_repair_task_based_${suffix}`,
	incompleteTask: `parent_review_repair_incomplete_${suffix}`,
	incompleteApprovedTask: `parent_review_repair_incomplete_approved_${suffix}`,
	missingApprovalTimeTask: `parent_review_repair_missing_time_${suffix}`,
	assignmentRemovalTask: `parent_review_repair_assignment_removal_${suffix}`,
	otherTask: `parent_review_repair_other_task_${suffix}`,
};

describePostgres("parent review reconciliation on PostgreSQL", () => {
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
			taskAssignments,
			tasks,
			users,
		} = database);
		({ queryParentReviewMismatches, repairReviewedParentReviewMismatches } =
			await import("./parent-review-reconciliation"));
		await db.insert(organizations).values([
			{
				id: ids.organization,
				name: "Parent review repair",
				slug: `parent-review-repair-${suffix}`,
			},
			{
				id: ids.otherOrganization,
				name: "Other parent review repair",
				slug: `parent-review-repair-other-${suffix}`,
			},
		]);
		await db.insert(users).values({
			id: ids.admin,
			name: "Repair Admin",
			email: `${ids.admin}@example.test`,
		});
		await db.insert(members).values({
			organizationId: ids.organization,
			userId: ids.admin,
			role: "admin",
		});
		await db.insert(crews).values([
			{
				id: ids.crewA,
				organizationId: ids.organization,
				name: "Repair Crew A",
			},
			{
				id: ids.crewB,
				organizationId: ids.organization,
				name: "Repair Crew B",
			},
		]);
		await db.insert(bookings).values([
			{
				id: ids.booking,
				organizationId: ids.organization,
				referenceNumber: `REPAIR-${suffix}`,
				name: "Repair booking",
				bookingType: "test",
				packageType: "test",
				packageCost: "100.00",
			},
			{
				id: `${ids.booking}_other`,
				organizationId: ids.otherOrganization,
				referenceNumber: `REPAIR-OTHER-${suffix}`,
				name: "Other repair booking",
				bookingType: "test",
				packageType: "test",
				packageCost: "100.00",
			},
		]);
	}, 120_000);

	afterAll(async () => {
		if (!databaseUrl) {
			return;
		}
		await db
			.delete(organizations)
			.where(eq(organizations.id, ids.organization));
		await db
			.delete(organizations)
			.where(eq(organizations.id, ids.otherOrganization));
		await db.delete(users).where(eq(users.id, ids.admin));
		if (originalDatabaseUrl) {
			process.env.DATABASE_URL = originalDatabaseUrl;
		} else {
			delete process.env.DATABASE_URL;
		}
	}, 120_000);

	it("preserves the runtime approval time after an assignment removal", async () => {
		const firstApproval = new Date("2025-04-10T10:00:00.000Z");
		const assignmentRemovalTime = new Date("2025-04-12T09:00:00.000Z");
		await db.insert(tasks).values({
			id: ids.assignmentRemovalTask,
			organizationId: ids.organization,
			bookingId: ids.booking,
			name: "Approved after pending assignee removal",
			workflowStatus: "approved",
			completedAt: assignmentRemovalTime,
		});
		await db.insert(taskAssignments).values({
			taskId: ids.assignmentRemovalTask,
			crewId: ids.crewA,
			assignedBy: ids.admin,
		});
		await db.insert(assignmentSubmissions).values([
			{
				organizationId: ids.organization,
				taskId: ids.assignmentRemovalTask,
				submittedBy: ids.crewA,
				status: "approved",
				submittedAt: firstApproval,
				reviewedAt: firstApproval,
			},
			{
				organizationId: ids.organization,
				taskId: ids.assignmentRemovalTask,
				submittedBy: ids.crewB,
				status: "in_review",
				submittedAt: firstApproval,
			},
		]);

		const report = await queryParentReviewMismatches(ids.organization);
		expect(
			report.mismatches.some(
				(mismatch) => mismatch.parentId === ids.assignmentRemovalTask,
			),
		).toBe(false);
		const repaired = await repairReviewedParentReviewMismatches({
			organizationId: ids.organization,
			reviewedReportHash: report.reportHash,
			reviewedByUserId: ids.admin,
		});
		expect(repaired.applied).toHaveLength(0);
		expect(
			await db.query.tasks.findFirst({
				where: eq(tasks.id, ids.assignmentRemovalTask),
			}),
		).toMatchObject({
			workflowStatus: "approved",
			completedAt: assignmentRemovalTime,
		});
	});

	it("excludes task-based deliverables from direct-evidence reconciliation", async () => {
		const completedAt = new Date("2025-04-13T09:00:00.000Z");
		await db.insert(deliverables).values({
			id: ids.taskBasedDeliverable,
			organizationId: ids.organization,
			bookingId: ids.booking,
			name: "Task-based deliverable",
			trackingMode: "task_based",
			workflowStatus: "ready",
			completedAt,
		});

		const report = await queryParentReviewMismatches(ids.organization);
		expect(
			report.mismatches.some(
				(mismatch) => mismatch.parentId === ids.taskBasedDeliverable,
			),
		).toBe(false);
		const repaired = await repairReviewedParentReviewMismatches({
			organizationId: ids.organization,
			reviewedReportHash: report.reportHash,
			reviewedByUserId: ids.admin,
		});
		expect(repaired.applied).not.toContain(ids.taskBasedDeliverable);
		expect(
			await db.query.deliverables.findFirst({
				where: eq(deliverables.id, ids.taskBasedDeliverable),
			}),
		).toMatchObject({
			trackingMode: "task_based",
			workflowStatus: "ready",
			completedAt,
		});
	});

	it("reports incomplete evidence even when approval state and time exist", async () => {
		const approvalTime = new Date("2025-04-12T09:00:00.000Z");
		await db.insert(tasks).values({
			id: ids.incompleteApprovedTask,
			organizationId: ids.organization,
			bookingId: ids.booking,
			name: "Approved with incomplete timestamp evidence",
			workflowStatus: "approved",
			completedAt: approvalTime,
		});
		await db.insert(taskAssignments).values({
			taskId: ids.incompleteApprovedTask,
			crewId: ids.crewA,
			assignedBy: ids.admin,
		});
		await db.insert(assignmentSubmissions).values({
			organizationId: ids.organization,
			taskId: ids.incompleteApprovedTask,
			submittedBy: ids.crewA,
			status: "approved",
			submittedAt: approvalTime,
			reviewedAt: null,
		});

		const report = await queryParentReviewMismatches(ids.organization);
		const mismatch = report.mismatches.find(
			(candidate) => candidate.parentId === ids.incompleteApprovedTask,
		);
		expect(mismatch).toMatchObject({
			actualStatus: "approved",
			expectedStatus: "approved",
			actualApprovalTime: approvalTime.toISOString(),
			expectedApprovalTime: approvalTime.toISOString(),
			approvalTimeEvidence: "incomplete",
			repairable: false,
			reason: "approval_evidence_incomplete",
		});
		const repaired = await repairReviewedParentReviewMismatches({
			organizationId: ids.organization,
			reviewedReportHash: report.reportHash,
			reviewedByUserId: ids.admin,
		});
		expect(repaired.skipped).toContainEqual({
			parentId: ids.incompleteApprovedTask,
			reason: "approval_evidence_incomplete",
		});
		expect(
			await db.query.tasks.findFirst({
				where: eq(tasks.id, ids.incompleteApprovedTask),
			}),
		).toMatchObject({
			workflowStatus: "approved",
			completedAt: approvalTime,
		});
	});

	it("requires manual review when an approved transition time is missing", async () => {
		const approvalTime = new Date("2025-04-10T10:00:00.000Z");
		await db.insert(tasks).values({
			id: ids.missingApprovalTimeTask,
			organizationId: ids.organization,
			bookingId: ids.booking,
			name: "Approved evidence without transition time",
			workflowStatus: "assigned",
		});
		await db.insert(taskAssignments).values({
			taskId: ids.missingApprovalTimeTask,
			crewId: ids.crewA,
			assignedBy: ids.admin,
		});
		await db.insert(assignmentSubmissions).values({
			organizationId: ids.organization,
			taskId: ids.missingApprovalTimeTask,
			submittedBy: ids.crewA,
			status: "approved",
			submittedAt: approvalTime,
			reviewedAt: approvalTime,
		});

		const report = await queryParentReviewMismatches(ids.organization);
		expect(
			report.mismatches.find(
				(mismatch) => mismatch.parentId === ids.missingApprovalTimeTask,
			),
		).toMatchObject({
			actualStatus: "assigned",
			expectedStatus: "approved",
			expectedApprovalTime: null,
			approvalTimeEvidence: "complete",
			repairable: false,
			reason: "workflow_status_mismatch,approval_timestamp_missing",
		});
		const repaired = await repairReviewedParentReviewMismatches({
			organizationId: ids.organization,
			reviewedReportHash: report.reportHash,
			reviewedByUserId: ids.admin,
		});
		expect(repaired.skipped).toContainEqual({
			parentId: ids.missingApprovalTimeTask,
			reason: "approval_transition_time_unavailable",
		});
		expect(
			await db.query.tasks.findFirst({
				where: eq(tasks.id, ids.missingApprovalTimeTask),
			}),
		).toMatchObject({ workflowStatus: "assigned", completedAt: null });
	});

	it("repairs safe mismatches while preserving unreconstructable approval history", async () => {
		const firstApproval = new Date("2025-04-10T10:00:00.000Z");
		const finalApproval = new Date("2025-04-11T12:30:00.000Z");
		const staleApproval = new Date("2025-04-01T00:00:00.000Z");
		await db.insert(tasks).values([
			{
				id: ids.staleTask,
				organizationId: ids.organization,
				bookingId: ids.booking,
				name: "Incorrectly approved task",
				workflowStatus: "approved",
				completedAt: staleApproval,
			},
			{
				id: ids.incompleteTask,
				organizationId: ids.organization,
				bookingId: ids.booking,
				name: "Incomplete approval evidence",
				workflowStatus: "assigned",
			},
			{
				id: ids.otherTask,
				organizationId: ids.otherOrganization,
				bookingId: `${ids.booking}_other`,
				name: "Other tenant stale task",
				workflowStatus: "approved",
				completedAt: staleApproval,
			},
		]);
		await db.insert(deliverables).values({
			id: ids.approvedDeliverable,
			organizationId: ids.organization,
			bookingId: ids.booking,
			name: "Historically approved deliverable",
			workflowStatus: "approved",
			completedAt: staleApproval,
		});
		await db.insert(taskAssignments).values([
			{
				taskId: ids.staleTask,
				crewId: ids.crewA,
				assignedBy: ids.admin,
			},
			{
				taskId: ids.staleTask,
				crewId: ids.crewB,
				assignedBy: ids.admin,
			},
			{
				taskId: ids.incompleteTask,
				crewId: ids.crewA,
				assignedBy: ids.admin,
			},
		]);
		await db.insert(deliverableAssignments).values([
			{
				deliverableId: ids.approvedDeliverable,
				crewId: ids.crewA,
				assignedBy: ids.admin,
			},
			{
				deliverableId: ids.approvedDeliverable,
				crewId: ids.crewB,
				assignedBy: ids.admin,
			},
		]);
		await db.insert(assignmentSubmissions).values([
			{
				organizationId: ids.organization,
				taskId: ids.staleTask,
				submittedBy: ids.crewA,
				status: "approved",
				submittedAt: firstApproval,
				reviewedAt: firstApproval,
			},
			{
				organizationId: ids.organization,
				taskId: ids.staleTask,
				submittedBy: ids.crewB,
				status: "in_review",
				submittedAt: finalApproval,
			},
			{
				organizationId: ids.organization,
				deliverableId: ids.approvedDeliverable,
				submittedBy: ids.crewA,
				status: "approved",
				submittedAt: firstApproval,
				reviewedAt: firstApproval,
			},
			{
				organizationId: ids.organization,
				deliverableId: ids.approvedDeliverable,
				submittedBy: ids.crewB,
				status: "approved",
				submittedAt: finalApproval,
				reviewedAt: finalApproval,
			},
			{
				organizationId: ids.organization,
				taskId: ids.incompleteTask,
				submittedBy: ids.crewA,
				status: "approved",
				submittedAt: finalApproval,
				reviewedAt: null,
			},
		]);

		const report = await queryParentReviewMismatches(ids.organization);
		expect(report.organizationId).toBe(ids.organization);
		expect(report.reportHash).toMatch(/^[a-f0-9]{64}$/);
		expect(
			report.mismatches.some(
				(mismatch) => mismatch.parentId === ids.otherTask,
			),
		).toBe(false);
		expect(
			report.mismatches.find(
				(mismatch) => mismatch.parentId === ids.staleTask,
			),
		).toMatchObject({
			actualStatus: "approved",
			expectedStatus: "in_review",
			repairable: true,
		});
		expect(
			report.mismatches.find(
				(mismatch) => mismatch.parentId === ids.approvedDeliverable,
			),
		).toMatchObject({
			actualStatus: "approved",
			expectedStatus: "approved",
			actualApprovalTime: staleApproval.toISOString(),
			expectedApprovalTime: finalApproval.toISOString(),
			approvalTimeEvidence: "complete",
			repairable: false,
			reason: "approval_timestamp_precedes_evidence",
		});
		expect(
			report.mismatches.find(
				(mismatch) => mismatch.parentId === ids.incompleteTask,
			),
		).toMatchObject({
			expectedStatus: "approved",
			expectedApprovalTime: null,
			approvalTimeEvidence: "incomplete",
			repairable: false,
		});

		await expect(
			repairReviewedParentReviewMismatches({
				organizationId: ids.organization,
				reviewedReportHash: "0".repeat(64),
				reviewedByUserId: ids.admin,
			}),
		).rejects.toThrow("does not match");
		const repaired = await repairReviewedParentReviewMismatches({
			organizationId: ids.organization,
			reviewedReportHash: report.reportHash,
			reviewedByUserId: ids.admin,
		});
		expect(repaired.applied).toEqual(
			expect.arrayContaining([ids.staleTask]),
		);
		expect(repaired.applied).not.toContain(ids.approvedDeliverable);
		expect(repaired.skipped).toContainEqual({
			parentId: ids.incompleteTask,
			reason: "approval_evidence_incomplete",
		});
		expect(repaired.skipped).toContainEqual({
			parentId: ids.approvedDeliverable,
			reason: "approval_timestamp_precedes_evidence",
		});
		expect(
			await db.query.tasks.findFirst({
				where: eq(tasks.id, ids.staleTask),
			}),
		).toMatchObject({ workflowStatus: "in_review", completedAt: null });
		expect(
			await db.query.deliverables.findFirst({
				where: eq(deliverables.id, ids.approvedDeliverable),
			}),
		).toMatchObject({
			workflowStatus: "approved",
			completedAt: staleApproval,
		});
		expect(
			await db.query.tasks.findFirst({
				where: eq(tasks.id, ids.incompleteTask),
			}),
		).toMatchObject({ workflowStatus: "assigned", completedAt: null });
		expect(
			await db.query.activities.findMany({
				where: and(
					eq(activities.organizationId, ids.organization),
					eq(activities.entityId, ids.staleTask),
				),
			}),
		).toEqual([
			expect.objectContaining({
				actorId: ids.admin,
				newValue: "in_review",
				metadata: expect.objectContaining({
					transition: "reviewed_submission_aggregate_repair",
					approvalTime: null,
				}),
			}),
		]);
		expect(
			await db.query.activities.findMany({
				where: and(
					eq(activities.organizationId, ids.organization),
					eq(activities.entityId, ids.approvedDeliverable),
				),
			}),
		).toEqual([]);

		const second = await repairReviewedParentReviewMismatches({
			organizationId: ids.organization,
			reviewedReportHash: repaired.after.reportHash,
			reviewedByUserId: ids.admin,
		});
		expect(second.applied).toHaveLength(0);
		expect(second.skipped).toContainEqual({
			parentId: ids.incompleteTask,
			reason: "approval_evidence_incomplete",
		});
		expect(second.skipped).toContainEqual({
			parentId: ids.approvedDeliverable,
			reason: "approval_timestamp_precedes_evidence",
		});
	});
});
