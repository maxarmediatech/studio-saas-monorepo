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
	transpilePackages: ["@repo/api", "@repo/auth", "@repo/database"],
	images: {
		remotePatterns: imageRemotePatterns,
	},
	async redirects() {
		return [
			{
				source: "/app/settings",
				destination: "/app/settings/general",
				permanent: true,
			},
			{
				source: "/app/admin",
				destination: "/app/admin/users",
				permanent: true,
			},
		];
	},
};

export default withNextIntl(nextConfig satisfies NextConfig);
