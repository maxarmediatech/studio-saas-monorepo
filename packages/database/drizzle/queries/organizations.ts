import { type AnyColumn, and, eq, ilike, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { z } from "zod";
import { db } from "../client";
import { members, organizations } from "../schema";
import type { OrganizationUpdateSchema } from "../zod";

const pgDialect = new PgDialect();

/**
 * Workaround for Drizzle ORM bug where sql`` interpolates wrong table name in extras
 * @see https://github.com/drizzle-team/drizzle-orm/issues/1815
 */
function countRelation(fieldId: AnyColumn, refId: AnyColumn) {
	const sqlChunks = sql`(SELECT COUNT(*) FROM ${refId.table} WHERE ${refId} = ${fieldId})`;
	return sql.raw(pgDialect.sqlToQuery(sqlChunks).sql).mapWith(Number);
}

export async function getOrganizations({
	limit,
	offset,
	query,
}: {
	limit: number;
	offset: number;
	query?: string;
}) {
	return db.query.organizations.findMany({
		where: query
			? (org, { ilike }) => ilike(org.name, `%${query}%`)
			: undefined,
		limit,
		offset,
		orderBy: (org, { asc }) => [asc(org.createdAt), asc(org.id)],
		extras: {
			membersCount: countRelation(
				organizations.id,
				members.organizationId,
			).as("membersCount"),
		},
	});
}

export async function countAllOrganizations(query?: string) {
	return db.$count(
		organizations,
		query ? ilike(organizations.name, `%${query}%`) : undefined,
	);
}

export async function getOrganizationById(id: string) {
	return db.query.organizations.findFirst({
		where: (org, { eq }) => eq(org.id, id),
		with: {
			members: true,
			invitations: true,
		},
	});
}

export async function getInvitationById(id: string) {
	return db.query.invitations.findFirst({
		where: (invitation, { eq }) => eq(invitation.id, id),
		with: {
			organization: true,
		},
	});
}

export async function getOrganizationBySlug(slug: string) {
	return db.query.organizations.findFirst({
		where: (org, { eq }) => eq(org.slug, slug),
	});
}

export async function getOrganizationMembership(
	organizationId: string,
	userId: string,
) {
	return db.query.members.findFirst({
		where: (member, { eq }) =>
			and(
				eq(member.organizationId, organizationId),
				eq(member.userId, userId),
			),
		with: {
			organization: true,
		},
	});
}

export async function getOrganizationWithPurchasesAndMembersCount(
	organizationId: string,
) {
	return db.query.organizations.findFirst({
		where: (org, { eq }) => eq(org.id, organizationId),
		with: {
			purchases: true,
		},
		extras: {
			membersCount: countRelation(
				organizations.id,
				members.organizationId,
			).as("membersCount"),
		},
	});
}

export async function getPendingInvitationByEmail(email: string) {
	return db.query.invitations.findFirst({
		where: (invitation, { eq }) =>
			and(eq(invitation.email, email), eq(invitation.status, "pending")),
	});
}

export async function updateOrganization(
	updatedOrganization: z.infer<typeof OrganizationUpdateSchema>,
) {
	return db
		.update(organizations)
		.set(updatedOrganization)
		.where(eq(organizations.id, updatedOrganization.id));
}

export async function getOrganizationsByUserId(userId: string) {
	return db.query.members.findMany({
		where: (member, { eq }) => eq(member.userId, userId),
		with: {
			organization: true,
		},
	});
}
