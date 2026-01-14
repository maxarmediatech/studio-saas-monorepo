import { config as appConfig } from "@repo/config";
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { withQuery } from "ufo";

export default async function middleware(req: NextRequest) {
	const { pathname, origin } = req.nextUrl;

	const sessionCookie = getSessionCookie(req);

	if (pathname.startsWith("/app")) {
		if (!appConfig.ui.saas.enabled) {
			return NextResponse.redirect(new URL("/", origin));
		}

		if (!sessionCookie) {
			return NextResponse.redirect(
				new URL(
					withQuery("/auth/login", {
						redirectTo: pathname,
					}),
					origin,
				),
			);
		}

		if (pathname === "/app" || pathname === "/app/") {
			const activeOrganizationSlug = req.cookies.get(
				"activeOrganizationSlug",
			)?.value;

			if (activeOrganizationSlug) {
				return NextResponse.redirect(
					new URL(
						`/app/${activeOrganizationSlug}/home`,
						origin,
					),
				);
			}
		}

		return NextResponse.next();
	}

	if (pathname.startsWith("/auth")) {
		if (!appConfig.ui.saas.enabled) {
			return NextResponse.redirect(new URL("/", origin));
		}

		return NextResponse.next();
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		"/((?!api|images|fonts|_next/static|_next/image|favicon.ico|icon.png|sitemap.xml|robots.txt).*)",
	],
};
