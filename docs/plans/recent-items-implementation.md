# Recent Items Implementation Plan

## Overview

Implement a "Recent Items" feature that tracks user visits to entities (bookings, shoots, tasks, deliverables) and displays them on the Home page.

**Status**: Ready for implementation  
**Effort**: 1-2 days  
**Reviewed by**: Oracle (validated)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js 16)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  BookingDetailPageClient ──┐                                             │
│  ShootDetailPageClient ────┼── useEffect + useMutation ── trackVisit()  │
│  TaskDetailPageClient ─────┤                                             │
│  DeliverableDetailClient ──┘                                             │
│                                                                          │
│  HomePage ── RecentVisitsWidget ── useQuery ── listRecentVisits()       │
└─────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (oRPC + Drizzle)                       │
├─────────────────────────────────────────────────────────────────────────┤
│  POST /api/recent-visits/track                                          │
│    1. Validate entity exists + belongs to org                           │
│    2. Atomic upsert + prune (CTE)                                       │
│                                                                          │
│  GET /api/recent-visits                                                 │
│    1. Permission gating per entity type                                 │
│    2. Fetch visits (overfetch 2x)                                       │
│    3. Batch hydrate entities                                            │
│    4. Filter deleted, return up to limit                                │
└─────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATABASE (PostgreSQL)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  recent_visits                                                          │
│    - id, organization_id, user_id                                       │
│    - entity_type, entity_id                                             │
│    - visited_at, created_at                                             │
│    - UNIQUE(org_id, user_id, entity_type, entity_id)                   │
│    - INDEX(org_id, user_id, visited_at DESC)                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tracking location | UI (on mount) | Avoids tracking prefetches, keeps reads fast |
| Prune strategy | Atomic CTE | Concurrency-safe, single round trip |
| Hydration | Two-query pattern | Matches codebase patterns, efficient batch fetch |
| Limit | 20 per user/org | Matches Plane's implementation |
| Permissions | Gate per entity type | Prevents leaking names to unauthorized roles |

---

## Phase 1: Database Schema

### File: `packages/database/drizzle/schema/studio.ts`

Add after the existing tables (before relations section):

```typescript
// ============================================================================
// RECENT VISITS TABLE
// Tracks user's recently visited entities for quick access
// ============================================================================

export const recentVisits = pgTable(
	"recent_visits",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		entityType: varchar("entity_type", { length: 50 }).notNull(),
		entityId: varchar("entity_id", { length: 255 }).notNull(),

		visitedAt: timestamp("visited_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		// Unique constraint for upsert
		uniqueIndex("recent_visits_user_org_entity_idx").on(
			table.organizationId,
			table.userId,
			table.entityType,
			table.entityId,
		),
		// Query index for listing recents
		index("recent_visits_user_org_visited_idx").on(
			table.organizationId,
			table.userId,
			table.visitedAt,
		),
	],
);

// Add relations
export const recentVisitsRelations = relations(recentVisits, ({ one }) => ({
	organization: one(organizations, {
		fields: [recentVisits.organizationId],
		references: [organizations.id],
	}),
	user: one(users, {
		fields: [recentVisits.userId],
		references: [users.id],
	}),
}));
```

### File: `packages/database/drizzle/schema/index.ts`

Add export:

```typescript
export * from "./studio"; // Already exists, includes recentVisits
```

### Migration

```bash
pnpm db:generate
pnpm db:migrate
```

---

## Phase 2: API Module

### Directory Structure

```
packages/api/modules/recent-visits/
├── router.ts
├── schemas.ts
├── procedures/
│   ├── track-visit.ts
│   └── list-recent-visits.ts
└── lib/
    └── verify-entity.ts
```

### File: `packages/api/modules/recent-visits/schemas.ts`

