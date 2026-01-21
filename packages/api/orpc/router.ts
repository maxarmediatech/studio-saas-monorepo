import type { RouterClient } from "@orpc/server";
import { activitiesRouter } from "../modules/activities/router";
import { adminRouter } from "../modules/admin/router";
import { bookingsRouter } from "../modules/bookings/router";
import { clientsRouter } from "../modules/clients/router";
import { configurationsRouter } from "../modules/configurations/router";
import { contactRouter } from "../modules/contact/router";
import { crewsRouter } from "../modules/crews/router";
import { dashboardRouter } from "../modules/dashboard/router";
import { deliverablesRouter } from "../modules/deliverables/router";
import { discussionsRouter } from "../modules/discussions/router";
import { expensesRouter } from "../modules/expenses/router";
import { globalSearchRouter } from "../modules/global-search/router";
import { myAssignmentsRouter } from "../modules/my-assignments/router";
import { newsletterRouter } from "../modules/newsletter/router";
import { notificationsRouter } from "../modules/notifications/router";
import { organizationsRouter } from "../modules/organizations/router";
import { paymentsRouter } from "../modules/payments/router";
import { quickLinksRouter } from "../modules/quick-links/router";
import { recentVisitsRouter } from "../modules/recent-visits/router";
import { savedViewsRouter } from "../modules/saved-views/router";
import { shootsRouter } from "../modules/shoots/router";
import { stickiesRouter } from "../modules/stickies/router";
import { studioPaymentsRouter } from "../modules/studio-payments/router";
import { submissionsRouter } from "../modules/submissions/router";
import { tasksRouter } from "../modules/tasks/router";
import { usersRouter } from "../modules/users/router";
import { yourWorkRouter } from "../modules/your-work/router";
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
		bookings: bookingsRouter,
		shoots: shootsRouter,
		tasks: tasksRouter,
		deliverables: deliverablesRouter,
		studioPayments: studioPaymentsRouter,
		expenses: expensesRouter,
		globalSearch: globalSearchRouter,

		// Discussions
		discussions: discussionsRouter,

		// Support routers
		dashboard: dashboardRouter,
		submissions: submissionsRouter,
		myAssignments: myAssignmentsRouter,
		yourWork: yourWorkRouter,
		savedViews: savedViewsRouter,
		recentVisits: recentVisitsRouter,
		quickLinks: quickLinksRouter,
		stickies: stickiesRouter,
		activities: activitiesRouter,
		notifications: notificationsRouter,
	});

export type ApiRouterClient = RouterClient<typeof router>;
