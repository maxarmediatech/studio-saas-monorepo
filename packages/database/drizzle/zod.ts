import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";
import {
	accounts,
	invitations,
	members,
	organizations,
	purchase,
	sessions,
	twoFactor,
	users,
	verifications,
} from "./schema";

export const UserSchema = createSelectSchema(users);
export const UserUpdateSchema = createUpdateSchema(users, {
	id: z.string(),
});
export const OrganizationSchema = createSelectSchema(organizations);
export const OrganizationUpdateSchema = createUpdateSchema(organizations, {
	id: z.string(),
});
export const MemberSchema = createSelectSchema(members);
export const InvitationSchema = createSelectSchema(invitations);
export const PurchaseSchema = createSelectSchema(purchase);
export type Purchase = typeof purchase.$inferSelect;
export const PurchaseInsertSchema = createInsertSchema(purchase);
export const PurchaseUpdateSchema = createUpdateSchema(purchase, {
	id: z.string(),
});
export const SessionSchema = createSelectSchema(sessions);
export const AccountSchema = createSelectSchema(accounts);
export const VerificationSchema = createSelectSchema(verifications);
export const TwoFactorSchema = createSelectSchema(twoFactor);