```typescript
import { z } from "zod";

export const entityTypeSchema = z.enum([
	"booking",
	"shoot",
	"task",
	"deliverable",
]);

export const entityTypeFilterSchema = z.enum([
	"booking",
	"shoot",
	"task",
	"deliverable",
	"all",
]);

export const trackVisitInputSchema = z.object({
	entityType: entityTypeSchema,
	entityId: z.string().min(1),
});

export const trackVisitOutputSchema = z.object({
	success: z.boolean(),
});

export const listRecentVisitsInputSchema = z.object({
	entityType: entityTypeFilterSchema.optional().default("all"),
	limit: z.number().min(1).max(20).optional().default(10),
});

export const recentVisitItemSchema = z.object({
	id: z.string(),
	entityType: z.string(),
	entityId: z.string(),
	visitedAt: z.string(),
	entityData: z
		.object({
			id: z.string(),
			name: z.string(),
			status: z.string().optional(),
			referenceNumber: z.string().optional(),
			bookingId: z.string().optional(),
		})
		.nullable(),
});

export const listRecentVisitsOutputSchema = z.object({
	data: z.array(recentVisitItemSchema),
});

export type EntityType = z.infer<typeof entityTypeSchema>;
export type RecentVisitItem = z.infer<typeof recentVisitItemSchema>;
```

### File: `packages/api/modules/recent-visits/lib/verify-entity.ts`

```typescript
import {
	bookings,
	db,
	deliverables,
	eq,
	and,
	isNull,
	shoots,
	tasks,
} from "@repo/database";
import type { EntityType } from "../schemas";

export async function verifyEntityExists(
	entityType: EntityType,
	entityId: string,
	organizationId: string,
): Promise<boolean> {
	const tables = {
		booking: bookings,
		shoot: shoots,
		task: tasks,
		deliverable: deliverables,
	};

	const table = tables[entityType];
	if (!table) return false;

	const result = await db
		.select({ id: table.id })
		.from(table)
		.where(
			and(
				eq(table.id, entityId),
				eq(table.organizationId, organizationId),
				isNull(table.deletedAt),
			),
		)
		.limit(1);

	return result.length > 0;
}
```

### File: `packages/api/modules/recent-visits/procedures/track-visit.ts`

```typescript
import { db, sql } from "@repo/database";
import { v7 as uuidv7 } from "uuid";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { verifyEntityExists } from "../lib/verify-entity";
import { trackVisitInputSchema, trackVisitOutputSchema } from "../schemas";

export const trackVisit = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/recent-visits/track",
		tags: ["Recent Visits"],
		summary: "Track entity visit",
		description: "Record that a user visited an entity for recent items list",
	})
	.input(trackVisitInputSchema)
	.output(trackVisitOutputSchema)
	.handler(async ({ input, context }) => {
		const { entityType, entityId } = input;
		const { organizationId, userId } = context;

		// Verify entity exists and belongs to this organization
		const exists = await verifyEntityExists(
			entityType,
			entityId,
			organizationId,
		);

		if (!exists) {
			// Silently succeed - entity may have been deleted
			return { success: true };
		}

		const newId = uuidv7();

		// Atomic upsert + prune using CTE
		await db.execute(sql`
			WITH upserted AS (
				INSERT INTO recent_visits (id, organization_id, user_id, entity_type, entity_id, visited_at, created_at)
				VALUES (${newId}, ${organizationId}, ${userId}, ${entityType}, ${entityId}, NOW(), NOW())
				ON CONFLICT (organization_id, user_id, entity_type, entity_id)
				DO UPDATE SET visited_at = NOW()
				RETURNING id
			),
			ranked AS (
				SELECT id, ROW_NUMBER() OVER (
					PARTITION BY organization_id, user_id 
					ORDER BY visited_at DESC, id DESC
				) AS rn
				FROM recent_visits
				WHERE organization_id = ${organizationId} AND user_id = ${userId}
			)
			DELETE FROM recent_visits
			WHERE id IN (SELECT id FROM ranked WHERE rn > 20)
		`);

		return { success: true };
	});
```

### File: `packages/api/modules/recent-visits/procedures/list-recent-visits.ts`

