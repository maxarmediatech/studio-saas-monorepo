import type { ChatGptAppConfig } from './config'

export type StuwizEntityKind =
	| 'bookings'
	| 'clients'
	| 'dashboard'
	| 'invoices'
	| 'notifications'
	| 'shoots'
	| 'tasks'

type RpcPayload = Record<string, unknown>

export class StuwizApiError extends Error {
	readonly status: number
	readonly body: string

	constructor({ status, body }: { status: number; body: string }) {
		super(`Stuwiz API request failed with status ${status}`)
		this.name = 'StuwizApiError'
		this.status = status
		this.body = body
	}
}

export class StuwizClient {
	private readonly apiBaseUrl: string
	private readonly bearerToken: string | null

	constructor(config: ChatGptAppConfig) {
		this.apiBaseUrl = config.stuwizApiBaseUrl.replace(/\/$/, '')
		this.bearerToken = config.stuwizBearerToken
	}

	async callRpc<TResponse>({
		path,
		payload = {},
	}: {
		path: string
		payload?: RpcPayload
	}) {
		const response = await fetch(`${this.apiBaseUrl}/api/rpc/${path}`, {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify(payload),
		})

		return await this.parseResponse<TResponse>(response)
	}

	async getOpenApi<TResponse>(path: string, searchParams?: RpcPayload) {
		const url = new URL(`${this.apiBaseUrl}/api/${path}`)

		for (const [key, value] of Object.entries(searchParams ?? {})) {
			if (value !== undefined && value !== null && value !== '') {
				url.searchParams.set(key, String(value))
			}
		}

		const response = await fetch(url, {
			method: 'GET',
			headers: this.getHeaders(),
		})

		return await this.parseResponse<TResponse>(response)
	}

	private getHeaders() {
		const headers: Record<string, string> = {
			accept: 'application/json',
			'content-type': 'application/json',
		}

		if (this.bearerToken) {
			headers.authorization = `Bearer ${this.bearerToken}`
		}

		return headers
	}

	private async parseResponse<TResponse>(response: Response) {
		const body = await response.text()

		if (!response.ok) {
			throw new StuwizApiError({ status: response.status, body })
		}

		if (!body) {
			return null as TResponse
		}

		return JSON.parse(body) as TResponse
	}
}
