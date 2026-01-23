import { TZDate } from "@date-fns/tz";
import {
	and,
	checkins,
	checkinTypes,
	db,
	eq,
	gte,
	isNull,
	organizations,
	users,
} from "@repo/database";
import { logger } from "@repo/logs";
import {
	addDays,
	addWeeks,
	format,
	isWeekend,
	startOfDay,
	startOfWeek,
} from "date-fns";

function normalizeTimeZone(timeZone: string | null | undefined): string {
	if (!timeZone) return "UTC";
	try {
		new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
		return timeZone;
	} catch {
		return "UTC";
	}
}

function computeCheckinDateAt(params: {
	at: Date;
	scheduledTime: string | null;
	frequency: "daily" | "weekdays" | "weekly";
	timezone: string;
}): string {
	const nowInTz = new TZDate(params.at, params.timezone);
	const todayInTz = startOfDay(nowInTz);

	if (!params.scheduledTime) {
		return format(todayInTz, "yyyy-MM-dd");
	}

	const timeParts = params.scheduledTime.split(":");
	const hours = Number.parseInt(timeParts[0], 10);
	const minutes = Number.parseInt(timeParts[1], 10);

	const scheduledToday = new TZDate(
		todayInTz.getFullYear(),
		todayInTz.getMonth(),
		todayInTz.getDate(),
		hours,
		minutes,
		0,
		params.timezone,
	);

	if (params.frequency === "weekly") {
		return format(
			getWeeklyPeriodDate(nowInTz, params.scheduledTime, params.timezone),
			"yyyy-MM-dd",
		);
	}

	let periodDate =
		nowInTz < scheduledToday ? addDays(todayInTz, -1) : todayInTz;

	if (params.frequency === "weekdays") {
		while (isWeekend(periodDate)) {
			periodDate = addDays(periodDate, -1);
		}
	}

	return format(periodDate, "yyyy-MM-dd");
}

function getWeeklyPeriodDate(
	nowInTz: Date,
	scheduledTime: string,
	timezone: string,
): Date {
	const timeParts = scheduledTime.split(":");
	const hours = Number.parseInt(timeParts[0], 10);
	const minutes = Number.parseInt(timeParts[1], 10);

	const weekStart = startOfWeek(startOfDay(nowInTz), { weekStartsOn: 1 });
	const scheduledOnWeekStart = new TZDate(
		weekStart.getFullYear(),
		weekStart.getMonth(),
		weekStart.getDate(),
		hours,
		minutes,
		0,
		timezone,
	);

	return nowInTz < scheduledOnWeekStart ? addWeeks(weekStart, -1) : weekStart;
}

function getArgValue(name: string): string | undefined {
	const idx = process.argv.indexOf(name);
	if (idx === -1) return undefined;
	return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
	return process.argv.includes(name);
}

function formatYmd(date: Date): string {
	return date.toISOString().slice(0, 10);
}

async function main() {
	const daysArg = getArgValue("--days");
	const days = daysArg ? Number.parseInt(daysArg, 10) : 7;
	const limitArg = getArgValue("--limit");
	const limit = limitArg ? Number.parseInt(limitArg, 10) : undefined;
	const apply = hasFlag("--apply");

	if (!Number.isFinite(days) || days <= 0) {
		throw new Error("--days must be a positive integer");
	}

	const since = new Date();
	since.setDate(since.getDate() - days);

	logger.info(
		`Backfilling checkinDate for checkins created in last ${days} day(s) (since ${since.toISOString()})`,
	);
	logger.info(
		apply ? "Mode: APPLY" : "Mode: DRY RUN (use --apply to write changes)",
	);

	const rows = await db
		.select({
			id: checkins.id,
			checkinTypeId: checkins.checkinTypeId,
			createdBy: checkins.createdBy,
			organizationId: checkins.organizationId,
			createdAt: checkins.createdAt,
			checkinDate: checkins.checkinDate,
			scheduledTime: checkinTypes.scheduledTime,
			frequency: checkinTypes.frequency,
			userTimezone: users.timezone,
			orgTimezone: organizations.timezone,
		})
		.from(checkins)
		.innerJoin(checkinTypes, eq(checkins.checkinTypeId, checkinTypes.id))
		.innerJoin(organizations, eq(checkins.organizationId, organizations.id))
		.innerJoin(users, eq(checkins.createdBy, users.id))
		.where(and(isNull(checkins.deletedAt), gte(checkins.createdAt, since)))
		.orderBy(checkins.createdAt);

	const limitedRows = typeof limit === "number" ? rows.slice(0, limit) : rows;

	let scanned = 0;
	let needsChange = 0;
	let updated = 0;
	let skippedConflicts = 0;

	for (const row of limitedRows) {
		scanned++;

		const timezone = normalizeTimeZone(
			row.userTimezone ?? row.orgTimezone ?? "UTC",
		);

		const targetYmd = computeCheckinDateAt({
			at: row.createdAt,
			scheduledTime: row.scheduledTime,
			frequency: row.frequency,
			timezone,
		});
		const currentYmd = formatYmd(row.checkinDate);

		if (targetYmd === currentYmd) continue;
		needsChange++;

		const targetDate = new Date(targetYmd);
		const conflict = await db.query.checkins.findFirst({
			where: and(
				eq(checkins.checkinTypeId, row.checkinTypeId),
				eq(checkins.createdBy, row.createdBy),
				eq(checkins.checkinDate, targetDate),
				isNull(checkins.deletedAt),
			),
			columns: { id: true },
		});

		if (conflict && conflict.id !== row.id) {
			skippedConflicts++;
			logger.warn("Skipping due to unique conflict", {
				checkinId: row.id,
				checkinTypeId: row.checkinTypeId,
				createdBy: row.createdBy,
				from: currentYmd,
				to: targetYmd,
				conflictId: conflict.id,
			});
			continue;
		}

		logger.info("Backfill checkinDate", {
			checkinId: row.id,
			checkinTypeId: row.checkinTypeId,
			createdBy: row.createdBy,
			from: currentYmd,
			to: targetYmd,
			timezone,
			createdAt: row.createdAt.toISOString(),
		});

		if (!apply) continue;

		await db
			.update(checkins)
			.set({
				checkinDate: targetDate,
				updatedAt: new Date(),
				updatedBy: row.createdBy,
			})
			.where(eq(checkins.id, row.id));
		updated++;
	}

	logger.success("Backfill finished", {
		scanned,
		needsChange,
		updated: apply ? updated : 0,
		skippedConflicts,
	});

	if (!apply && needsChange > 0) {
		logger.info("Re-run with --apply to write changes.");
	}
}

main().catch((error) => {
	logger.error("Backfill failed", { error });
	process.exitCode = 1;
});
