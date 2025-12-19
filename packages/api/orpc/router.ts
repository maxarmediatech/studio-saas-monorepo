import type { RouterClient } from "@orpc/server";
import { adminRouter } from "../modules/admin/router";
import { clientsRouter } from "../modules/clients/router";
import { configurationsRouter } from "../modules/configurations/router";
import { contactRouter } from "../modules/contact/router";
import { crewsRouter } from "../modules/crews/router";
import { newsletterRouter } from "../modules/newsletter/router";
import { organizationsRouter } from "../modules/organizations/router";
import { paymentsRouter } from "../modules/payments/router";
import { usersRouter } from "../modules/users/router";
import { publicProcedure } from "./procedures";

export const router = publicProcedure
	// Prefix for openapi
	.prefix("/api")
	.router({
		admin: adminRouter,
		newsletter: newsletterRouter,
		contact: contactRouter,
		organizations: organizationsRouter,
		users: usersRouter,
		payments: paymentsRouter,

		// Studio domain routers
		configurations: configurationsRouter,
		clients: clientsRouter,
		crews: crewsRouter,
	});

export type ApiRouterClient = RouterClient<typeof router>;
