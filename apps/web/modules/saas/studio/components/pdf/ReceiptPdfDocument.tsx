"use client";

import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "./pdf-styles";

export interface ReceiptPdfProps {
	receipt: {
		receiptNumber: string;
		receiptDate: Date | string;
		amount: string | number;
		paymentMethod: string | null;
		notes?: string | null;
		invoice?: {
			invoiceNumber: string;
		} | null;
	};
	organization: {
		name: string;
		address?: string;
		email?: string;
		phone?: string;
	};
	client: {
		name: string;
		email?: string;
		phone?: string;
	};
}

export function ReceiptPdfDocument({
	receipt,
	organization,
	client,
}: ReceiptPdfProps) {
	const formatCurrency = (amount: string | number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "INR",
		}).format(Number(amount));
	};

	const formatDate = (date: Date | string) => {
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
					<Text style={pdfStyles.headerTitle}>RECEIPT</Text>
					<Text style={pdfStyles.headerSubtitle}>
						Receipt #{receipt.receiptNumber}
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
					</View>
					<View style={{ width: "50%" }}>
						<Text style={pdfStyles.sectionTitle}>
							Received From
						</Text>
						<Text style={pdfStyles.value}>{client.name}</Text>
						{client.email && (
							<Text style={pdfStyles.value}>{client.email}</Text>
						)}
						{client.phone && (
							<Text style={pdfStyles.value}>{client.phone}</Text>
						)}
					</View>
				</View>

				{/* Receipt Details */}
				<View style={pdfStyles.section}>
					<View style={pdfStyles.row}>
						<Text style={pdfStyles.label}>Receipt Date:</Text>
						<Text style={pdfStyles.value}>
							{formatDate(receipt.receiptDate)}
						</Text>
					</View>
					<View style={pdfStyles.row}>
						<Text style={pdfStyles.label}>Payment Method:</Text>
						<Text style={pdfStyles.value}>
							{receipt.paymentMethod || "N/A"}
						</Text>
					</View>
					{receipt.invoice && (
						<View style={pdfStyles.row}>
							<Text style={pdfStyles.label}>
								Invoice Reference:
							</Text>
							<Text style={pdfStyles.value}>
								{receipt.invoice.invoiceNumber}
							</Text>
						</View>
					)}
				</View>

				{/* Amount */}
				<View style={pdfStyles.totalsSection}>
					<View style={pdfStyles.grandTotal}>
						<Text style={pdfStyles.grandTotalLabel}>
							Amount Received:
						</Text>
						<Text style={pdfStyles.grandTotalValue}>
							{formatCurrency(receipt.amount)}
						</Text>
					</View>
				</View>

				{/* Notes */}
				{receipt.notes && (
					<View style={{ marginTop: 30 }}>
						<Text style={pdfStyles.sectionTitle}>Notes</Text>
						<Text style={pdfStyles.value}>{receipt.notes}</Text>
					</View>
				)}

				{/* Footer */}
				<View style={pdfStyles.footer}>
					<Text>Thank you for your payment</Text>
				</View>
			</Page>
		</Document>
	);
}
