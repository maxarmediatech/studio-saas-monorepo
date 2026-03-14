import {
	and,
	crews,
	db,
	eq,
	getOrganizationWithPurchasesAndMembersCount,
	ilike,
	isNull,
	users,
} from "@repo/database";
import { logger } from "@repo/logs";
import { setSubscriptionSeats } from "@repo/payments";

type EnsureCrewForMemberInput = {
	organizationId: string;
	userId: string;
	memberId?: string;
	source:
		| "db_hook"
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
				await db
					.update(crews)
					.set({
						userId: user.id,
						email: user.email,
						updatedBy: user.id,
						updatedAt: new Date(),
					})
					.where(eq(crews.id, matchingCrew.id));

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
	}
}

export async function updateSeatsInOrganizationSubscription(
	organizationId: string,
) {
	const organization =
		await getOrganizationWithPurchasesAndMembersCount(organizationId);
	const activeSubscriptionStatuses = new Set(["active", "trialing"]);

	if (!organization?.purchases.length) {
		return;
	}

	const activeSubscription = organization.purchases.find(
		(purchase) =>
			purchase.type === "SUBSCRIPTION" &&
			activeSubscriptionStatuses.has(
				(purchase.status ?? "").toLowerCase(),
			),
	);

	if (!activeSubscription?.subscriptionId) {
		return;
	}

	try {
		await setSubscriptionSeats({
			id: activeSubscription.subscriptionId,
			seats: organization.membersCount,
		});
	} catch (error) {
		logger.error("Could not update seats in organization subscription", {
			organizationId,
			error,
		});
	}
}
