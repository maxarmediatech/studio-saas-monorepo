import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

interface ProcedureOptions {
	context: {
		headers: Headers;
		organizationId: string;
		user: { id: string; email: string; name: string };
	};
	input: Record<string, unknown>;
}

type ProcedureHandler = (options: ProcedureOptions) => Promise<unknown>;

const mocks = vi.hoisted(() => {
	const handlers = new Map<string, ProcedureHandler>();
	let currentRoute = "";
	const chain = {
		route: vi.fn((route: { method: string; path: string }) => {
			currentRoute = `${route.method}:${route.path}`;
			return chain;
		}),
		input: vi.fn(() => chain),
		output: vi.fn(() => chain),
		handler: vi.fn((handler: ProcedureHandler) => {
			handlers.set(currentRoute, handler);
			return chain;
		}),
	};

	return {
		chain,
		getHandler(method: string, path: string) {
			const route = `${method}:${path}`;
			const handler = handlers.get(route);
			if (!handler) {
				throw new Error(`Handler not registered: ${route}`);
			}
			return handler;
		},
		hasPermission: vi.fn(),
		requirePermission: vi.fn(),
		safeAutoSubscribe: vi.fn(),
		safeTrackActivity: vi.fn(),
		createActivityWithExecutor: vi.fn(),
	};
});

vi.mock("../../../orpc/procedures", () => ({
	studioProtectedProcedure: mocks.chain,
}));

vi.mock("../../studio/lib/permissions", () => ({
	hasPermission: mocks.hasPermission,
	requirePermission: mocks.requirePermission,
}));

vi.mock("../../activities/lib", () => ({
	createActivityWithExecutor: mocks.createActivityWithExecutor,
	safeTrackActivity: mocks.safeTrackActivity,
}));

vi.mock("../../notifications/lib/notification-service", () => ({
	safeAutoSubscribe: mocks.safeAutoSubscribe,
}));

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;
const originalDatabaseUrl = process.env.DATABASE_URL;
const describePostgres = databaseUrl ? describe.sequential : describe.skip;

const ids = {
	organization: crypto.randomUUID(),
	user: crypto.randomUUID(),
	booking: crypto.randomUUID(),
	task: crypto.randomUUID(),
	deliverable: crypto.randomUUID(),
	legacyTask: crypto.randomUUID(),
	legacyDeliverable: crypto.randomUUID(),
	staleTask: crypto.randomUUID(),
	staleDeliverable: crypto.randomUUID(),
	unsafeStaleTask: crypto.randomUUID(),
	unsafeStaleDeliverable: crypto.randomUUID(),
	requiredTask: crypto.randomUUID(),
	requiredDeliverable: crypto.randomUUID(),
	linkTask: crypto.randomUUID(),
	linkDeliverable: crypto.randomUUID(),
	convertDeliverable: crypto.randomUUID(),
};
const legacyLinkId = `legacy_${crypto.randomUUID().replaceAll("-", "")}`;

const context = {
	headers: new Headers(),
	organizationId: ids.organization,
	user: {
		id: ids.user,
		email: `task-link-${ids.user}@example.com`,
		name: "Task link test actor",
	},
};

let database: typeof import("@repo/database");
let getTask: ProcedureHandler;
let listTasks: ProcedureHandler;
let getDeliverable: ProcedureHandler;
let listDeliverables: ProcedureHandler;
let linkTask: ProcedureHandler;
let unlinkTask: ProcedureHandler;
let convertToTask: ProcedureHandler;

function asData(result: unknown): Record<string, unknown> {
	return (result as { data: Record<string, unknown> }).data;
}

