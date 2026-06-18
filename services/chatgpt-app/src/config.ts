export type ChatGptAppConfig = {
	port: number
	stuwizApiBaseUrl: string
	stuwizBearerToken: string | null
	widgetDomain: string
}

function optionalEnv(name: string) {
	const value = process.env[name]

	return value && value.trim().length > 0 ? value : null
}

function requiredEnv(name: string, fallback?: string) {
	const value = optionalEnv(name) ?? fallback

	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`)
	}

	return value
}

export function getConfig(): ChatGptAppConfig {
	return {
		port: Number(optionalEnv('CHATGPT_APP_PORT') ?? '8787'),
		stuwizApiBaseUrl: requiredEnv(
			'STUWIZ_API_BASE_URL',
			'http://localhost:3000',
		),
		stuwizBearerToken: optionalEnv('STUWIZ_MCP_BEARER_TOKEN'),
		widgetDomain: requiredEnv(
			'CHATGPT_APP_WIDGET_DOMAIN',
			'http://localhost:8787',
		),
	}
}