```typescript
import {
	and,
	bookings,
	db,
	deliverables,
	desc,
	eq,
	inArray,
	isNull,
	recentVisits,
	shoots,
	tasks,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	listRecentVisitsInputSchema,
	listRecentVisitsOutputSchema,
	type RecentVisitItem,
} from "../schemas";

export const listRecentVisits = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/recent-visits",
		tags: ["Recent Visits"],
		summary: "List recent visits",
		description: "Get user's recently visited entities with hydrated data",
	})
	.input(listRecentVisitsInputSchema)
	.output(listRecentVisitsOutputSchema)
	.handler(async ({ input, context }) => {
		const { entityType, limit } = input;
		const { organizationId, userId } = context;

		// Determine allowed entity types based on permissions
		const allowedTypes: string[] = [];

		try {
			requirePermission(context, "booking", "read");
			allowedTypes.push("booking");
		} catch {}

		try {
			requirePermission(context, "shoot", "read");
			allowedTypes.push("shoot");
		} catch {}

		try {
			requirePermission(context, "task", "read");
			allowedTypes.push("task");
		} catch {}

		try {
			requirePermission(context, "deliverable", "read");
			allowedTypes.push("deliverable");
		} catch {}

		if (allowedTypes.length === 0) {
			return { data: [] };
		}

		// Build query conditions
		const conditions = [
			eq(recentVisits.organizationId, organizationId),
			eq(recentVisits.userId, userId),
			inArray(recentVisits.entityType, allowedTypes),
		];

		// Add entity type filter if not "all"
		if (entityType !== "all") {
			conditions.push(eq(recentVisits.entityType, entityType));
		}

		// Fetch visits (overfetch 2x to account for deleted entities)
		const visits = await db
			.select()
			.from(recentVisits)
			.where(and(...conditions))
			.orderBy(desc(recentVisits.visitedAt), desc(recentVisits.id))
			.limit(limit * 2);

		if (visits.length === 0) {
			return { data: [] };
		}

		// Group entity IDs by type for batch fetching
		const grouped: Record<string, string[]> = {
			booking: [],
			shoot: [],
			task: [],
			deliverable: [],
		};

		for (const visit of visits) {
			if (visit.entityType in grouped) {
				grouped[visit.entityType].push(visit.entityId);
			}
		}

		// Batch fetch entities in parallel
		const [bookingsData, shootsData, tasksData, deliverablesData] =
			await Promise.all([
				grouped.booking.length > 0
					? db
							.select({
								id: bookings.id,
								name: bookings.name,
								status: bookings.status,
								referenceNumber: bookings.referenceNumber,
							})
							.from(bookings)
							.where(
								and(
									inArray(bookings.id, grouped.booking),
									eq(bookings.organizationId, organizationId),
									isNull(bookings.deletedAt),
								),
							)
					: [],
				grouped.shoot.length > 0
					? db
							.select({
								id: shoots.id,
								name: shoots.name,
								status: shoots.status,
								bookingId: shoots.bookingId,
							})
							.from(shoots)
							.where(
								and(
									inArray(shoots.id, grouped.shoot),
									eq(shoots.organizationId, organizationId),
									isNull(shoots.deletedAt),
								),
							)
					: [],
				grouped.task.length > 0
					? db
							.select({
								id: tasks.id,
								name: tasks.name,
								status: tasks.status,
								bookingId: tasks.bookingId,
							})
							.from(tasks)
							.where(
								and(
									inArray(tasks.id, grouped.task),
									eq(tasks.organizationId, organizationId),
									isNull(tasks.deletedAt),
								),
							)
					: [],
				grouped.deliverable.length > 0
					? db
							.select({
								id: deliverables.id,
								name: deliverables.name,
								status: deliverables.status,
								bookingId: deliverables.bookingId,
							})
							.from(deliverables)
							.where(
								and(
									inArray(deliverables.id, grouped.deliverable),
									eq(deliverables.organizationId, organizationId),
									isNull(deliverables.deletedAt),
								),
							)
					: [],
			]);

		// Create lookup map
		const entityMap = new Map<string, Record<string, unknown>>();

		for (const b of bookingsData) {
			entityMap.set(`booking:${b.id}`, b);
		}
		for (const s of shootsData) {
			entityMap.set(`shoot:${s.id}`, s);
		}
		for (const t of tasksData) {
			entityMap.set(`task:${t.id}`, t);
		}
		for (const d of deliverablesData) {
			entityMap.set(`deliverable:${d.id}`, d);
		}

		// Merge and filter out deleted entities, limit to requested count
		const data: RecentVisitItem[] = visits
			.map((visit) => {
				const entityData = entityMap.get(
					`${visit.entityType}:${visit.entityId}`,
				);
				return {
					id: visit.id,
					entityType: visit.entityType,
					entityId: visit.entityId,
					visitedAt: visit.visitedAt.toISOString(),
					entityData: entityData
						? {
								id: entityData.id as string,
								name: entityData.name as string,
								status: entityData.status as string | undefined,
								referenceNumber: entityData.referenceNumber as
									| string
									| undefined,
								bookingId: entityData.bookingId as string | undefined,
							}
						: null,
				};
			})
			.filter((item) => item.entityData !== null)
			.slice(0, limit);

		return { data };
	});
```

