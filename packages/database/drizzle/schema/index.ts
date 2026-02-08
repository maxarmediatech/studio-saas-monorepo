// Enums (must be first as other files depend on them)

// WhatsApp tables (re-exported from @repo/whatsapp-db for db.query.* access)
// The source of truth is @repo/whatsapp-db - this is just a convenience re-export
export * from "@repo/whatsapp-db";
// Auth tables (users, sessions, accounts, verifications, twoFactors)
export * from "./auth";
// Checkins tables (checkin types, checkins, comments, links)
export * from "./checkins";
// Core tables (organizations, members, invitations, purchases, webhookEvents)
// Also includes userRelations
export * from "./core";
// Discussions tables (channels, discussions, messages)
export * from "./discussions";
export * from "./enums";
// Integrations tables (google calendar, etc.)
export * from "./integrations-google-calendar";
// SMS tables (smsOutbox, smsStatusEnum)
export * from "./sms";
// Studio domain tables (configurations, clients, bookings)
// Also includes organizationRelations and studio relations
export * from "./studio";
