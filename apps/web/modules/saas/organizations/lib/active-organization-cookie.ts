const COOKIE_NAME = "activeOrganizationSlug";

export function setActiveOrganizationSlugCookie(
	organizationSlug: string | null,
) {
	if (typeof document === "undefined") {
		return;
	}

	if (!organizationSlug) {
		document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
		return;
	}

	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
		organizationSlug,
	)}; Path=/; SameSite=Lax${secure}`;
}
