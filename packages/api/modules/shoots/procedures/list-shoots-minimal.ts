import { and, db, eq, isNull, shoots, sql } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	listShootsMinimalInputSchema,
	listShootsMinimalOutputSchema,
} from "../../studio/schemas/shoot";

export const listShootsMinimal = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/shoots/minimal",
		tags: ["Shoots"],
		summary: "List shoots (minimal)",
		description: "Lightweight list of shoots for dropdowns and references",
	})
	.input(listShootsMinimalInputSchema)
	.output(listShootsMinimalOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "shoot", "list");

		const { bookingId, status, search } = input;

		// Build where conditions
		const conditions = [
			eq(shoots.organizationId, context.organizationId),
			isNull(shoots.deletedAt),
		];

		if (bookingId) {
			conditions.push(eq(shoots.bookingId, bookingId));
		}

		if (status) {
			conditions.push(eq(shoots.status, status));
		}

		if (search) {
			conditions.push(sql`${shoots.name} ILIKE ${`%${search}%`}`);
		}

		const data = await db.query.shoots.findMany({
			where: and(...conditions),
			columns: {
				id: true,
				name: true,
				shootType: true,
				side: true,
				shootDate: true,
				status: true,
				bookingId: true,
			},
			orderBy: (table, { desc }) => [desc(table.shootDate)],
			limit: 100,
		});

		return { data };
	});
