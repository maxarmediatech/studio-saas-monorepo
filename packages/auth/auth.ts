import { config } from "@repo/config";
import {
	db,
	getOrganizationsByUserId,
	getPurchasesByOrganizationId,
	getPurchasesByUserId,
	getUserByEmail,
} from "@repo/database";
import type { Locale } from "@repo/i18n";
import { logger } from "@repo/logs";
import { sendEmail } from "@repo/mail";
import { cancelSubscription } from "@repo/payments";
import { getBaseUrl, getRequestBaseUrl, toRequestAppUrl } from "@repo/utils";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import {
	admin,
	magicLink,
	openAPI,
	organization,
	twoFactor,
	username,
} from "better-auth/plugins";
import { parse as parseCookies } from "cookie";
import {
	ensureCrewForMember,
	updateSeatsInOrganizationSubscription,
} from "./lib/organization";
import { ensureDefaultOrganizationRoles } from "./lib/organization-roles";
import { ac, appRoles, serializeRoles } from "./lib/permissions";
import { invitationOnlyPlugin } from "./plugins/invitation-only";

type RequestLike =
	| Request
	| {
			request?: Request;
			headers?:
				| Headers
				| {
						get?: (name: string) => string | null;
						cookie?: string;
				  };
	  }
	| undefined;

const getLocaleFromRequest = (request?: RequestLike) => {
	if (request instanceof Request) {
		const cookies = parseCookies(request.headers.get("cookie") ?? "");
		return (
			(cookies[config.i18n.localeCookieName] as Locale) ??
			config.i18n.defaultLocale
		);
	}

	const cookieHeader =
		request?.request instanceof Request
			? request.request.headers.get("cookie")
			: typeof request?.headers === "object" && request?.headers !== null
				? typeof (request.headers as Headers).get === "function"
					? (request.headers as Headers).get("cookie")
					: (request.headers as { cookie?: string }).cookie
				: undefined;

	const cookies = parseCookies(cookieHeader ?? "");
	return (
		(cookies[config.i18n.localeCookieName] as Locale) ??
		config.i18n.defaultLocale
	);
};

const appUrl = getBaseUrl();

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	if (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return error.message;
	}

	return null;
}

export class OrganizationInvitationEmailDeliveryError extends Error {
	readonly email: string;
	readonly invitationId: string;
	readonly organizationId: string;
	readonly reason: string | null;
	readonly originalError: unknown;

	constructor({
		email,
		invitationId,
		organizationId,
		cause,
	}: {
		email: string;
		invitationId: string;
		organizationId: string;
		cause: unknown;
	}) {
		const reason = getErrorMessage(cause);
		super(
			reason
				? `Invitation email could not be delivered. ${reason}`
				: "Invitation email could not be delivered.",
		);
		this.name = "OrganizationInvitationEmailDeliveryError";
		this.email = email;
		this.invitationId = invitationId;
		this.organizationId = organizationId;
		this.reason = reason;
		this.originalError = cause;
	}
}

async function sendAuthEmail(
	flow:
		| "change_email_verification"
		| "reset_password"
		| "email_verification"
		| "magic_link"
		| "organization_invitation",
	params: Parameters<typeof sendEmail>[0],
) {
	try {
		await sendEmail(params);
	} catch (error) {
		logger.error("auth.email.send_failed", {
			error,
			flow,
			to: params.to,
		});
		throw error;
	}
}

