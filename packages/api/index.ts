import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { auth } from "@repo/auth";
import { config } from "@repo/config";
import {
	and,
	crews,
	db,
	eq,
	googleCalendarConnections,
	isNull,
	organizations,
} from "@repo/database";
import {
	createSignedGoogleOAuthState,
	decryptToken,
	encryptToken,
	exchangeGoogleCalendarCode,
	fetchGoogleAccountEmail,
	getGoogleCalendarAuthUrl,
	getGoogleCalendarEnv,
	revokeGoogleToken,
	verifySignedGoogleOAuthState,
} from "@repo/google-calendar";
import { logger } from "@repo/logs";
import { webhookHandler as paymentsWebhookHandler } from "@repo/payments";
import { getBaseUrl } from "@repo/utils";
import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { mergeOpenApiSchemas } from "./lib/openapi-schema";
import { reconcileCalendarDeliveries } from "./modules/shoots/lib/calendar-delivery";
import {
	handleCloudWebhook,
	verifyCloudWebhook,
} from "./modules/whatsapp/webhook-handler";
import { openApiHandler, rpcHandler } from "./orpc/handler";
import { router } from "./orpc/router";

export const app = new Hono()
	.basePath("/api")
	// Logger middleware
	.use(honoLogger((message, ...rest) => logger.log(message, ...rest)))
	// Cors middleware
	.use(
		cors({
			origin: getBaseUrl(),
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["POST", "GET", "OPTIONS"],
			exposeHeaders: ["Content-Length"],
			maxAge: 600,
			credentials: true,
		}),
	)
	// Auth handler
	.on(["POST", "GET"], "/auth/**", (c) => auth.handler(c.req.raw))
	// OpenAPI schema endpoint
	.get("/openapi", async (c) => {
		const authSchema = await auth.api.generateOpenAPISchema();

		const appSchema = await new OpenAPIGenerator({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}).generate(router, {
			info: {
				title: `${config.appName} API`,
				version: "1.0.0",
			},
			servers: [
				{
					url: getBaseUrl(),
					description: "API server",
				},
			],
		});

		const mergedSchema = mergeOpenApiSchemas({
			authSchema: authSchema as any,
			appSchema: appSchema as any,
		});

		return c.json(mergedSchema);
	})
	.get("/orpc-openapi", async (c) => {
		const appSchema = await new OpenAPIGenerator({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}).generate(router, {
			info: {
				title: `${config.appName} API`,
				version: "1.0.0",
			},
		});

		return c.json(appSchema);
	})
	// Scalar API reference based on OpenAPI schema
	.get(
		"/docs",
		Scalar({
			theme: "saturn",
			url: "/api/openapi",
		}),
	)
	.get("/webhooks/whatsapp/:token", (c) =>
		verifyCloudWebhook({
			token: c.req.param("token"),
			mode: c.req.query("hub.mode"),
			verifyToken: c.req.query("hub.verify_token"),
			challenge: c.req.query("hub.challenge"),
		}),
	)
	.post("/webhooks/whatsapp/:token", (c) =>
		handleCloudWebhook(c.req.raw, c.req.param("token")),
	)
	// Payments webhook handler
	.post("/webhooks/payments", (c) => paymentsWebhookHandler(c.req.raw))
	// Google Calendar integration (crew-level OAuth)
	.get("/integrations/google-calendar/connect", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.redirect("/auth/login");
		}

		const organizationId = session.session.activeOrganizationId;
		if (!organizationId) {
			return c.text("No active organization", 403);
		}

		const env = getGoogleCalendarEnv();
		const state = createSignedGoogleOAuthState(
			{ organizationId, userId: session.user.id },
			env.stateSigningSecret,
		);
		const authUrl = getGoogleCalendarAuthUrl({
			config: {
				clientId: env.clientId,
				clientSecret: env.clientSecret,
				redirectUri: env.redirectUri,
			},
			state,
		});

		return c.redirect(authUrl);
	})
	.get("/integrations/google-calendar/callback", async (c) => {
		const code = c.req.query("code");
		const state = c.req.query("state");
		const error = c.req.query("error");

		if (error) {
			logger.warn("Google Calendar OAuth error", { error });
			return c.text("Google Calendar connection cancelled", 400);
		}
		if (!code || !state) {
			return c.text("Missing OAuth code/state", 400);
		}

		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.redirect("/auth/login");
		}

		const organizationId = session.session.activeOrganizationId;
		if (!organizationId) {
			return c.text("No active organization", 403);
		}

		const env = getGoogleCalendarEnv();
		const statePayload = verifySignedGoogleOAuthState(
			state,
			env.stateSigningSecret,
			env.maxStateAgeSeconds,
		);

		if (
			statePayload.userId !== session.user.id ||
			statePayload.organizationId !== organizationId
		) {
			return c.text("OAuth state mismatch", 400);
		}

		const tokenResponse = await exchangeGoogleCalendarCode({
			config: {
				clientId: env.clientId,
				clientSecret: env.clientSecret,
				redirectUri: env.redirectUri,
			},
			code,
		});

		if (!tokenResponse.refreshToken) {
			return c.text(
				"Google did not return a refresh token. Please try connecting again.",
				400,
			);
		}

		const accessToken = tokenResponse.accessToken;
		const googleAccountEmail = accessToken
			? await fetchGoogleAccountEmail({
					config: {
						clientId: env.clientId,
						clientSecret: env.clientSecret,
						redirectUri: env.redirectUri,
					},
					accessToken,
				})
			: null;

		await db
			.insert(googleCalendarConnections)
			.values({
				organizationId,
				userId: session.user.id,
				googleAccountEmail: googleAccountEmail ?? null,
				accessToken: accessToken ? encryptToken(accessToken) : null,
				refreshToken: encryptToken(tokenResponse.refreshToken),
				scope: tokenResponse.scope ?? null,
				accessTokenExpiresAt: tokenResponse.accessTokenExpiresAt,
				disconnectedAt: null,
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: [
					googleCalendarConnections.organizationId,
					googleCalendarConnections.userId,
				],
				set: {
					googleAccountEmail: googleAccountEmail ?? null,
					accessToken: accessToken ? encryptToken(accessToken) : null,
					refreshToken: encryptToken(tokenResponse.refreshToken),
					scope: tokenResponse.scope ?? null,
					accessTokenExpiresAt: tokenResponse.accessTokenExpiresAt,
					disconnectedAt: null,
					updatedAt: new Date(),
				},
			});

		// Reconcile calendar delivery for this crew after Google is connected.
		const crew = await db.query.crews.findFirst({
			where: and(
				eq(crews.organizationId, organizationId),
				eq(crews.userId, session.user.id),
				isNull(crews.deletedAt),
			),
			columns: { id: true },
		});

		if (crew) {
			const org = await db.query.organizations.findFirst({
				where: eq(organizations.id, organizationId),
				columns: { slug: true },
			});
			await reconcileCalendarDeliveries({
				organizationId,
				crewId: crew.id,
				apply: true,
			});

			if (org?.slug) {
				return c.redirect(
					`${getBaseUrl()}/app/${org.slug}/settings/integrations?googleCalendar=connected`,
				);
			}
		}

		return c.redirect(`${getBaseUrl()}/app`);
	})
	.get("/integrations/google-calendar/status", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.json({ connected: false }, 401);
		}
		const organizationId = session.session.activeOrganizationId;
		if (!organizationId) {
			return c.json({ connected: false }, 403);
		}

		const connection = await db.query.googleCalendarConnections.findFirst({
			where: and(
				eq(googleCalendarConnections.organizationId, organizationId),
				eq(googleCalendarConnections.userId, session.user.id),
				isNull(googleCalendarConnections.disconnectedAt),
			),
			columns: {
				googleAccountEmail: true,
				refreshToken: true,
			},
		});

		return c.json({
			connected: Boolean(connection?.refreshToken),
			googleAccountEmail: connection?.googleAccountEmail ?? null,
		});
	})
	.post("/integrations/google-calendar/disconnect", async (c) => {
		const session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
		if (!session) {
			return c.json({ ok: false }, 401);
		}
		const organizationId = session.session.activeOrganizationId;
		if (!organizationId) {
			return c.json({ ok: false }, 403);
		}

		const connection = await db.query.googleCalendarConnections.findFirst({
			where: and(
				eq(googleCalendarConnections.organizationId, organizationId),
				eq(googleCalendarConnections.userId, session.user.id),
				isNull(googleCalendarConnections.disconnectedAt),
			),
		});

		if (!connection) {
			return c.json({ ok: true });
		}

		try {
			const env = getGoogleCalendarEnv();
			const tokenToRevoke = connection.accessToken
				? decryptToken(connection.accessToken)
				: connection.refreshToken
					? decryptToken(connection.refreshToken)
					: null;

			if (tokenToRevoke) {
				await revokeGoogleToken({
					config: {
						clientId: env.clientId,
						clientSecret: env.clientSecret,
						redirectUri: env.redirectUri,
					},
					token: tokenToRevoke,
				});
			}
		} catch (error) {
			logger.warn("Failed to revoke Google Calendar token", {
				error: error instanceof Error ? error.message : String(error),
			});
		}

		await db
			.update(googleCalendarConnections)
			.set({
				disconnectedAt: new Date(),
				accessToken: null,
				refreshToken: null,
				scope: null,
				accessTokenExpiresAt: null,
				updatedAt: new Date(),
			})
			.where(eq(googleCalendarConnections.id, connection.id));

		return c.json({ ok: true });
	})
	// Health check
	.get("/health", (c) => c.text("OK"))
	// oRPC handlers (for RPC and OpenAPI)
	.use("*", async (c, next) => {
		const context = {
			headers: c.req.raw.headers,
		};

		const isRpc = c.req.path.includes("/rpc/");

		const handler = isRpc ? rpcHandler : openApiHandler;

		const prefix = isRpc ? "/api/rpc" : "/api";

		const { matched, response } = await handler.handle(c.req.raw, {
			prefix,
			context,
		});

		if (matched) {
			// Forward the response directly to avoid re-locking the body stream
			return response;
		}

		await next();
	});
