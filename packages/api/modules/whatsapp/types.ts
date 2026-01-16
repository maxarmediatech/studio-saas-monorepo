import { z } from "zod";

export const connectBaileysInputSchema = z.object({
	name: z.string().min(1),
});

export const connectBaileysOutputSchema = z.object({
	data: z.object({ id: z.string() }),
	message: z.string(),
});

export const connectCloudApiInputSchema = z.object({
	name: z.string().min(1),
	phoneNumberId: z.string().min(1),
	wabaId: z.string().min(1).optional(),
	accessToken: z.string().min(1),
	webhookVerifyToken: z.string().min(1),
});

export const connectCloudApiOutputSchema = z.object({
	data: z.object({ id: z.string() }),
	message: z.string(),
});

export const sendTextInputSchema = z.object({
	accountId: z.string(),
	to: z.string(),
	text: z.string().min(1),
});

export const sendTextOutputSchema = z.object({
	data: z.object({ messageId: z.string(), outboxId: z.string() }),
	message: z.string(),
});

export const webhookInputSchema = z.object({
	token: z.string(),
	payload: z.unknown(),
});

export const webhookOutputSchema = z.object({
	data: z.object({ received: z.boolean() }),
});
