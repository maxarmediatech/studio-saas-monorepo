import { z } from 'zod'

export const studioSummarySchema = z.object({
	label: z.string(),
	value: z.union([z.string(), z.number()]),
	description: z.string().optional(),
})

export const studioRecordSchema = z.object({
	id: z.string(),
	title: z.string(),
	kind: z.string(),
	status: z.string().optional(),
	url: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
})

export const studioListOutputSchema = z.object({
	items: z.array(studioRecordSchema),
	summary: z.array(studioSummarySchema).optional(),
})

export type StudioRecord = z.infer<typeof studioRecordSchema>

export function normalizeStudioRecords({
	kind,
	data,
}: {
	kind: string
	data: unknown
}): Array<StudioRecord> {
	const items = extractItems(data)

	return items.slice(0, 25).map((item, index) => {
		const record = item as Record<string, unknown>
		const id = String(record.id ?? record.bookingId ?? record.invoiceId ?? index)
		const title = String(
			record.title ??
				record.name ??
				record.clientName ??
				record.invoiceNumber ??
				`${kind} ${index + 1}`,
		)
		const status = record.status ? String(record.status) : undefined

		return {
			id,
			title,
			kind,
			status,
			metadata: record,
		}
	})
}

function extractItems(data: unknown): Array<unknown> {
	if (Array.isArray(data)) {
		return data
	}

	if (!data || typeof data !== 'object') {
		return []
	}

	const record = data as Record<string, unknown>
	const candidates = ['items', 'data', 'results', 'bookings', 'invoices', 'tasks']

	for (const key of candidates) {
		const value = record[key]

		if (Array.isArray(value)) {
			return value
		}
	}

	return [data]
}
