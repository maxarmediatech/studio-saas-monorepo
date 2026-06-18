import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import express, { type Request, type Response } from 'express'
import type { ChatGptAppConfig } from './config'
import { StuwizClient } from './stuwiz-client'
import { registerStudioTools } from './tools/register-studio-tools'

function createMcpServer(config: ChatGptAppConfig) {
	const server = new McpServer({
		name: 'stuwiz-chatgpt-app',
		version: '0.1.0',
	})

	registerStudioTools({
		server,
		client: new StuwizClient(config),
	})

	return server
}

export function createHttpServer(config: ChatGptAppConfig) {
	const app = express()
	const transports = new Map<string, StreamableHTTPServerTransport>()

	app.use(express.json())

	app.get('/health', (_request: Request, response: Response) => {
		response.json({ ok: true, service: 'chatgpt-app' })
	})

	app.post('/mcp', async (request: Request, response: Response) => {
		try {
			const sessionId = request.headers['mcp-session-id']
			let transport: StreamableHTTPServerTransport | undefined

			if (typeof sessionId === 'string') {
				transport = transports.get(sessionId)
			} else if (isInitializeRequest(request.body)) {
				transport = new StreamableHTTPServerTransport({
					sessionIdGenerator: () => randomUUID(),
					onsessioninitialized: (newSessionId: string) => {
						if (transport) {
							transports.set(newSessionId, transport)
						}
					},
				})

				transport.onclose = () => {
					const closedSessionId = transport?.sessionId

					if (closedSessionId) {
						transports.delete(closedSessionId)
					}
				}

				const server = createMcpServer(config)
				await server.connect(transport)
			}

			if (!transport) {
				response.status(400).json({
					error: 'Invalid or missing MCP session id',
				})
				return
			}

			await transport.handleRequest(request, response, request.body)
		} catch (error) {
			if (!response.headersSent) {
				response.status(500).json({
					error: error instanceof Error ? error.message : 'Unknown MCP error',
				})
			}
		}
	})

	app.get('/mcp', async (request: Request, response: Response) => {
		const sessionId = request.headers['mcp-session-id']
		const transport =
			typeof sessionId === 'string' ? transports.get(sessionId) : null

		if (!transport) {
			response.status(400).send('Invalid or missing MCP session id')
			return
		}

		await transport.handleRequest(request, response)
	})

	app.delete('/mcp', async (request: Request, response: Response) => {
		const sessionId = request.headers['mcp-session-id']
		const transport =
			typeof sessionId === 'string' ? transports.get(sessionId) : null

		if (!transport) {
			response.status(400).send('Invalid or missing MCP session id')
			return
		}

		await transport.handleRequest(request, response)
	})

	return app
}
