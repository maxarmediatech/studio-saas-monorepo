const LOCAL_HOSTNAMES = new Set([
	"localhost",
	"127.0.0.1",
	"0.0.0.0",
	"::1",
	"[::1]",
]);

const PRIVATE_HOSTNAMES = new Set(["host.docker.internal"]);
const PRIVATE_HOSTNAME_SUFFIXES = [".internal"];
type HeaderBag = Headers | Record<string, unknown> | undefined;
type RequestLike =
	| Request
	| {
			request?: Request;
			url?: string;
			headers?: HeaderBag;
	  }
	| undefined;

function normalizeBaseUrl(value: string) {
	const url = new URL(value);
	url.search = "";
	url.hash = "";
	url.pathname = url.pathname.endsWith("/")
		? url.pathname
		: `${url.pathname}/`;
	return url.toString();
}

function isLocalhostUrl(value: string) {
	return LOCAL_HOSTNAMES.has(new URL(value).hostname);
}

function normalizeHostname(hostname: string) {
	return hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
}

function isIpv4Hostname(hostname: string) {
	return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function isInternalDnsHostname(hostname: string) {
	if (hostname.includes(":") || isIpv4Hostname(hostname)) {
		return false;
	}

	return (
		!hostname.includes(".") ||
		PRIVATE_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
	);
}

function isPrivateIpv4Hostname(hostname: string) {
	if (!isIpv4Hostname(hostname)) {
		return false;
	}

	const octets = hostname.split(".").map((part) => Number(part));

	if (octets.some((octet) => Number.isNaN(octet) || octet > 255)) {
		return false;
	}

	const [first, second] = octets;

	return (
		first === 10 ||
		first === 127 ||
		first === 0 ||
		(first === 169 && second === 254) ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 168) ||
		(first === 100 && second >= 64 && second <= 127)
	);
}

function isPrivateIpv6Hostname(hostname: string) {
	const normalized = normalizeHostname(hostname);

	if (!normalized.includes(":")) {
		return false;
	}

	if (
		normalized === "::" ||
		normalized === "::1" ||
		normalized === "0:0:0:0:0:0:0:1"
	) {
		return true;
	}

	const firstSegment = normalized.split(":")[0];

	if (!firstSegment || !/^[0-9a-f]+$/i.test(firstSegment)) {
		return false;
	}

	const firstHextet = Number.parseInt(firstSegment, 16);

	if (Number.isNaN(firstHextet)) {
		return false;
	}

	return (
		(firstHextet & 0xfe00) === 0xfc00 || (firstHextet & 0xffc0) === 0xfe80
	);
}

function isPrivateNetworkUrl(value: string) {
	const hostname = normalizeHostname(new URL(value).hostname);

	return (
		PRIVATE_HOSTNAMES.has(hostname) ||
		isInternalDnsHostname(hostname) ||
		hostname.endsWith(".local") ||
		isPrivateIpv4Hostname(hostname) ||
		isPrivateIpv6Hostname(hostname)
	);
}

function getFallbackBaseUrl() {
	if (process.env.NEXT_PUBLIC_SITE_URL) {
		return process.env.NEXT_PUBLIC_SITE_URL;
	}
	if (process.env.NEXT_PUBLIC_VERCEL_URL) {
		return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
	}
	return `http://localhost:${process.env.PORT ?? 3000}`;
}

function getConfiguredPublicBaseUrl(kind: "app" | "asset") {
	if (kind === "asset") {
		return (
			process.env.EMAIL_ASSET_BASE_URL ??
			process.env.EMAIL_BASE_URL ??
			process.env.NEXT_PUBLIC_SITE_URL ??
			(process.env.NEXT_PUBLIC_VERCEL_URL
				? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
				: undefined)
		);
	}

	return (
		process.env.EMAIL_BASE_URL ??
		process.env.NEXT_PUBLIC_SITE_URL ??
		(process.env.NEXT_PUBLIC_VERCEL_URL
			? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
			: undefined)
	);
}

function getValidatedPublicBaseUrl({
	kind,
	allowLocalhost = process.env.NODE_ENV === "test",
}: {
	kind: "app" | "asset";
	allowLocalhost?: boolean;
}) {
	const configured = getConfiguredPublicBaseUrl(kind);

	if (!configured) {
		if (allowLocalhost) {
			return normalizeBaseUrl(getFallbackBaseUrl());
		}

		throw new Error(
			`Missing public email ${kind} URL. Set ${
				kind === "asset" ? "EMAIL_ASSET_BASE_URL" : "EMAIL_BASE_URL"
			} or NEXT_PUBLIC_SITE_URL.`,
		);
	}

	const normalized = normalizeBaseUrl(configured);

	if (!allowLocalhost && isLocalhostUrl(normalized)) {
		throw new Error(
			`Email ${kind} URLs must be public. Set ${
				kind === "asset" ? "EMAIL_ASSET_BASE_URL" : "EMAIL_BASE_URL"
			} to your public Stuwiz domain instead of localhost.`,
		);
	}

	if (!allowLocalhost && isPrivateNetworkUrl(normalized)) {
		throw new Error(
			`Email ${kind} URLs must be public. Set ${
				kind === "asset" ? "EMAIL_ASSET_BASE_URL" : "EMAIL_BASE_URL"
			} to your public Stuwiz domain instead of a private network host.`,
		);
	}

	return normalized;
}

