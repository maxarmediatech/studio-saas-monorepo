// Cloudflare Pages advanced mode. Serves the static site, but sends the duplicate
// hosts (the production pages.dev address and www) to https://stuwiz.com with a 301,
// so search engines only ever see one copy. Preview deployment URLs are left alone.
const CANONICAL_HOST = "stuwiz.com";
const REDIRECT_HOSTS = new Set([
	"studio-saas-monorepo.pages.dev",
	"www.stuwiz.com",
]);

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		if (REDIRECT_HOSTS.has(url.hostname)) {
			url.hostname = CANONICAL_HOST;
			url.protocol = "https:";
			url.port = "";
			return Response.redirect(url.toString(), 301);
		}
		return env.ASSETS.fetch(request);
	},
};
