import { updateSeatsInOrganizationSubscription } from "@repo/auth/lib/organization";
import { db, organizations } from "@repo/database";
import { logger, schedules } from "@trigger.dev/sdk/v3";
import { reconcileCalendarDeliveries } from "../../packages/api/modules/shoots/lib/calendar-delivery";
import { queryFinancialMismatches } from "../../tooling/scripts/src/reconcile-financials";

const organizationIds = () =>
	db.select({ id: organizations.id }).from(organizations);

export const reconcileCalendars = schedules.task({
	id: "reconcile-calendar-deliveries",
	cron: "*/15 * * * *",
	maxDuration: 900,
	queue: { concurrencyLimit: 1 },
	run: async () => {
		const rows = await organizationIds();
		const summary = {
			organizations: rows.length,
			reconciled: 0,
			failed: 0,
		};
		for (const organization of rows) {
			try {
				const result = await reconcileCalendarDeliveries({
					organizationId: organization.id,
					apply: true,
				});
				summary.reconciled += result.reconciled;
				summary.failed += result.failed;
			} catch (error) {
				summary.failed += 1;
				logger.error("Calendar reconciliation failed", {
					organizationId: organization.id,
					error,
				});
			}
		}
		return summary;
	},
});

export const reconcileSubscriptionSeats = schedules.task({
	id: "reconcile-subscription-seats",
	cron: "7 * * * *",
	maxDuration: 900,
	queue: { concurrencyLimit: 1 },
	run: async () => {
		const rows = await organizationIds();
		const summary = { synced: 0, skipped: 0, failed: 0 };
		for (const organization of rows) {
			try {
				const result = await updateSeatsInOrganizationSubscription(
					organization.id,
				);
				summary[result.status] += 1;
			} catch (error) {
				summary.failed += 1;
				logger.error("Subscription seat reconciliation failed", {
					organizationId: organization.id,
					error,
				});
			}
		}
		return summary;
	},
});

export const reportFinancialMismatches = schedules.task({
	id: "report-financial-mismatches",
	cron: "23 2 * * *",
	maxDuration: 1800,
	queue: { concurrencyLimit: 1 },
	run: async () => {
		const rows = await organizationIds();
		const asOf = new Date().toISOString().slice(0, 10);
		const summary = {
			organizations: rows.length,
			mismatches: 0,
			failed: 0,
		};
		for (const organization of rows) {
			try {
				const report = await queryFinancialMismatches(
					organization.id,
					asOf,
				);
				summary.mismatches += report.mismatches.length;
				if (report.mismatches.length > 0) {
					logger.warn("Financial reconciliation found mismatches", {
						organizationId: organization.id,
						mismatchCount: report.mismatches.length,
						summary: report.summary,
					});
				}
			} catch (error) {
				summary.failed += 1;
				logger.error("Financial reconciliation report failed", {
					organizationId: organization.id,
					error,
				});
			}
		}
		return summary;
	},
});
