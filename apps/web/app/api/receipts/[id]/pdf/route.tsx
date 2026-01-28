import { renderToStream } from "@react-pdf/renderer";
import {
	bookingParticipants,
	configurations,
	db,
	eq,
	organizations,
} from "@repo/database";
import { ReceiptPdfDocument } from "@/modules/saas/studio/components/pdf/ReceiptPdfDocument";
import { orpcClient } from "@/modules/shared/lib/orpc-client.server";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;

	try {
		const { data: receipt } = await orpcClient.receipts.get({ id });

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
		const orgMetadata = organization.metadata
			? JSON.parse(organization.metadata as string)
			: {};

		const address = addressConfig?.label || orgMetadata?.address || "";
		const email = orgMetadata?.email || "";
		const phone = orgMetadata?.phone || "";

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

		return new Response(stream as any, {
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="receipt-${receipt.receiptNumber}.pdf"`,
			},
		});
	} catch (error) {
		console.error("Error generating receipt PDF:", error);
		return new Response("Error generating PDF", { status: 500 });
	}
}
