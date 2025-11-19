import { routing } from "@i18n/routing";
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { withQuery } from "ufo";

const intlMiddleware = createMiddleware(routing);

export default async function proxy(req: NextRequest) {
	const { pathname, hostname, origin } = req.nextUrl;

	const sessionCookie = getSessionCookie(req);

	// Determine if this is the main app subdomain
	// In production: app.example.com
	// In development: localhost or 127.0.0.1
	const isAppSubdomain =
		hostname.startsWith("app.") ||
		hostname === "localhost" ||
		hostname.startsWith("localhost:") ||
		hostname.startsWith("127.0.0.1");

	// Always allow auth routes (public on all subdomains)
	if (pathname.startsWith("/auth")) {
		return NextResponse.next();
	}

	// Protect app subdomain routes - require authentication
	if (isAppSubdomain && !sessionCookie) {
		return NextResponse.redirect(
			new URL(
				withQuery("/auth/login", {
					redirectTo: pathname,
				}),
				origin,
			),
		);
	}

	// Studio subdomains (studio-name.example.com) - public access allowed
	// These will render content from (public) route group

	// Paths that don't need locale prefix
	const pathsWithoutLocale = [
		"/onboarding",
		"/new-organization",
		"/choose-plan",
		"/organization-invitation",
	];

	if (pathsWithoutLocale.some((path) => pathname.startsWith(path))) {
		return NextResponse.next();
	}

	// Apply internationalization middleware for other routes
	return intlMiddleware(req);
}

export const config = {
	matcher: [
		"/((?!api|image-proxy|images|fonts|_next/static|_next/image|favicon.ico|icon.png|sitemap.xml|robots.txt).*)",
	],
};