### File: `packages/api/modules/recent-visits/router.ts`

```typescript
import { listRecentVisits } from "./procedures/list-recent-visits";
import { trackVisit } from "./procedures/track-visit";

export const recentVisitsRouter = {
	list: listRecentVisits,
	track: trackVisit,
};
```

### File: `packages/api/orpc/router.ts`

Add import and register:

```typescript
// Add import
import { recentVisitsRouter } from "../modules/recent-visits/router";

// Add to router object
export const router = publicProcedure
	.prefix("/api")
	.router({
		// ... existing routers
		
		// Recent visits
		recentVisits: recentVisitsRouter,
	});
```

---

## Phase 3: Frontend - API Utilities

### File: `apps/web/modules/saas/studio/lib/api.ts`

Add to existing file:

```typescript
// ============================================================================
// RECENT VISITS QUERY OPTIONS
// ============================================================================

export const studioQueryKeys = {
	// ... existing keys
	
	// Recent Visits
	recentVisits: {
		all: ["studio", "recentVisits"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "recentVisits", "list", filters] as const,
	},
} as const;

export const recentVisitsApi = {
	listOptions: (
		input?: Parameters<
			typeof orpc.recentVisits.list.queryOptions
		>[0]["input"],
	) => orpc.recentVisits.list.queryOptions({ input: input ?? {} }),
};

export const recentVisitsMutations = {
	track: () => orpc.recentVisits.track.mutationOptions(),
};
```

---

## Phase 4: Frontend - Widget Component

### File: `apps/web/modules/saas/studio/components/recent-visits/recent-visits-widget.tsx`

```typescript
"use client";

import { Skeleton } from "@repo/ui/components/skeleton";
import { recentVisitsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
	CalendarIcon,
	CameraIcon,
	CheckSquareIcon,
	PackageIcon,
} from "lucide-react";
import Link from "next/link";

interface RecentVisitsWidgetProps {
	organizationSlug: string;
}

const entityConfig = {
	booking: {
		icon: CalendarIcon,
		label: "Booking",
		getHref: (slug: string, id: string) => `/app/${slug}/bookings/${id}`,
	},
	shoot: {
		icon: CameraIcon,
		label: "Shoot",
		getHref: (slug: string, id: string, bookingId?: string) =>
			bookingId
				? `/app/${slug}/bookings/${bookingId}?tab=shoots`
				: `/app/${slug}/shoots`,
	},
	task: {
		icon: CheckSquareIcon,
		label: "Task",
		getHref: (slug: string, id: string, bookingId?: string) =>
			bookingId
				? `/app/${slug}/bookings/${bookingId}?tab=tasks`
				: `/app/${slug}/tasks`,
	},
	deliverable: {
		icon: PackageIcon,
		label: "Deliverable",
		getHref: (slug: string, id: string, bookingId?: string) =>
			bookingId
				? `/app/${slug}/bookings/${bookingId}?tab=deliverables`
				: `/app/${slug}/deliverables`,
	},
} as const;

export function RecentVisitsWidget({
	organizationSlug,
}: RecentVisitsWidgetProps) {
	const { data, isLoading, isError } = useQuery({
		...recentVisitsApi.listOptions({ limit: 10 }),
		staleTime: 30_000, // 30 seconds
		refetchOnWindowFocus: false,
	});

	if (isLoading) {
		return (
			<div className="space-y-2">
				{Array.from({ length: 5 }).map((_, i) => (
					<div key={i} className="flex items-center gap-3 p-2">
						<Skeleton className="h-8 w-8 rounded-md" />
						<div className="flex-1 space-y-1">
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-3 w-1/2" />
						</div>
					</div>
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<p className="text-sm text-muted-foreground">
				Failed to load recent activity.
			</p>
		);
	}

	const items = data?.data ?? [];

	if (items.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				No recent activity yet. Start by viewing a booking, shoot, or task.
			</p>
		);
	}

	return (
		<div className="space-y-1">
			{items.map((item) => {
				const config =
					entityConfig[item.entityType as keyof typeof entityConfig];
				if (!config || !item.entityData) return null;

				const Icon = config.icon;
				const href = config.getHref(
					organizationSlug,
					item.entityId,
					item.entityData.bookingId,
				);

				return (
					<Link
						key={item.id}
						href={href}
						className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors"
					>
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
							<Icon className="h-4 w-4 text-muted-foreground" />
						</div>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium">
								{item.entityData.name}
							</p>
							<p className="text-xs text-muted-foreground">
								{config.label}
								{item.entityData.referenceNumber &&
									` • ${item.entityData.referenceNumber}`}
								{" • "}
								{formatDistanceToNow(new Date(item.visitedAt), {
									addSuffix: true,
								})}
							</p>
						</div>
					</Link>
				);
			})}
		</div>
	);
}
```