export const auth = betterAuth({
	baseURL: appUrl,
	trustedOrigins: [appUrl],
	appName: config.appName,
	database: drizzleAdapter(db, {
		provider: "pg",
		usePlural: true,
	}),
	advanced: {
		database: {
			generateId: false,
		},
	},
	session: {
		expiresIn: config.auth.sessionCookieMaxAge,
		freshAge: 0,
	},
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["google"],
		},
	},
	databaseHooks: {
		session: {
			create: {
				before: async (session) => {
					// Auto-set activeOrganizationId when session is created
					if (config.organizations.enable && session.userId) {
						const memberships = await getOrganizationsByUserId(
							session.userId,
						);
						const firstMembership = memberships[0];
						const firstOrg = memberships[0]?.organization;
						if (firstMembership?.organizationId) {
							await ensureCrewForMember({
								organizationId: firstMembership.organizationId,
								userId: session.userId,
								memberId: firstMembership.id,
								source: "session_auto_heal",
							});
						}

						return {
							data: {
								...session,
								activeOrganizationId: firstOrg?.id ?? null,
							},
						};
					}
					return { data: session };
				},
			},
		},
	},
	hooks: {
		after: createAuthMiddleware(async (ctx) => {
			const sessionCookieHeader =
				ctx.context.responseHeaders?.get("set-cookie");
			const sessionTokenName = ctx.context.authCookies.sessionToken.name;

			if (!sessionCookieHeader?.includes(sessionTokenName)) {
				return;
			}

			const session =
				ctx.context.newSession?.session ?? ctx.context.session?.session;
			const userId = session?.userId;
			const activeOrganizationId = session?.activeOrganizationId;

			if (!userId || !config.organizations.enable) {
				ctx.setCookie("activeOrganizationSlug", "", {
					...ctx.context.authCookies.sessionToken.attributes,
					httpOnly: false,
					maxAge: 0,
				});
				return;
			}

			const memberships = await getOrganizationsByUserId(userId);
			const activeMembership = activeOrganizationId
				? memberships.find(
						(member) =>
							member.organizationId === activeOrganizationId,
					)
				: memberships[0];
			const shouldRunSessionAutoHeal =
				ctx.path.startsWith("/sign-in") ||
				ctx.path.startsWith("/sign-up") ||
				ctx.path.startsWith("/organization/create") ||
				ctx.path.startsWith("/organization/accept-invitation") ||
				ctx.path.startsWith("/organization/set-active");
			if (shouldRunSessionAutoHeal && activeMembership?.organizationId) {
				await ensureCrewForMember({
					organizationId: activeMembership.organizationId,
					userId,
					memberId: activeMembership.id,
					source: "session_auto_heal",
				});
			}
			const activeOrganizationSlug = activeMembership?.organization?.slug;

			if (!activeOrganizationSlug) {
				ctx.setCookie("activeOrganizationSlug", "", {
					...ctx.context.authCookies.sessionToken.attributes,
					httpOnly: false,
					maxAge: 0,
				});
				return;
			}

			ctx.setCookie("activeOrganizationSlug", activeOrganizationSlug, {
				...ctx.context.authCookies.sessionToken.attributes,
				httpOnly: false,
			});
		}),
		before: createAuthMiddleware(async (ctx) => {
			if (
				ctx.path.startsWith("/delete-user") ||
				ctx.path.startsWith("/organization/delete")
			) {
				const userId = ctx.context.session?.session.userId;
				const { organizationId } = ctx.body;

				if (userId || organizationId) {
					const purchases = organizationId
						? await getPurchasesByOrganizationId(organizationId)
						: // biome-ignore lint/style/noNonNullAssertion: This is a valid case
							await getPurchasesByUserId(userId!);
					const subscriptions = purchases.filter(
						(purchase) =>
							purchase.type === "SUBSCRIPTION" &&
							purchase.subscriptionId !== null,
					);

					if (subscriptions.length > 0) {
						for (const subscription of subscriptions) {
							await cancelSubscription(
								// biome-ignore lint/style/noNonNullAssertion: This is a valid case
								subscription.subscriptionId!,
							);
						}
					}
				}
			}
		}),
	},
	user: {
		additionalFields: {
			onboardingComplete: {
				type: "boolean",
				required: false,
			},
			locale: {
				type: "string",
				required: false,
			},
			timezone: {
				type: "string",
				required: false,
			},
		},
		deleteUser: {
			enabled: true,
		},
		changeEmail: {
			enabled: true,
			sendChangeEmailConfirmation: async (
				{ user: { email, name }, url },
				request,
			) => {
				const locale = getLocaleFromRequest(request);
				await sendAuthEmail("change_email_verification", {
					to: email,
					templateId: "emailVerification",
					context: {
						url: toRequestAppUrl(url, request, appUrl),
						name,
					},
					locale,
				});
			},
		},
	},
	emailAndPassword: {
		enabled: true,
		// If signup is disabled, the only way to sign up is via an invitation. So in this case we can auto sign in the user, as the email is already verified by the invitation.
		// If signup is enabled, we can't auto sign in the user, as the email is not verified yet.
		autoSignIn: !config.auth.enableSignup,
		requireEmailVerification: config.auth.enableSignup,
		sendResetPassword: async ({ user, url }, request) => {
			const locale = getLocaleFromRequest(request);
			await sendAuthEmail("reset_password", {
				to: user.email,
				templateId: "forgotPassword",
				context: {
					url: toRequestAppUrl(url, request, appUrl),
					name: user.name,
				},
				locale,
			});
		},
	},
	emailVerification: {
		sendOnSignUp: config.auth.enableSignup,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async (
			{ user: { email, name }, url },
			request,
		) => {
			const locale = getLocaleFromRequest(request);
			await sendAuthEmail("email_verification", {
				to: email,
				templateId: "emailVerification",
				context: {
					url: toRequestAppUrl(url, request, appUrl),
					name,
				},
				locale,
			});
		},
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID as string,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
			scope: ["email", "profile"],
		},
		// github: {
		// 	clientId: process.env.GITHUB_CLIENT_ID as string,
		// 	clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
		// 	scope: ["user:email"],
		// },
	},
	plugins: [
		username(),
		admin({
			// Disable role-based platform admin and allow only explicit user IDs.
			adminRoles: [],
			adminUserIds: config.auth.platformAdminUserIds,
		}),
		magicLink({
			disableSignUp: false,
			sendMagicLink: async ({ email, url }, request) => {
				const locale = getLocaleFromRequest(request);
				await sendAuthEmail("magic_link", {
					to: email,
					templateId: "magicLink",
					context: {
						url: toRequestAppUrl(url, request, appUrl),
					},
					locale,
				});
			},
		}),
		organization({
			ac,
			roles: appRoles,
			dynamicAccessControl: {
				enabled: true,
				maximumRolesPerOrganization: 20,
			},
			teams: {
				enabled: true,
				allowRemovingAllTeams: true,
				defaultTeam: {
					enabled: false,
				},
			},
			organizationHooks: {
				afterCreateOrganization: async ({ organization }) => {
					await ensureDefaultOrganizationRoles(organization.id);
				},
				beforeAddMember: async ({ member }) => ({
					data: {
						...member,
						role: serializeRoles(member.role),
					},
				}),
				afterAddMember: async ({ member }) => {
					await ensureCrewForMember({
						organizationId: member.organizationId,
						userId: member.userId,
						memberId: member.id,
						source: "after_add_member",
					});
					await updateSeatsInOrganizationSubscription(
						member.organizationId,
					);
				},
				afterRemoveMember: async ({ member }) => {
					await updateSeatsInOrganizationSubscription(
						member.organizationId,
					);
				},
				beforeCreateInvitation: async ({ invitation }) => ({
					data: {
						...invitation,
						role: serializeRoles(invitation.role),
					},
				}),
				beforeUpdateMemberRole: async ({ newRole }) => ({
					data: {
						role: serializeRoles(newRole),
					},
				}),
				afterAcceptInvitation: async ({ member }) => {
					await ensureCrewForMember({
						organizationId: member.organizationId,
						userId: member.userId,
						memberId: member.id,
						source: "after_accept_invitation",
					});
					await updateSeatsInOrganizationSubscription(
						member.organizationId,
					);
				},
			},
			schema: {
				organizationRole: {
					additionalFields: {
						description: {
							type: "string",
							required: false,
						},
						color: {
							type: "string",
							required: false,
							defaultValue: "#6366f1",
						},
					},
				},
			},
			sendInvitationEmail: async (
				{ email, id, organization },
				request,
			) => {
				try {
					const locale = getLocaleFromRequest(request);
					const existingUser = await getUserByEmail(email);

					const url = new URL(
						existingUser ? "/auth/login" : "/auth/signup",
						getRequestBaseUrl(request) ?? appUrl,
					);

					url.searchParams.set("invitationId", id);
					url.searchParams.set("email", email);

					await sendAuthEmail("organization_invitation", {
						to: email,
						templateId: "organizationInvitation",
						locale,
						context: {
							organizationName: organization.name,
							url: url.toString(),
						},
					});
				} catch (error) {
					logger.error("auth.organization_invitation.send_failed", {
						email,
						error,
						invitationId: id,
						organizationId: organization.id,
					});
					throw new OrganizationInvitationEmailDeliveryError({
						email,
						invitationId: id,
						organizationId: organization.id,
						cause: error,
					});
				}
			},
		}),
		openAPI(),
		invitationOnlyPlugin(),
		twoFactor(),
	],
	onAPIError: {
		errorURL: `${appUrl}/auth/error`,
		onError(error, ctx) {
			logger.error(error, { ctx });
		},
	},
});

export * from "./lib/organization";

export type Session = typeof auth.$Infer.Session;

export type ActiveOrganization = NonNullable<
	Awaited<ReturnType<typeof auth.api.getFullOrganization>>
>;

export type Organization = typeof auth.$Infer.Organization;

export type OrganizationMemberRole =
	ActiveOrganization["members"][number]["role"];

export type OrganizationInvitationStatus = typeof auth.$Infer.Invitation.status;

export type OrganizationMetadata = Record<string, unknown> | undefined;