function getRequestHeaders(request?: RequestLike) {
	if (request instanceof Request) {
		return request.headers;
	}

	if (request?.request instanceof Request) {
		return request.request.headers;
	}

	return request?.headers;
}

function getRequestUrl(request?: RequestLike) {
	if (request instanceof Request) {
		return request.url;
	}

	if (request?.request instanceof Request) {
		return request.request.url;
	}

	return typeof request?.url === "string" ? request.url : undefined;
}

function getHeader(headers: HeaderBag, name: string) {
	if (!headers) {
		return null;
	}

	if (typeof (headers as Headers).get === "function") {
		return (headers as Headers).get(name);
	}

	const normalizedName = name.toLowerCase();
	const record = headers as Record<string, unknown>;
	const normalizedValue = record[normalizedName];
	if (typeof normalizedValue === "string") {
		return normalizedValue;
	}
	if (normalizedValue === null) {
		return null;
	}

	const exactValue = record[name];
	return typeof exactValue === "string"
		? exactValue
		: exactValue === null
			? null
			: null;
}

function getPrimaryHeaderValue(headers: HeaderBag, name: string) {
	const value = getHeader(headers, name);
	return value?.split(",")[0]?.trim() || null;
}

function normalizeProtocol(value: string | null | undefined) {
	return value?.replace(/:$/, "").toLowerCase() || null;
}

function isDefaultPort(protocol: string, port: string) {
	return (
		(protocol === "https" && port === "443") ||
		(protocol === "http" && port === "80")
	);
}

function normalizeMaybeUrl(value: string) {
	try {
		return normalizeBaseUrl(value);
	} catch {
		return null;
	}
}

export function getBaseUrl() {
	return normalizeBaseUrl(getFallbackBaseUrl());
}

export function getPublicBaseUrl(options?: { allowLocalhost?: boolean }) {
	return getValidatedPublicBaseUrl({
		kind: "app",
		allowLocalhost: options?.allowLocalhost,
	});
}

export function getPublicAssetBaseUrl(options?: { allowLocalhost?: boolean }) {
	return getValidatedPublicBaseUrl({
		kind: "asset",
		allowLocalhost: options?.allowLocalhost,
	});
}

export function getRequestBaseUrl(request?: RequestLike) {
	const headers = getRequestHeaders(request);
	const requestUrl = getRequestUrl(request);
	const requestProtocol = requestUrl
		? normalizeProtocol(new URL(requestUrl).protocol)
		: null;
	const forwardedProtocol =
		normalizeProtocol(
			getPrimaryHeaderValue(headers, "x-forwarded-proto"),
		) ??
		normalizeProtocol(
			getPrimaryHeaderValue(headers, "x-forwarded-protocol"),
		) ??
		(getPrimaryHeaderValue(headers, "x-forwarded-ssl") === "on"
			? "https"
			: null);
	const forwardedHost = getPrimaryHeaderValue(headers, "x-forwarded-host");
	const forwardedPort = getPrimaryHeaderValue(headers, "x-forwarded-port");

	if (forwardedHost && (forwardedProtocol ?? requestProtocol)) {
		const protocol = forwardedProtocol ?? requestProtocol ?? "http";
		const host = forwardedPort
			? forwardedHost.includes(":") ||
				isDefaultPort(protocol, forwardedPort)
				? forwardedHost
				: `${forwardedHost}:${forwardedPort}`
			: forwardedHost;
		const forwardedBaseUrl = normalizeMaybeUrl(`${protocol}://${host}`);

		if (forwardedBaseUrl) {
			return forwardedBaseUrl;
		}
	}

	if (requestUrl) {
		const requestBaseUrl = normalizeMaybeUrl(new URL(requestUrl).origin);

		if (requestBaseUrl) {
			return requestBaseUrl;
		}
	}

	const host = getPrimaryHeaderValue(headers, "host");
	if (host) {
		const protocol = forwardedProtocol ?? requestProtocol ?? "http";
		const hostBaseUrl = normalizeMaybeUrl(`${protocol}://${host}`);

		if (hostBaseUrl) {
			return hostBaseUrl;
		}
	}

	return undefined;
}

export function toRequestAppUrl(
	value: string,
	request?: RequestLike,
	fallbackBaseUrl = getBaseUrl(),
) {
	const baseUrl =
		getRequestBaseUrl(request) ?? normalizeBaseUrl(fallbackBaseUrl);
	const parsedValue = (() => {
		try {
			return new URL(value);
		} catch {
			return new URL(value, baseUrl);
		}
	})();

	// Auth email buttons should follow the app origin that issued the request.
	return new URL(
		`${parsedValue.pathname}${parsedValue.search}${parsedValue.hash}`,
		baseUrl,
	).toString();
}

export function toPublicAppUrl(
	value: string,
	options?: { allowLocalhost?: boolean },
) {
	const baseUrl = getPublicBaseUrl(options);
	const parsedValue = (() => {
		try {
			return new URL(value);
		} catch {
			return new URL(value, baseUrl);
		}
	})();

	const publicUrl = new URL(
		`${parsedValue.pathname}${parsedValue.search}${parsedValue.hash}`,
		baseUrl,
	);

	return publicUrl.toString();
}