### File: `apps/web/modules/saas/studio/components/recent-visits/index.ts`

```typescript
export { RecentVisitsWidget } from "./recent-visits-widget";
```

---

## Phase 5: Frontend - Tracking Hook

### File: `apps/web/modules/saas/studio/hooks/use-track-visit.ts`

```typescript
"use client";

import { recentVisitsMutations } from "@saas/studio/lib/api";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

type EntityType = "booking" | "shoot" | "task" | "deliverable";

interface UseTrackVisitOptions {
	entityType: EntityType;
	entityId: string | undefined | null;
	enabled?: boolean;
}

/**
 * Hook to track entity visits for the recent items feature.
 * Fires once on mount when entityId is available.
 */
export function useTrackVisit({
	entityType,
	entityId,
	enabled = true,
}: UseTrackVisitOptions) {
	const tracked = useRef<string | null>(null);
	const mutation = useMutation(recentVisitsMutations.track());

	useEffect(() => {
		if (!enabled || !entityId || tracked.current === entityId) {
			return;
		}

		tracked.current = entityId;
		mutation.mutate({ entityType, entityId });
	}, [entityType, entityId, enabled, mutation]);
}
```

---

## Phase 6: Integration - Detail Pages

Add tracking to existing detail page client components.

### File: `apps/web/app/(saas)/app/[organizationSlug]/bookings/[bookingId]/BookingDetailPageClient.tsx`

Add to existing component:

```typescript
// Add import
import { useTrackVisit } from "@saas/studio/hooks/use-track-visit";

// Add inside component, before the query
export function BookingDetailPageClient({
	organizationSlug,
	bookingId,
}: BookingDetailPageClientProps) {
	// Track visit
	useTrackVisit({
		entityType: "booking",
		entityId: bookingId,
	});

	// ... rest of existing code
}
```

### Similar changes for other detail pages:

- Shoots: Add tracking in shoot detail component
- Tasks: Add tracking in task detail component  
- Deliverables: Add tracking in deliverable detail component

---

## Phase 7: Integration - Home Page

### File: `apps/web/app/(saas)/app/[organizationSlug]/home/page.tsx`

Replace the "Coming soon..." placeholder:

