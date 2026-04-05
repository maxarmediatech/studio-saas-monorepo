import type { Config } from "./types";

export const config = {
	appName: "Lumen",
	// Internationalization
	i18n: {
		// Whether internationalization should be enabled (if disabled, you still need to define the locale you want to use below and set it as the default locale)
		enabled: true,
		// Define all locales here that should be available in the app
		// You need to define a label that is shown in the language selector and a currency that should be used for pricing with this locale
		locales: {
			en: {
				currency: "INR",
				label: "English",
			},
			de: {
				currency: "INR",
				label: "Deutsch",
			},
		},
		// The default locale is used if no locale is provided
		defaultLocale: "en",
		// The default currency is used for pricing if no currency is provided
		defaultCurrency: "INR",
		// The name of the cookie that is used to determine the locale
		localeCookieName: "NEXT_LOCALE",
	},
	// Organizations
	organizations: {
		// Whether organizations are enabled in general
		enable: true,
		// Whether billing for organizations should be enabled (below you can enable it for users instead)
		enableBilling: true,
		// Whether the organization should be hidden from the user (use this for multi-tenant applications)
		hideOrganization: false,
		// Should users be able to create new organizations? Otherwise only admin users can create them
		enableUsersToCreateOrganizations: true,
		// Whether users should be required to be in an organization. This will redirect users to the organization page after sign in
		requireOrganization: true,
		// Define forbidden organization slugs. Make sure to add all paths that you define as a route after /app/... to avoid routing issues
		forbiddenOrganizationSlugs: [
			"new-organization",
			"admin",
			"settings",
			"ai-demo",
			"organization-invitation",
			"onboarding",
			"choose-plan",
			"dashboard",
			"share",
		],
	},
	// Users
	users: {
		// Whether billing should be enabled for users (above you can enable it for organizations instead)
		enableBilling: false,
		// Whether you want the user to go through an onboarding form after signup (can be defined in the OnboardingForm.tsx)
		enableOnboarding: true,
	},
	// Authentication
	auth: {
		// App-wide admin access allowlist. Only these user IDs can access /app/admin and admin APIs.
		platformAdminUserIds: ["019b4b90-7eeb-7498-b687-0c2594d68a1e"],
		// Whether users should be able to create accounts (otherwise users can only be by admins)
		enableSignup: true,
		// Whether users should be able to sign in with a magic link
		enableMagicLink: true,
		// Whether users should be able to sign in with a social provider
		enableSocialLogin: true,
		// Whether users should be able to sign in with a passkey
		enablePasskeys: false,
		// Whether users should be able to sign in with a password
		enablePasswordLogin: true,
		// Whether users should be activate two factor authentication
		enableTwoFactor: true,
		// where users should be redirected after the sign in
		redirectAfterSignIn: "/app",
		// where users should be redirected after logout
		redirectAfterLogout: "/",
		// how long a session should be valid
		sessionCookieMaxAge: 60 * 60 * 24 * 30,
	},
	// Mails
	mails: {
		// the from address for mails
		from: process.env.EMAIL_FROM ?? "noreply@updates.stuwiz.com",
	},
	// Frontend
	ui: {
		// the themes that should be available in the app
		enabledThemes: ["light"],
		// the default theme
		defaultTheme: "light",
		// the saas part of the application
		saas: {
			// whether the saas part should be enabled (otherwise all routes will be redirect to the marketing page)
			enabled: true,
			// whether the sidebar layout should be used
			useSidebarLayout: true,
		},
		// the marketing part of the application
		marketing: {
			// whether the marketing features should be enabled (otherwise all routes will be redirect to the saas part)
			enabled: false,
		},
		// developer tools (only active in development mode)
		devTools: {
			// shows render boundaries (static/dynamic/hybrid) - useful for Next.js 16 cache debugging
			enableBoundaryVisualization: true,
		},
	},
	// Storage
	storage: {
		// define the name of the buckets for the different types of files
		bucketNames: {
			uploads: "uploads",
		},
	},
	contactForm: {
		// whether the contact form should be enabled
		enabled: true,
		// the email to which the contact form messages should be sent
		to: "hello@your-domain.com",
		// the subject of the email
		subject: "Contact form message",
	},
	// Payments
	payments: {
		// client-safe pricing metadata
		plans: {
			"studio-basics": {
				recommended: true,
				prices: [
					{
						type: "recurring",
						priceKey: "studio-basics-monthly",
						interval: "month",
						amount: 999,
						currency: "INR",
					},
					{
						type: "recurring",
						priceKey: "studio-basics-yearly",
						interval: "year",
						amount: 9990,
						currency: "INR",
					},
				],
			},
			"studio-advance": {
				comingSoon: true,
			},
		},
	},
} as const satisfies Config;

export type { Config };
