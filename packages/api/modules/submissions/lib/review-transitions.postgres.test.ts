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
	safeNotifySubscribers: vi.fn(),
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
let eq: DatabaseModule["eq"];
let members: DatabaseModule["members"];
let organizations: DatabaseModule["organizations"];
let sql: DatabaseModule["sql"];
let submissionFiles: DatabaseModule["submissionFiles"];
let tasks: DatabaseModule["tasks"];
let users: DatabaseModule["users"];
let persistWorkSubmission: typeof import("./persist-work-submission")["persistWorkSubmission"];
let administrativelyReassignReview: ClaimServiceModule["administrativelyReassignReview"];
let administrativelyReleaseReview: ClaimServiceModule["administrativelyReleaseReview"];
let claimSubmissionForReview: ClaimServiceModule["claimSubmissionForReview"];
let releaseSubmissionReview: ClaimServiceModule["releaseSubmissionReview"];
let decideSubmissionReview: typeof import("./review-decision-service")["decideSubmissionReview"];
const suffix = `${process.pid}_${Date.now()}`;
const ids = {
	organization: `submission_org_${suffix}`,
	otherOrganization: `submission_other_org_${suffix}`,
	admin: `submission_admin_${suffix}`,
	reviewerA: `submission_reviewer_a_${suffix}`,
	reviewerB: `submission_reviewer_b_${suffix}`,
	crewUser: `submission_crew_user_${suffix}`,
	crew: `submission_crew_${suffix}`,
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
			eq,
			members,
			organizations,
			sql,
			submissionFiles,
			tasks,
			users,
		} = database);
		({ persistWorkSubmission } = await import("./persist-work-submission"));
		({
			administrativelyReassignReview,
			administrativelyReleaseReview,
			claimSubmissionForReview,
			releaseSubmissionReview,
		} = await import("./review-claim-service"));
		({ decideSubmissionReview } = await import(
			"./review-decision-service"
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
		await db.insert(crews).values({
			id: ids.crew,
			organizationId: ids.organization,
			userId: ids.crewUser,
			name: "Submission Crew",
		});
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
		).toBe("submitted");
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

	it("rolls back the decision and suppresses notification when parent update loses", async () => {
		const { submissionId, taskId } = await createTaskSubmission();
		await claimSubmissionForReview(reviewerA, submissionId);
		await db
			.update(tasks)
			.set({ workflowStatus: "approved" })
			.where(eq(tasks.id, taskId));
		await expect(
			decideSubmissionReview(reviewerA, {
				id: submissionId,
				decision: "reject",
				reviewNote: "Cannot accept",
			}),
		).rejects.toThrow("parent workflow changed");
		expect((await getSubmission(submissionId))?.status).toBe("in_review");
		expect(safeNotifySubscribers).not.toHaveBeenCalled();
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
		expect(result).toEqual({
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
