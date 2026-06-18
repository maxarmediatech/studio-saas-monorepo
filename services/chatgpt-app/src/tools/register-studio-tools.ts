import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { StuwizApiError, type StuwizClient } from '../stuwiz-client'
import {
	normalizeStudioRecords,
	studioListOutputSchema,
	studioSummarySchema,
} from './types'

const pagingInputSchema = {
	limit: z.number().int().min(1).max(25).optional(),
	status: z.string().optional(),
}

export function registerStudioTools({
	server,
	client,
}: {
	server: McpServer
	client: StuwizClient
}) {
	server.registerTool(
		'get_studio_dashboard',
		{
			title: 'Get studio dashboard',
			description:
				'Returns high-level Stuwiz studio dashboard KPIs and operations context for the active organization.',
			inputSchema: {},
			outputSchema: {
				summary: z.array(studioSummarySchema),
			},
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				openWorldHint: false,
			},
		},
		async () => {
			try {
				const dashboard = await client.callRpc<unknown>({ path: 'dashboard/get' })
				const kpis = await client.callRpc<unknown>({ path: 'dashboard/kpis' })

				return {
					structuredContent: {
						summary: [
							{
								label: 'Dashboard',
								value: 'Ready',
								description: 'Fetched dashboard and KPI context.',
							},
						],
					},
					content: [
						{
							type: 'text' as const,
							text: 'Fetched Stuwiz dashboard context.',
						},
					],
					_meta: { dashboard, kpis },
				}
			} catch (error) {
				return toToolError(error)
			}
		},
	)

	server.registerTool(
		'search_studio',
		{
			title: 'Search studio',
			description:
				'Searches Stuwiz entities like bookings, clients, invoices, shoots, tasks, discussions, and deliverables.',
			inputSchema: {
				query: z.string().min(1),
				limit: z.number().int().min(1).max(25).optional(),
			},
			outputSchema: studioListOutputSchema.shape,
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				openWorldHint: false,
			},
		},
		async ({ query, limit = 10 }: { query: string; limit?: number }) => {
			try {
				const data = await client.callRpc<unknown>({
					path: 'globalSearch/search',
					payload: { query, limit },
				})
				const items = normalizeStudioRecords({ kind: 'search_result', data })

				return {
					structuredContent: { items },
					content: [
						{
							type: 'text' as const,
							text: `Found ${items.length} matching studio records.`,
						},
					],
					_meta: { raw: data },
				}
			} catch (error) {
				return toToolError(error)
			}
		},
	)

	registerListTool({
		server,
		client,
		name: 'list_bookings',
		title: 'List bookings',
		description: 'Lists recent Stuwiz bookings for the active organization.',
		kind: 'booking',
		path: 'bookings/list',
	})

	registerListTool({
		server,
		client,
		name: 'list_invoices',
		title: 'List invoices',
		description: 'Lists recent Stuwiz invoices for the active organization.',
		kind: 'invoice',
		path: 'invoices/list',
	})

	registerListTool({
		server,
		client,
		name: 'list_tasks',
		title: 'List tasks',
		description: 'Lists recent Stuwiz tasks for the active organization.',
		kind: 'task',
		path: 'tasks/list',
	})
}

function registerListTool({
	server,
	client,
	name,
	title,
	description,
	kind,
	path,
}: {
	server: McpServer
	client: StuwizClient
	name: string
	title: string
	description: string
	kind: string
	path: string
}) {
	server.registerTool(
		name,
		{
			title,
			description,
			inputSchema: pagingInputSchema,
			outputSchema: studioListOutputSchema.shape,
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				openWorldHint: false,
			},
		},
		async ({
			limit = 10,
			status,
		}: {
			limit?: number
			status?: string
		}) => {
			try {
				const data = await client.callRpc<unknown>({
					path,
					payload: { limit, status },
				})
				const items = normalizeStudioRecords({ kind, data })

				return {
					structuredContent: { items },
					content: [
						{
							type: 'text' as const,
							text: `Found ${items.length} ${kind} records.`,
						},
					],
					_meta: { raw: data },
				}
			} catch (error) {
				return toToolError(error)
			}
		},
	)
}

function toToolError(error: unknown) {
	if (error instanceof StuwizApiError && error.status === 401) {
		return {
			content: [
				{
					type: 'text' as const,
					text: 'Connect your Stuwiz account before using this tool.',
				},
			],
			_meta: {
				'mcp/www_authenticate': 'Bearer realm="Stuwiz"',
			},
		}
	}

	const message = error instanceof Error ? error.message : 'Unknown Stuwiz error'

	return {
		content: [{ type: 'text' as const, text: message }],
		isError: true,
	}
}
