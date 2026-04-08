import { getWhatsAppRealtimeRevision } from "@repo/api/modules/whatsapp/lib/realtime-revision";
import { auth } from "@repo/auth";

const encoder = new TextEncoder();
const pollIntervalMs = 2500;
const heartbeatIntervalMs = 15000;

const encodeSseEvent = (event: string, data: Record<string, unknown>) =>
	encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = async (request: Request) => {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session?.user) {
		return new Response("Unauthorized", { status: 401 });
	}

	const organizationId = session.session.activeOrganizationId;
	if (!organizationId) {
		return new Response("Organization required", { status: 403 });
	}

	let currentRevision = await getWhatsAppRealtimeRevision(organizationId);
	let closed = false;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let lastHeartbeatAt = Date.now();

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const close = () => {
				if (closed) {
					return;
				}

				closed = true;
				if (timeoutId) {
					clearTimeout(timeoutId);
					timeoutId = null;
				}
				controller.close();
			};

			const scheduleNextPoll = () => {
				timeoutId = setTimeout(runPoll, pollIntervalMs);
			};

			const runPoll = async () => {
				if (closed) {
					return;
				}

				try {
					const nextRevision =
						await getWhatsAppRealtimeRevision(organizationId);

					if (nextRevision !== currentRevision) {
						currentRevision = nextRevision;
						lastHeartbeatAt = Date.now();
						controller.enqueue(
							encodeSseEvent("refresh", {
								revision: currentRevision,
							}),
						);
					} else if (
						Date.now() - lastHeartbeatAt >=
						heartbeatIntervalMs
					) {
						lastHeartbeatAt = Date.now();
						controller.enqueue(
							encodeSseEvent("ping", {
								revision: currentRevision,
							}),
						);
					}
				} catch {
					lastHeartbeatAt = Date.now();
					controller.enqueue(
						encodeSseEvent("ping", {
							revision: currentRevision,
						}),
					);
				}

				scheduleNextPoll();
			};

			request.signal.addEventListener("abort", close, { once: true });

			controller.enqueue(
				encodeSseEvent("connected", {
					revision: currentRevision,
				}),
			);

			scheduleNextPoll();
		},
		cancel() {
			closed = true;
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
		},
	});

	return new Response(stream, {
		headers: {
			"Cache-Control": "no-cache, no-store, must-revalidate",
			Connection: "keep-alive",
			"Content-Type": "text/event-stream",
			"X-Accel-Buffering": "no",
		},
	});
};
