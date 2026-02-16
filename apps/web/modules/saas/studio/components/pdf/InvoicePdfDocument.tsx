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
			type: "milestone" | "item" | "service" | "expense";
			description: string;
			quantity: string | number | null;
			unitPrice: string | number | null;
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
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			minimumFractionDigits: 0,
		}).format(Number(amount));
	};

	const formatDate = (date: Date | string | null) => {
		if (!date) return "Not set";
		return new Date(date).toLocaleDateString("en-IN", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	};

	return (
		<Document>
			<Page size="A4" style={pdfStyles.page}>
				{/* Heading */}
				<Text style={pdfStyles.heading}>Invoice</Text>
				<Text style={pdfStyles.dateValue}>
					Invoice #{invoice.invoiceNumber}
				</Text>

				{/* Dates — inline "Issued on …" / "Due on …" */}
				<View style={pdfStyles.datesRow}>
					<View style={pdfStyles.datesCol}>
						<Text>
							<Text style={pdfStyles.dateLabel}>Issued on </Text>
							<Text style={pdfStyles.dateValue}>
								{formatDate(invoice.issueDate)}
							</Text>
						</Text>
					</View>
					<View style={pdfStyles.datesCol}>
						<Text>
							<Text style={pdfStyles.dateLabel}>Due on </Text>
							<Text style={pdfStyles.dateValue}>
								{formatDate(invoice.dueDate)}
							</Text>
						</Text>
					</View>
				</View>

				{/* From / To addresses */}
				<View style={pdfStyles.addressSection}>
					<View style={pdfStyles.addressCol}>
						<Text style={pdfStyles.addressLabel}>From</Text>
						<Text style={pdfStyles.addressName}>
							{organization.name}
						</Text>
						{organization.email && (
							<Text style={pdfStyles.addressDetail}>
								{organization.email}
							</Text>
						)}
						{organization.phone && (
							<Text style={pdfStyles.addressDetail}>
								{organization.phone}
							</Text>
						)}
						{organization.address && (
							<Text style={pdfStyles.addressDetail}>
								{organization.address}
							</Text>
						)}
						{organization.gstNumber && (
							<Text style={pdfStyles.addressDetail}>
								GST: {organization.gstNumber}
							</Text>
						)}
					</View>
					<View style={pdfStyles.addressCol}>
						<Text style={pdfStyles.addressLabel}>To</Text>
						<Text style={pdfStyles.addressName}>{client.name}</Text>
						{client.email && (
							<Text style={pdfStyles.addressDetail}>
								{client.email}
							</Text>
						)}
						{client.phone && (
							<Text style={pdfStyles.addressDetail}>
								{client.phone}
							</Text>
						)}
						{client.address && (
							<Text style={pdfStyles.addressDetail}>
								{client.address}
							</Text>
						)}
					</View>
				</View>

				{/* Line Items Table */}
				{(() => {
					const hasItemizedRows = invoice.lineItems.some(
						(i) => i.type === "item" || i.type === "service",
					);
					return (
						<View style={pdfStyles.table}>
							<View style={pdfStyles.tableHeader}>
								<Text style={pdfStyles.tableHeaderCellDesc}>
									Description
								</Text>
								{hasItemizedRows && (
									<>
										<Text
											style={
												pdfStyles.tableHeaderCellRight
											}
										>
											Qty
										</Text>
										<Text
											style={
												pdfStyles.tableHeaderCellRight
											}
										>
											Rate
										</Text>
									</>
								)}
								<Text style={pdfStyles.tableHeaderCellRight}>
									Amount
								</Text>
							</View>

							{invoice.lineItems.map((item) => {
								const isLumpSum =
									item.type === "milestone" ||
									item.type === "expense";
								return (
									<View
										key={item.id}
										style={pdfStyles.tableRow}
									>
										<Text style={pdfStyles.tableCellDesc}>
											{item.description}
										</Text>
										{hasItemizedRows && (
											<>
												<Text
													style={
														pdfStyles.tableCellRight
													}
												>
													{isLumpSum
														? "\u2014"
														: String(item.quantity)}
												</Text>
												<Text
													style={
														pdfStyles.tableCellRight
													}
												>
													{isLumpSum ||
													item.unitPrice == null
														? "\u2014"
														: formatCurrency(
																item.unitPrice,
															)}
												</Text>
											</>
										)}
										<Text style={pdfStyles.tableCellRight}>
											{formatCurrency(item.amount)}
										</Text>
									</View>
								);
							})}
						</View>
					);
				})()}

				{/* Totals */}
				<View style={pdfStyles.totalsSection}>
					{/* Subtotal: shown for exclusive, no_gst, or inclusive-with-discount */}
					{(invoice.taxType !== "inclusive" ||
						Number(invoice.discountAmount ?? 0) > 0) && (
						<View style={pdfStyles.totalRow}>
							<Text style={pdfStyles.totalLabel}>Subtotal</Text>
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
									Discount
								</Text>
								<Text style={pdfStyles.discountValue}>
									-
									{formatCurrency(
										invoice.discountAmount ?? 0,
									)}
								</Text>
							</View>
						)}

					{/* Inclusive GST: show Taxable Value (totalAmount - taxAmount) */}
					{invoice.taxType === "inclusive" && (
						<View style={pdfStyles.totalRow}>
							<Text style={pdfStyles.totalLabel}>
								Taxable Value
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
							<Text style={pdfStyles.totalLabel}>Tax (GST)</Text>
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
									Discount
								</Text>
								<Text style={pdfStyles.discountValue}>
									-
									{formatCurrency(
										invoice.discountAmount ?? 0,
									)}
								</Text>
							</View>
						)}

					{/* Total: always shown */}
					<View style={pdfStyles.grandTotal}>
						<Text style={pdfStyles.grandTotalLabel}>Total</Text>
						<Text style={pdfStyles.grandTotalValue}>
							{formatCurrency(invoice.totalAmount)}
						</Text>
					</View>
				</View>

				{/* Notes */}
				{invoice.notes && (
					<View style={pdfStyles.notesSection}>
						<Text style={pdfStyles.notesHeading}>Notes</Text>
						<Text style={pdfStyles.notesText}>{invoice.notes}</Text>
					</View>
				)}
			</Page>
		</Document>
	);
}
