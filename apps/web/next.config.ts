import type { NextConfig } from "next";
import nextIntlPlugin from "next-intl/plugin";

const withNextIntl = nextIntlPlugin("./modules/i18n/request.ts");

type RemotePattern = {
	protocol?: "http" | "https";
	hostname: string;
	port?: string;
	pathname?: string;
};

const imageRemotePatterns: RemotePattern[] = [
	{
		// google profile images
		protocol: "https",
		hostname: "lh3.googleusercontent.com",
	},
	{
		// github profile images
		protocol: "https",
		hostname: "avatars.githubusercontent.com",
	},
	{
		// dicebear avatars used in dashboard mocks
		protocol: "https",
		hostname: "api.dicebear.com",
	},
];

const nextConfig = {
	cacheComponents: true,
	reactCompiler: true,
	transpilePackages: [
		"@repo/api",
		"@repo/auth",
		"@repo/database",
		"@repo/editor",
		"@repo/google-calendar",
		"@repo/mail",
		"@repo/utils",
	],
	images: {
		remotePatterns: imageRemotePatterns,
	},
	async redirects() {
		return [
			{
				source: "/admin",
				destination: "/admin/users",
				permanent: false,
			},
			{
				source: "/app/admin",
				destination: "/admin/users",
				permanent: false,
			},
			{
				source: "/app/admin/:path*",
				destination: "/admin/:path*",
				permanent: false,
			},
			{
				source: "/app/:organizationSlug",
				destination: "/app/:organizationSlug/home",
				permanent: false,
			},
			{
				source: "/app/:organizationSlug/bookings/new",
				destination: "/app/:organizationSlug/bookings/new/details",
				permanent: false,
			},
			{
				source: "/app/:organizationSlug/configurations",
				destination:
					"/app/:organizationSlug/configurations/booking-types",
				permanent: false,
			},
			{
				source: "/app/:organizationSlug/crews",
				destination: "/app/:organizationSlug/people",
				permanent: false,
			},
			{
				source: "/app/:organizationSlug/crews/:crewId",
				destination: "/app/:organizationSlug/people/:crewId",
				permanent: false,
			},
			{
				source: "/app/:organizationSlug/settings/members",
				destination:
					"/app/:organizationSlug/settings/people?view=members",
				permanent: false,
			},
		];
	},
};

export default withNextIntl(nextConfig satisfies NextConfig);