describePostgres("task-deliverable relationship boundaries", () => {
	beforeAll(async () => {
		process.env.DATABASE_URL = databaseUrl;
		database = await import("@repo/database");
		await import("../../tasks/procedures/get-task");
		await import("../../tasks/procedures/list-tasks");
		await import("./get-deliverable");
		await import("./list-deliverables");
		await import("./link-task");
		await import("./unlink-task");
		await import("./convert-to-task");

		getTask = mocks.getHandler("GET", "/tasks/{id}");
		listTasks = mocks.getHandler("GET", "/tasks");
		getDeliverable = mocks.getHandler("GET", "/deliverables/{id}");
		listDeliverables = mocks.getHandler("GET", "/deliverables");
		linkTask = mocks.getHandler(
			"PUT",
			"/deliverables/{deliverableId}/tasks/{taskId}",
		);
		unlinkTask = mocks.getHandler(
			"DELETE",
			"/deliverables/{deliverableId}/tasks/{taskId}",
		);
		convertToTask = mocks.getHandler(
			"POST",
			"/deliverables/{deliverableId}/convert-to-task",
		);

		const {
			bookings,
			db,
			deliverables,
			deliverableTaskLinks,
			organizations,
			tasks,
			users,
		} = database;
		await db.insert(users).values({
			id: ids.user,
			name: "Task link test actor",
			email: `task-link-${ids.user}@example.com`,
		});
		await db.insert(organizations).values({
			id: ids.organization,
			name: "Task link boundary tests",
			slug: `task-link-${ids.organization}`,
		});
		await db.insert(bookings).values({
			id: ids.booking,
			organizationId: ids.organization,
			referenceNumber: `TL-${ids.booking}`,
			name: "Task link booking",
			bookingType: "test",
			packageType: "test",
			packageCost: "100.00",
		});
		await db.insert(tasks).values([
			{
				id: ids.task,
				organizationId: ids.organization,
				bookingId: ids.booking,
				name: "Visible task",
				metadata: {
					convertedFromDeliverableId: ids.deliverable,
					convertedFromDeliverableName: "Sensitive deliverable",
					safeTaskKey: "preserved",
				},
			},
			{
				id: ids.legacyTask,
				organizationId: ids.organization,
				bookingId: ids.booking,
				name: "Legacy converted task",
			},
			{
				id: ids.staleTask,
				organizationId: ids.organization,
				bookingId: ids.booking,
				name: "Deleted legacy converted task",
				status: "completed",
				metadata: {
					convertedFromDeliverableId: ids.staleDeliverable,
					convertedFromDeliverableName: "Stale converted deliverable",
				},
				deletedAt: new Date("2026-07-01T00:00:00.000Z"),
			},
			{
				id: ids.unsafeStaleTask,
				organizationId: ids.organization,
				bookingId: ids.booking,
				name: "Unsafe deleted converted task",
				workflowStatus: "in_progress",
				metadata: {
					convertedFromDeliverableId: ids.unsafeStaleDeliverable,
				},
				deletedAt: new Date("2026-07-02T00:00:00.000Z"),
			},
			{
				id: ids.requiredTask,
				organizationId: ids.organization,
				bookingId: ids.booking,
				name: "Production task",
			},
			{
				id: ids.linkTask,
				organizationId: ids.organization,
				bookingId: ids.booking,
				name: "Informational task",
			},
		]);
		await db.insert(deliverables).values([
			{
				id: ids.deliverable,
				organizationId: ids.organization,
				bookingId: ids.booking,
				name: "Sensitive deliverable",
				metadata: {
					convertedToTaskId: ids.task,
					safeDeliverableKey: "preserved",
				},
			},
			{
				id: ids.legacyDeliverable,
				organizationId: ids.organization,
				bookingId: ids.booking,
				name: "Legacy converted deliverable",
				metadata: { convertedToTaskId: ids.legacyTask },
			},
			{
				id: ids.staleDeliverable,
				organizationId: ids.organization,
				bookingId: ids.booking,
				name: "Stale converted deliverable",
				status: "completed",
				metadata: {
					convertedToTaskId: ids.staleTask,
					convertedAt: "2026-06-01T00:00:00.000Z",
					preservedKey: "preserved",
				},
			},
			{
				id: ids.unsafeStaleDeliverable,
				organizationId: ids.organization,
				bookingId: ids.booking,
				name: "Unsafe stale converted deliverable",
				metadata: {
					convertedToTaskId: ids.unsafeStaleTask,
					convertedAt: "2026-06-02T00:00:00.000Z",
				},
			},
			{
				id: ids.requiredDeliverable,
				organizationId: ids.organization,
				bookingId: ids.booking,
				name: "Converted deliverable",
				trackingMode: "task_based",
				metadata: { convertedToTaskId: ids.requiredTask },
			},
			{
				id: ids.linkDeliverable,
				organizationId: ids.organization,
				bookingId: ids.booking,
				name: "Linkable deliverable",
			},
			{
				id: ids.convertDeliverable,
				organizationId: ids.organization,
				bookingId: ids.booking,
				name: "Convert and roll up",
			},
		]);
		await db.insert(deliverableTaskLinks).values([
			{
				id: legacyLinkId,
				organizationId: ids.organization,
				bookingId: ids.booking,
				deliverableId: ids.deliverable,
				taskId: ids.task,
				kind: "reference",
			},
			{
				organizationId: ids.organization,
				bookingId: ids.booking,
				deliverableId: ids.legacyDeliverable,
				taskId: ids.legacyTask,
				kind: "reference",
			},
			{
				organizationId: ids.organization,
				bookingId: ids.booking,
				deliverableId: ids.staleDeliverable,
				taskId: ids.staleTask,
				kind: "reference",
			},
			{
				organizationId: ids.organization,
				bookingId: ids.booking,
				deliverableId: ids.unsafeStaleDeliverable,
				taskId: ids.unsafeStaleTask,
				kind: "reference",
			},
			{
				organizationId: ids.organization,
				bookingId: ids.booking,
				deliverableId: ids.requiredDeliverable,
				taskId: ids.requiredTask,
				kind: "required",
			},
		]);
	});

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.hasPermission.mockResolvedValue(true);
	});

	afterAll(async () => {
		if (!database) {
			return;
		}
		const { db, eq, organizations, users } = database;
		await db
			.delete(organizations)
			.where(eq(organizations.id, ids.organization));
		await db.delete(users).where(eq(users.id, ids.user));
		if (originalDatabaseUrl) {
			process.env.DATABASE_URL = originalDatabaseUrl;
		} else {
			delete process.env.DATABASE_URL;
		}
	});

	it("repairs legacy link IDs to satisfy the public UUID contract", async () => {
		const migrationPath = fileURLToPath(
			new URL(
				"../../../../database/drizzle/migrations/0048_repair_deliverable_task_link_ids.sql",
				import.meta.url,
			),
		);
		const migrationSql = await readFile(migrationPath, "utf8");
		await database.db.execute(database.sql.raw(migrationSql));

		const repaired = await database.db.query.deliverableTaskLinks.findFirst(
			{
				where: database.and(
					database.eq(
						database.deliverableTaskLinks.deliverableId,
						ids.deliverable,
					),
					database.eq(database.deliverableTaskLinks.taskId, ids.task),
				),
				columns: { id: true },
			},
		);
		const { idSchema } = await import("../../studio/schemas/common");
		expect(repaired?.id).not.toBe(legacyLinkId);
		expect(idSchema.safeParse(repaired?.id).success).toBe(true);
	});

	it("repairs only the safe stale conversion while preserving business state", async () => {
		const migrationPath = fileURLToPath(
			new URL(
				"../../../../database/drizzle/migrations/0049_repair_stale_deliverable_task_links.sql",
				import.meta.url,
			),
		);
		const migrationSql = await readFile(migrationPath, "utf8");
		await database.db.execute(database.sql.raw(migrationSql));

		const [link, deliverable, task, unsafeLink, unsafeDeliverable] =
			await Promise.all([
				database.db.query.deliverableTaskLinks.findFirst({
					where: database.and(
						database.eq(
							database.deliverableTaskLinks.deliverableId,
							ids.staleDeliverable,
						),
						database.eq(
							database.deliverableTaskLinks.taskId,
							ids.staleTask,
						),
					),
				}),
				database.db.query.deliverables.findFirst({
					where: database.eq(
						database.deliverables.id,
						ids.staleDeliverable,
					),
				}),
				database.db.query.tasks.findFirst({
					where: database.eq(database.tasks.id, ids.staleTask),
				}),
				database.db.query.deliverableTaskLinks.findFirst({
					where: database.and(
						database.eq(
							database.deliverableTaskLinks.deliverableId,
							ids.unsafeStaleDeliverable,
						),
						database.eq(
							database.deliverableTaskLinks.taskId,
							ids.unsafeStaleTask,
						),
					),
				}),
				database.db.query.deliverables.findFirst({
					where: database.eq(
						database.deliverables.id,
						ids.unsafeStaleDeliverable,
					),
				}),
			]);

		expect(link).toBeUndefined();
		expect(deliverable).toMatchObject({
			status: "completed",
			workflowStatus: "not_started",
			trackingMode: "direct",
			metadata: { preservedKey: "preserved" },
		});
		expect(task).toMatchObject({
			status: "completed",
			workflowStatus: "not_started",
			metadata: {
				convertedFromDeliverableId: ids.staleDeliverable,
				convertedFromDeliverableName: "Stale converted deliverable",
			},
		});
		expect(task?.deletedAt).toEqual(new Date("2026-07-01T00:00:00.000Z"));
		expect(unsafeLink).toBeDefined();
		expect(unsafeDeliverable?.metadata).toEqual({
			convertedToTaskId: ids.unsafeStaleTask,
			convertedAt: "2026-06-02T00:00:00.000Z",
		});
	});

	it("redacts nested relationship data without target-resource read access", async () => {
		mocks.hasPermission.mockResolvedValue(false);

		const task = asData(
			await getTask({ context, input: { id: ids.task } }),
		);
		expect(task.deliverableLinks).toEqual([]);
		expect(task.metadata).toEqual({ safeTaskKey: "preserved" });
		expect(mocks.hasPermission).toHaveBeenCalledWith(
			context,
			"deliverable",
			"read",
		);

		const deliverable = asData(
			await getDeliverable({
				context,
				input: { id: ids.deliverable },
			}),
		);
		expect(deliverable.taskLinks).toEqual([]);
		expect(deliverable.metadata).toEqual({
			safeDeliverableKey: "preserved",
		});
		expect(mocks.hasPermission).toHaveBeenCalledWith(
			context,
			"task",
			"read",
		);
	});

	it("returns nested relationships when target-resource access is allowed", async () => {
		const task = asData(
			await getTask({ context, input: { id: ids.task } }),
		);
		expect(task.deliverableLinks).toHaveLength(1);

		const deliverable = asData(
			await getDeliverable({
				context,
				input: { id: ids.deliverable },
			}),
		);
		expect(deliverable.taskLinks).toHaveLength(1);
	});

	it("restores legacy conversion context from a 0047 reference link", async () => {
		const task = asData(
			await getTask({ context, input: { id: ids.legacyTask } }),
		);
		expect(task.metadata).toMatchObject({
			convertedFromDeliverableId: ids.legacyDeliverable,
			convertedFromDeliverableName: "Legacy converted deliverable",
		});
	});

	it("redacts conversion identities from list endpoints", async () => {
		mocks.hasPermission.mockResolvedValue(false);
		const taskResult = (await listTasks({
			context,
			input: {
				page: 1,
				limit: 100,
				sortBy: "dueDate",
				sortDirection: "asc",
				includeDeleted: false,
			},
		})) as { data: Array<{ id: string; metadata: unknown }> };
		expect(
			taskResult.data.find((task) => task.id === ids.task)?.metadata,
		).toEqual({ safeTaskKey: "preserved" });

		const deliverableResult = (await listDeliverables({
			context,
			input: {
				page: 1,
				limit: 100,
				sortBy: "dueDate",
				sortDirection: "asc",
				includeDeleted: false,
			},
		})) as { data: Array<{ id: string; metadata: unknown }> };
		expect(
			deliverableResult.data.find(
				(deliverable) => deliverable.id === ids.deliverable,
			)?.metadata,
		).toEqual({ safeDeliverableKey: "preserved" });
	});

	it("requires both resource permissions for ordinary link and unlink", async () => {
		mocks.requirePermission.mockImplementation(
			(_context, resource: string) => {
				if (resource === "task") {
					throw new Error("task read denied");
				}
			},
		);
		await expect(
			linkTask({
				context,
				input: {
					deliverableId: ids.linkDeliverable,
					taskId: ids.linkTask,
				},
			}),
		).rejects.toThrow("task read denied");
		const deniedLink =
			await database.db.query.deliverableTaskLinks.findFirst({
				where: database.and(
					database.eq(
						database.deliverableTaskLinks.deliverableId,
						ids.linkDeliverable,
					),
					database.eq(
						database.deliverableTaskLinks.taskId,
						ids.linkTask,
					),
				),
			});
		expect(deniedLink).toBeUndefined();

		mocks.requirePermission.mockReset();
		await linkTask({
			context,
			input: {
				deliverableId: ids.linkDeliverable,
				taskId: ids.linkTask,
			},
		});
		expect(mocks.requirePermission).toHaveBeenNthCalledWith(
			1,
			context,
			"deliverable",
			"update",
		);
		expect(mocks.requirePermission).toHaveBeenNthCalledWith(
			2,
			context,
			"task",
			"read",
		);

		mocks.requirePermission.mockClear();
		await unlinkTask({
			context,
			input: {
				deliverableId: ids.linkDeliverable,
				taskId: ids.linkTask,
			},
		});
		expect(mocks.requirePermission).toHaveBeenNthCalledWith(
			1,
			context,
			"deliverable",
			"update",
		);
		expect(mocks.requirePermission).toHaveBeenNthCalledWith(
			2,
			context,
			"task",
			"read",
		);
	});

	it("rejects generic unlinking of required production tasks", async () => {
		await expect(
			unlinkTask({
				context,
				input: {
					deliverableId: ids.requiredDeliverable,
					taskId: ids.requiredTask,
				},
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });

		const link = await database.db.query.deliverableTaskLinks.findFirst({
			where: database.and(
				database.eq(
					database.deliverableTaskLinks.deliverableId,
					ids.requiredDeliverable,
				),
				database.eq(
					database.deliverableTaskLinks.taskId,
					ids.requiredTask,
				),
			),
			columns: { id: true, kind: true },
		});
		expect(link?.kind).toBe("required");
	});

	it("converts a deliverable and rolls approved production work to ready", async () => {
		const converted = asData(
			await convertToTask({
				context,
				input: { deliverableId: ids.convertDeliverable },
			}),
		);
		const taskId = converted.taskId as string;

		await database.db
			.update(database.tasks)
			.set({ workflowStatus: "approved" })
			.where(database.eq(database.tasks.id, taskId));
		const { recomputeTaskBasedDeliverable } = await import(
			"../lib/task-rollup"
		);
		await database.db.transaction((tx) =>
			recomputeTaskBasedDeliverable(
				tx,
				context,
				ids.convertDeliverable,
				new Date(),
			),
		);

		const deliverable = await database.db.query.deliverables.findFirst({
			where: database.eq(
				database.deliverables.id,
				ids.convertDeliverable,
			),
			columns: {
				trackingMode: true,
				workflowStatus: true,
				completedAt: true,
			},
		});
		expect(deliverable).toMatchObject({
			trackingMode: "task_based",
			workflowStatus: "ready",
		});
		expect(deliverable?.completedAt).toBeInstanceOf(Date);
	});
});