```typescript
import { getActiveOrganization, getSession } from "@saas/auth/lib/server";
import { RecentVisitsWidget } from "@saas/studio/components/recent-visits";
import { notFound } from "next/navigation";

type Props = {
	params: Promise<{ organizationSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
	const { organizationSlug } = await params;
	const activeOrganization = await getActiveOrganization(organizationSlug);

	return {
		title: `Home | ${activeOrganization?.name ?? "Studio"}`,
	};
}

function getGreeting(): string {
	const hour = new Date().getHours();
	if (hour < 12) return "Good morning";
	if (hour < 17) return "Good afternoon";
	return "Good evening";
}

export default async function HomePage({ params }: Props) {
	const { organizationSlug } = await params;

	const session = await getSession();
	const activeOrganization = await getActiveOrganization(organizationSlug);

	if (!activeOrganization) {
		return notFound();
	}

	const firstName = session?.user?.name?.split(" ")[0] ?? "there";

	return (
		<div className="space-y-8">
			<header>
				<h1 className="text-2xl font-bold tracking-tight">
					{getGreeting()}, {firstName}!
				</h1>
				<p className="text-muted-foreground">
					Here&apos;s what&apos;s happening in your studio today.
				</p>
			</header>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				<section className="rounded-lg border bg-card p-4">
					<div className="text-sm font-medium text-muted-foreground">
						Organization
					</div>
					<p className="mt-2 text-xl font-semibold">
						{activeOrganization.name}
					</p>
				</section>

				<section className="rounded-lg border bg-card p-4">
					<div className="text-sm font-medium text-muted-foreground">
						Quick Actions
					</div>
					<p className="mt-2 text-sm text-muted-foreground">
						Coming soon...
					</p>
				</section>

				<section className="rounded-lg border bg-card p-4">
					<div className="mb-3 text-sm font-medium text-muted-foreground">
						Recent Activity
					</div>
					<RecentVisitsWidget organizationSlug={organizationSlug} />
				</section>
			</div>
		</div>
	);
}
```

---

## File Checklist

| Phase | Action | File Path | Status |
|-------|--------|-----------|--------|
| 1 | MODIFY | `packages/database/drizzle/schema/studio.ts` | ⬜ |
| 1 | RUN | `pnpm db:generate && pnpm db:migrate` | ⬜ |
| 2 | CREATE | `packages/api/modules/recent-visits/schemas.ts` | ⬜ |
| 2 | CREATE | `packages/api/modules/recent-visits/lib/verify-entity.ts` | ⬜ |
| 2 | CREATE | `packages/api/modules/recent-visits/procedures/track-visit.ts` | ⬜ |
| 2 | CREATE | `packages/api/modules/recent-visits/procedures/list-recent-visits.ts` | ⬜ |
| 2 | CREATE | `packages/api/modules/recent-visits/router.ts` | ⬜ |
| 2 | MODIFY | `packages/api/orpc/router.ts` | ⬜ |
| 3 | MODIFY | `apps/web/modules/saas/studio/lib/api.ts` | ⬜ |
| 4 | CREATE | `apps/web/modules/saas/studio/components/recent-visits/recent-visits-widget.tsx` | ⬜ |
| 4 | CREATE | `apps/web/modules/saas/studio/components/recent-visits/index.ts` | ⬜ |
| 5 | CREATE | `apps/web/modules/saas/studio/hooks/use-track-visit.ts` | ⬜ |
| 6 | MODIFY | `apps/web/app/(saas)/app/[organizationSlug]/bookings/[bookingId]/BookingDetailPageClient.tsx` | ⬜ |
| 7 | MODIFY | `apps/web/app/(saas)/app/[organizationSlug]/home/page.tsx` | ⬜ |

---

## Testing Checklist

| Test Case | Expected Result |
|-----------|-----------------|
| Visit booking detail page | Creates/updates visit record |
| Visit same booking again | Updates `visited_at` timestamp |
| Visit 21+ unique entities | Oldest record is pruned |
| Home page loads | Shows recent items with names |
| Click recent item | Navigates to correct detail page |
| Delete an entity | Entity doesn't appear in recents |
| User without booking permission | Doesn't see booking recents |
| Empty state | Shows "No recent activity" message |

---

## Future Enhancements

1. **Filters**: Add filter dropdown (All, Bookings, Tasks, etc.)
2. **Clear history**: Add "Clear all" button
3. **Keyboard navigation**: Support arrow keys in widget
4. **Command palette**: Integrate with Cmd+K search
5. **Analytics**: Track most visited entities per user

---

## References

- Plane's implementation: `apps/api/plane/bgtasks/recent_visited_task.py`
- Existing API patterns: `packages/api/modules/tasks/procedures/get-task.ts`
- Existing widget patterns: `apps/web/modules/saas/studio/lib/api.ts`
