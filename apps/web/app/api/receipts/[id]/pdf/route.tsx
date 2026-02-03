import { renderToStream } from "@react-pdf/renderer";
import { auth } from "@repo/auth";
import {
	bookingParticipants,
	configurations,
	db,
	eq,
	organizations,
} from "@repo/database";
import { ReceiptPdfDocument } from "@/modules/saas/studio/components/pdf/ReceiptPdfDocument";
import { orpcClient } from "@/modules/shared/lib/orpc-client.server";

function parseJsonRecord(value: unknown): Record<string, unknown> {
	if (!value) return {};
	if (typeof value === "object") return value as Record<string, unknown>;
	if (typeof value === "string") {
		try {
			const parsed = JSON.parse(value) as unknown;
			return typeof parsed === "object" && parsed ? (parsed as Record<string, unknown>) : {};
		} catch {
			return {};
		}
	}
	return {};
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
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

	const { id } = await params;

	try {
		const { data: receipt } = await orpcClient.receipts.get({ id });

		if (receipt.organizationId !== organizationId) {
			return new Response("Forbidden", { status: 403 });
		}

		const organization = await db.query.organizations.findFirst({
			where: eq(organizations.id, receipt.organizationId),
		});

		if (!organization) {
			return new Response("Organization not found", { status: 404 });
		}

			const configs = await db.query.configurations.findMany({
				where: eq(configurations.organizationId, receipt.organizationId),
			});

			const addressConfig = configs.find((c) => c.key === "address");
			const orgMetadata = parseJsonRecord(organization.metadata);

			const address =
				addressConfig?.label ||
				(typeof orgMetadata.address === "string" ? orgMetadata.address : "") ||
				"";
			const email = typeof orgMetadata.email === "string" ? orgMetadata.email : "";
			const phone = typeof orgMetadata.phone === "string" ? orgMetadata.phone : "";

		const props = {
			receipt: {
				receiptNumber: receipt.receiptNumber,
				receiptDate: receipt.receiptDate,
				amount: Number(receipt.amount),
				paymentMethod: receipt.paymentMethod,
				notes: receipt.notes,
				invoice: receipt.invoice
					? { invoiceNumber: receipt.invoice.invoiceNumber }
					: null,
			},
			organization: {
				name: organization.name,
				address,
				email,
				phone,
			},
			client: {
				name: "",
				email: "",
				phone: "",
			},
		};

		if (receipt.booking?.id) {
			const participant = await db.query.bookingParticipants.findFirst({
				where: eq(bookingParticipants.bookingId, receipt.booking.id),
				with: {
					client: true,
				},
			});

			if (participant?.client) {
				props.client.name = participant.client.name;
				props.client.email = participant.client.email || "";
				props.client.phone = participant.client.phoneNumber || "";
			}
		}

		const stream = await renderToStream(<ReceiptPdfDocument {...props} />);

		const safeFilename = receipt.receiptNumber.replace(
			/[^a-zA-Z0-9-_]/g,
			"_",
		);

		return new Response(stream as any, {
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="receipt-${safeFilename}.pdf"`,
				"Cache-Control": "private, no-store",
			},
		});
	} catch (error) {
		console.error("Error generating receipt PDF:", error);
		return new Response("Error generating PDF", { status: 500 });
	}
}
