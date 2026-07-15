import { clients, crews, sql } from "@repo/database";
import { waContacts } from "@repo/whatsapp-db";

const normalizedWaContactPhone = sql<string>`regexp_replace(coalesce(${waContacts.phoneNumber}, ''), '[^0-9]', '', 'g')`;
const normalizedWaContactId = sql<string>`regexp_replace(coalesce(${waContacts.waId}, ''), '[^0-9]', '', 'g')`;
const normalizedClientPhone = sql<string>`regexp_replace(coalesce(${clients.phoneNumber}, ''), '[^0-9]', '', 'g')`;
const normalizedClientAlternatePhone = sql<string>`regexp_replace(coalesce(${clients.alternatePhone}, ''), '[^0-9]', '', 'g')`;
const normalizedCrewPhone = sql<string>`regexp_replace(coalesce(${crews.phoneNumber}, ''), '[^0-9]', '', 'g')`;

const matchesWhatsAppContact = (normalizedPhone: ReturnType<typeof sql>) =>
	sql`${normalizedPhone} <> '' AND ${normalizedPhone} IN (${normalizedWaContactPhone}, ${normalizedWaContactId})`;

export const whatsAppClientContactExists = (search?: string) => sql`EXISTS (
	SELECT 1
	FROM ${clients}
	WHERE ${clients.organizationId} = ${waContacts.organizationId}
		AND ${clients.deletedAt} IS NULL
		${search ? sql`AND ${clients.name} ILIKE ${search}` : sql``}
		AND (
			${matchesWhatsAppContact(normalizedClientPhone)}
			OR ${matchesWhatsAppContact(normalizedClientAlternatePhone)}
		)
)`;

export const whatsAppCrewContactExists = (search?: string) => sql`EXISTS (
	SELECT 1
	FROM ${crews}
	WHERE ${crews.organizationId} = ${waContacts.organizationId}
		AND ${crews.deletedAt} IS NULL
		${search ? sql`AND ${crews.name} ILIKE ${search}` : sql``}
		AND ${matchesWhatsAppContact(normalizedCrewPhone)}
)`;
