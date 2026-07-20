import { type Config, config } from "@repo/config";
import {
	and,
	calendarRouteChanges,
	crews,
	db,
	eq,
	getOrganizationWithPurchasesAndMembersCount,
	ilike,
	isNull,
	organizations,
	users,
} from "@repo/database";
import { logger } from "@repo/logs";
import { setSubscriptionSeats } from "@repo/payments";

type EnsureCrewForMemberInput = {
	organizationId: string;
	userId: string;
	memberId?: string;
	source:
		| "after_add_member"
		| "after_accept_invitation"
		| "session_auto_heal";
};

export async function ensureCrewForMember({
	organizationId,
	userId,
	memberId,
	source,
}: EnsureCrewForMemberInput) {
	try {
		const existingCrew = await db.query.crews.findFirst({
			where: and(
				eq(crews.organizationId, organizationId),
				eq(crews.userId, userId),
				isNull(crews.deletedAt),
			),
		});

		if (existingCrew) {
			logger.info("crew.auto_create.exists", {
				memberId,
				userId,
				organizationId,
				crewId: existingCrew.id,
				source,
			});
			return;
		}

		const user = await db.query.users.findFirst({
			where: eq(users.id, userId),
		});

		if (!user) {
			logger.warn("crew.auto_create.user_not_found", {
				memberId,
				userId,
				organizationId,
				source,
			});
			return;
		}

		if (user.email) {
			const matchingCrew = await db.query.crews.findFirst({
				where: and(
					eq(crews.organizationId, organizationId),
					ilike(crews.email, user.email),
					isNull(crews.userId),
					isNull(crews.deletedAt),
				),
			});

			if (matchingCrew) {
				await db.transaction(async (tx) => {
					await tx
						.update(crews)
						.set({
							userId: user.id,
							email: user.email,
							updatedBy: user.id,
							updatedAt: new Date(),
						})
						.where(eq(crews.id, matchingCrew.id));
					await tx.insert(calendarRouteChanges).values({
						organizationId,
						crewId: matchingCrew.id,
						reason: "crew_user_linked",
					});
				});

				logger.info("crew.auto_create.linked_existing", {
					memberId,
					userId,
					organizationId,
					crewId: matchingCrew.id,
					source,
				});
				return;
			}
		}

		const [created] = await db
			.insert(crews)
			.values({
				organizationId,
				userId: user.id,
				name: user.name,
				email: user.email,
				phoneNumber: null,
				workerType: "internal",
				status: "active",
				dailyRate: null,
				metadata: { autoCreated: true },
				createdBy: user.id,
			})
			.onConflictDoNothing()
			.returning({ id: crews.id });

		if (created) {
			logger.info("crew.auto_create.created", {
				memberId,
				userId,
				organizationId,
				crewId: created.id,
				source,
			});
		} else {
			logger.info("crew.auto_create.exists", {
				memberId,
				userId,
				organizationId,
				source,
			});
		}
	} catch (error) {
		logger.error("crew.auto_create.failed", {
			memberId,
			userId,
			organizationId,
			source,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

export async function updateSeatsInOrganizationSubscription(
	organizationId: string,
) {
	try {
		const organization =
			await getOrganizationWithPurchasesAndMembersCount(organizationId);
		const activeSubscriptionStatuses = new Set(["active", "trialing"]);

		if (!organization?.purchases.length) {
			return {
				status: "skipped" as const,
				reason: "no_subscription" as const,
			};
		}

		const activeSubscription = [...organization.purchases]
			.sort((a, b) => {
				const aTime = a.updatedAt ?? a.createdAt;
				const bTime = b.updatedAt ?? b.createdAt;
				return bTime.getTime() - aTime.getTime();
			})
			.find(
				(purchase) =>
					purchase.type === "SUBSCRIPTION" &&
					activeSubscriptionStatuses.has(
						(purchase.status ?? "").toLowerCase(),
					),
			);

		if (!activeSubscription?.subscriptionId) {
			return {
				status: "skipped" as const,
				reason: "no_subscription" as const,
			};
		}

		const plans = config.payments.plans as Config["payments"]["plans"];
		const configuredPrice = Object.values(plans)
			.flatMap((plan) => plan.prices ?? [])
			.find((price) => price.priceKey === activeSubscription.priceKey);
		if (
			!configuredPrice ||
			!("seatBased" in configuredPrice) ||
			!configuredPrice.seatBased
		) {
			return {
				status: "skipped" as const,
				reason: "not_seat_based" as const,
			};
		}

		await setSubscriptionSeats({
			id: activeSubscription.subscriptionId,
			seats: organization.membersCount,
		});
		await db
			.update(organizations)
			.set({
				billingSeatCount: organization.membersCount,
				billingSeatSyncedAt: new Date(),
				billingSeatSyncError: null,
			})
			.where(eq(organizations.id, organizationId));
		return { status: "synced" as const, seats: organization.membersCount };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		try {
			await db
				.update(organizations)
				.set({ billingSeatSyncError: message })
				.where(eq(organizations.id, organizationId));
		} catch (recordError) {
			logger.error("Could not record subscription seat sync failure", {
				organizationId,
				error:
					recordError instanceof Error
						? recordError.message
						: String(recordError),
			});
		}
		logger.error("Could not update seats in organization subscription", {
			organizationId,
			error: message,
		});
		return { status: "failed" as const, error: message };
	}
}
