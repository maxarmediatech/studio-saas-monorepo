import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "./pdf-styles";

export interface InvoicePdfProps {
	invoice: {
		invoiceNumber: string;
		issueDate: Date | string;
			dueDate: Date | string | null;
			subtotal: string | number;
			taxAmount: string | number;
			discountAmount?: string | number;
			taxType?: "exclusive" | "inclusive" | "no_gst";
			totalAmount: string | number;
			notes?: string | null;
			lineItems: {
			id: string;
			description: string;
			quantity: string | number;
			unitPrice: string | number;
			amount: string | number;
		}[];
	};
	organization: {
		name: string;
		address?: string;
		gstNumber?: string;
		email?: string;
		phone?: string;
	};
	client: {
		name: string;
		address?: string;
		email?: string;
		phone?: string;
	};
}

export function InvoicePdfDocument({
	invoice,
	organization,
	client,
}: InvoicePdfProps) {
	const formatCurrency = (amount: string | number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "INR",
		}).format(Number(amount));
	};

	const formatDate = (date: Date | string | null) => {
		if (!date) return "";
		return new Date(date).toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	return (
		<Document>
			<Page size="A4" style={pdfStyles.page}>
				{/* Header */}
				<View style={pdfStyles.header}>
					<Text style={pdfStyles.headerTitle}>INVOICE</Text>
					<Text style={pdfStyles.headerSubtitle}>
						Invoice #{invoice.invoiceNumber}
					</Text>
				</View>

				{/* Organization and Client Info */}
				<View
					style={{
						display: "flex",
						flexDirection: "row",
						marginBottom: 30,
					}}
				>
					<View style={{ width: "50%" }}>
						<Text style={pdfStyles.sectionTitle}>From</Text>
						<Text style={pdfStyles.value}>{organization.name}</Text>
						{organization.address && (
							<Text style={pdfStyles.value}>
								{organization.address}
							</Text>
						)}
						{organization.email && (
							<Text style={pdfStyles.value}>
								{organization.email}
							</Text>
						)}
						{organization.phone && (
							<Text style={pdfStyles.value}>
								{organization.phone}
							</Text>
						)}
						{organization.gstNumber && (
							<Text style={pdfStyles.value}>
								GST: {organization.gstNumber}
							</Text>
						)}
					</View>
					<View style={{ width: "50%" }}>
						<Text style={pdfStyles.sectionTitle}>Bill To</Text>
						<Text style={pdfStyles.value}>{client.name}</Text>
						{client.email && (
							<Text style={pdfStyles.value}>{client.email}</Text>
						)}
						{client.phone && (
							<Text style={pdfStyles.value}>{client.phone}</Text>
						)}
						{client.address && (
							<Text style={pdfStyles.value}>
								{client.address}
							</Text>
						)}
					</View>
				</View>

				{/* Invoice Details */}
				<View style={pdfStyles.section}>
					<View style={pdfStyles.row}>
						<Text style={pdfStyles.label}>Invoice Date:</Text>
						<Text style={pdfStyles.value}>
							{formatDate(invoice.issueDate)}
						</Text>
					</View>
					<View style={pdfStyles.row}>
						<Text style={pdfStyles.label}>Due Date:</Text>
						<Text style={pdfStyles.value}>
							{formatDate(invoice.dueDate)}
						</Text>
					</View>
				</View>

				{/* Line Items Table */}
				<View style={pdfStyles.table}>
					<View style={pdfStyles.tableHeader}>
						<Text style={{ ...pdfStyles.tableCell, flex: 3 }}>
							Description
						</Text>
						<Text style={pdfStyles.tableCell}>Qty</Text>
						<Text style={pdfStyles.tableCellRight}>Unit Price</Text>
						<Text style={pdfStyles.tableCellRight}>Amount</Text>
					</View>

					{invoice.lineItems.map((item) => (
						<View key={item.id} style={pdfStyles.tableRow}>
							<Text style={{ ...pdfStyles.tableCell, flex: 3 }}>
								{item.description}
							</Text>
							<Text style={pdfStyles.tableCell}>
								{item.quantity}
							</Text>
							<Text style={pdfStyles.tableCellRight}>
								{formatCurrency(item.unitPrice)}
							</Text>
							<Text style={pdfStyles.tableCellRight}>
								{formatCurrency(item.amount)}
							</Text>
						</View>
					))}
				</View>

				{/* Totals */}
					<View style={pdfStyles.totalsSection}>
						{/* Subtotal: shown for exclusive, no_gst, or inclusive-with-discount */}
						{(invoice.taxType !== "inclusive" ||
							Number(invoice.discountAmount ?? 0) > 0) && (
							<View style={pdfStyles.totalRow}>
								<Text style={pdfStyles.totalLabel}>
									Subtotal:
								</Text>
								<Text style={pdfStyles.totalValue}>
									{formatCurrency(invoice.subtotal)}
								</Text>
							</View>
						)}

						{/* Inclusive with discount: show discount before taxable value */}
						{invoice.taxType === "inclusive" &&
							Number(invoice.discountAmount ?? 0) > 0 && (
								<View style={pdfStyles.totalRow}>
									<Text style={pdfStyles.totalLabel}>
										Discount:
									</Text>
									<Text style={pdfStyles.totalValue}>
										-{formatCurrency(invoice.discountAmount ?? 0)}
									</Text>
								</View>
							)}

						{/* Inclusive GST: show Taxable Value (totalAmount - taxAmount) */}
						{invoice.taxType === "inclusive" && (
							<View style={pdfStyles.totalRow}>
								<Text style={pdfStyles.totalLabel}>
									Taxable Value:
								</Text>
								<Text style={pdfStyles.totalValue}>
									{formatCurrency(
										Number(invoice.totalAmount) -
											Number(invoice.taxAmount),
									)}
								</Text>
							</View>
						)}

						{/* Tax: shown for exclusive and inclusive */}
						{invoice.taxType !== "no_gst" && (
							<View style={pdfStyles.totalRow}>
								<Text style={pdfStyles.totalLabel}>
									Tax (GST):
								</Text>
								<Text style={pdfStyles.totalValue}>
									{formatCurrency(invoice.taxAmount)}
								</Text>
							</View>
						)}

						{/* Exclusive/No GST: discount row */}
						{invoice.taxType !== "inclusive" &&
							Number(invoice.discountAmount ?? 0) > 0 && (
								<View style={pdfStyles.totalRow}>
									<Text style={pdfStyles.totalLabel}>
										Discount:
									</Text>
									<Text style={pdfStyles.totalValue}>
										-{formatCurrency(invoice.discountAmount ?? 0)}
									</Text>
								</View>
							)}

						{/* Total: always shown */}
						<View style={pdfStyles.grandTotal}>
							<Text style={pdfStyles.grandTotalLabel}>Total:</Text>
							<Text style={pdfStyles.grandTotalValue}>
								{formatCurrency(invoice.totalAmount)}
						</Text>
					</View>
				</View>

				{/* Notes */}
				{invoice.notes && (
					<View style={{ marginTop: 30 }}>
						<Text style={pdfStyles.sectionTitle}>Notes</Text>
						<Text style={pdfStyles.value}>{invoice.notes}</Text>
					</View>
				)}

				{/* Footer */}
				<View style={pdfStyles.footer}>
					<Text>Thank you for your business</Text>
				</View>
			</Page>
		</Document>
	);
}
