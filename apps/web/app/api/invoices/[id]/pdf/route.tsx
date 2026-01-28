import { renderToStream } from "@react-pdf/renderer";
import { auth } from "@repo/auth";
import { clients, configurations, db, eq, organizations } from "@repo/database";
import { InvoicePdfDocument } from "@/modules/saas/studio/components/pdf/InvoicePdfDocument";
import { orpcClient } from "@/modules/shared/lib/orpc-client.server";

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
		const { data: invoice } = await orpcClient.invoices.get({ id });

		if (invoice.organizationId !== organizationId) {
			return new Response("Forbidden", { status: 403 });
		}

		const organization = await db.query.organizations.findFirst({
			where: eq(organizations.id, invoice.organizationId),
		});

		if (!organization) {
			return new Response("Organization not found", { status: 404 });
		}

		const configs = await db.query.configurations.findMany({
			where: eq(configurations.organizationId, invoice.organizationId),
		});

		const addressConfig = configs.find((c) => c.key === "address");
		const orgMetadata = organization.metadata
			? JSON.parse(organization.metadata as string)
			: {};

		const address = addressConfig?.label || orgMetadata?.address || "";
		const gstNumber = orgMetadata?.gstNumber || "";
		const email = orgMetadata?.email || "";
		const phone = orgMetadata?.phone || "";

		const props = {
			invoice: {
				invoiceNumber: invoice.invoiceNumber,
				issueDate: invoice.issueDate,
				dueDate: invoice.dueDate,
				subtotal: Number(invoice.subtotal),
				taxAmount: Number(invoice.taxAmount),
				totalAmount: Number(invoice.totalAmount),
				notes: invoice.notes,
				lineItems: invoice.lineItems.map((item) => ({
					id: item.id,
					description: item.description,
					quantity: Number(item.quantity),
					unitPrice: Number(item.unitPrice),
					amount: Number(item.amount),
				})),
			},
			organization: {
				name: organization.name,
				address,
				gstNumber,
				email,
				phone,
			},
			client: {
				name: invoice.client?.name || "Client",
				address: "",
				email: invoice.client?.email || "",
				phone: "",
			},
		};

		if (invoice.client?.id) {
			const clientDetails = await db.query.clients.findFirst({
				where: eq(clients.id, invoice.client.id),
			});
			if (clientDetails) {
				props.client.address = clientDetails.address || "";
				props.client.phone = clientDetails.phoneNumber || "";
			}
		}

		const stream = await renderToStream(<InvoicePdfDocument {...props} />);

		const safeFilename = invoice.invoiceNumber.replace(
			/[^a-zA-Z0-9-_]/g,
			"_",
		);

		return new Response(stream as any, {
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="invoice-${safeFilename}.pdf"`,
				"Cache-Control": "private, no-store",
			},
		});
	} catch (error) {
		console.error("Error generating invoice PDF:", error);
		return new Response("Error generating PDF", { status: 500 });
	}
}
