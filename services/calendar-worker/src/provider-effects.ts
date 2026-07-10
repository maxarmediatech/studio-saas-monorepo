import type { calendarSyncJobs } from "@repo/database";
import {
	createAllDayEvent,
	createAllDayIcsFromGoogleInput,
	deleteEvent,
	type GoogleAllDayEventInput,
	updateAllDayEvent,
} from "@repo/google-calendar";
import { sendCalendarInviteEmail } from "@repo/mail";
import { getGoogleAccessToken } from "./google-access-token";

export type Snapshot = {
	operation: "delivery" | "cancellation";
	intentState: "active" | "cancelled";
	eventInput: GoogleAllDayEventInput;
	target: {
		deliveryMethod: "google" | "ics" | "unsendable";
		recipientEmail: string | null;
		googleUserId: string | null;
		calendarId: string | null;
		googleEventId: string | null;
		icalUid: string | null;
		icalSequence: number;
	};
};

type Job = typeof calendarSyncJobs.$inferSelect;

export async function performProviderEffect(job: Job, snapshot: Snapshot) {
	if (snapshot.target.deliveryMethod === "google") {
		if (!snapshot.target.googleUserId) {
			throw new Error("Snapshot has no Google user");
		}
		const { config, accessToken } = await getGoogleAccessToken({
			organizationId: job.organizationId,
			userId: snapshot.target.googleUserId,
			allowDisconnected: snapshot.operation === "cancellation",
		});
		if (snapshot.operation === "cancellation") {
			if (snapshot.target.googleEventId) {
				await deleteEvent({
					config,
					accessToken,
					googleEventId: snapshot.target.googleEventId,
				});
			}
			return { googleEventId: null };
		}
		if (snapshot.target.googleEventId) {
			await updateAllDayEvent({
				config,
				accessToken,
				googleEventId: snapshot.target.googleEventId,
				input: snapshot.eventInput,
			});
			return { googleEventId: snapshot.target.googleEventId };
		}
		const created = await createAllDayEvent({
			config,
			accessToken,
			input: snapshot.eventInput,
		});
		return { googleEventId: created.googleEventId };
	}
	if (snapshot.target.deliveryMethod === "ics") {
		await sendIcs(job, snapshot, snapshot.operation === "cancellation");
	}
	return { googleEventId: null };
}

export async function compensateStaleEffect(
	job: Job,
	snapshot: Snapshot,
	googleEventId: string | null,
) {
	if (snapshot.operation !== "delivery") {
		return;
	}
	if (
		snapshot.target.deliveryMethod === "google" &&
		googleEventId &&
		!snapshot.target.googleEventId &&
		snapshot.target.googleUserId
	) {
		const { config, accessToken } = await getGoogleAccessToken({
			organizationId: job.organizationId,
			userId: snapshot.target.googleUserId,
			allowDisconnected: true,
		});
		await deleteEvent({ config, accessToken, googleEventId });
	} else if (snapshot.target.deliveryMethod === "ics") {
		await sendIcs(job, snapshot, true, snapshot.target.icalSequence + 1);
	}
}

async function sendIcs(
	job: Job,
	snapshot: Snapshot,
	cancellation: boolean,
	sequence = snapshot.target.icalSequence,
) {
	const recipient = snapshot.target.recipientEmail?.trim();
	const uid = snapshot.target.icalUid;
	if (!recipient || !uid) {
		throw new Error("Snapshot has no ICS recipient or UID");
	}
	const ics = createAllDayIcsFromGoogleInput({
		uid,
		sequence,
		method: cancellation ? "CANCEL" : "REQUEST",
		input: snapshot.eventInput,
	});
	await sendCalendarInviteEmail({
		to: recipient,
		subject: `${cancellation ? "Cancelled" : "Calendar Invite"}: ${snapshot.eventInput.title}`,
		text: snapshot.eventInput.description ?? snapshot.eventInput.title,
		html: snapshot.eventInput.description
			? `<pre style="white-space:pre-wrap">${escapeHtml(snapshot.eventInput.description)}</pre>`
			: undefined,
		icsFilename: `shoot-${job.shootId}.ics`,
		icsContent: ics,
	});
}

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
