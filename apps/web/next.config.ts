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
	experimental: {
		exposeTestingApiInProductionBuild:
			process.env.NEXT_INSTANT_TESTS === "1",
	},
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
				source: "/app/:organizationSlug/bookings/new",
				destination: "/app/:organizationSlug/bookings/new/details",
				permanent: false,
			},
		];
	},
};

export default withNextIntl(nextConfig satisfies NextConfig);
