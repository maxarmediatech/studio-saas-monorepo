import { StyleSheet } from "@react-pdf/renderer";

export const pdfStyles = StyleSheet.create({
	page: {
		padding: 40,
		fontSize: 11,
		fontFamily: "Helvetica",
		color: "#374151", // gray-700
	},

	// Legacy shared styles kept for ReceiptPdfDocument compatibility
	header: {
		marginBottom: 30,
		borderBottomWidth: 1,
		borderBottomColor: "#e5e7eb",
		paddingBottom: 20,
	},
	headerTitle: {
		fontSize: 24,
		fontWeight: "bold",
		marginBottom: 10,
		color: "#111827",
	},
	headerSubtitle: {
		fontSize: 12,
		color: "#6b7280",
		marginBottom: 5,
	},
	section: {
		marginBottom: 20,
	},
	sectionTitle: {
		fontSize: 14,
		fontWeight: "bold",
		marginBottom: 10,
		color: "#111827",
	},
	row: {
		display: "flex",
		flexDirection: "row",
		marginBottom: 8,
	},
	label: {
		width: "40%",
		fontWeight: "bold",
		color: "#4b5563",
	},
	value: {
		width: "60%",
		color: "#111827",
	},
	footer: {
		marginTop: 40,
		paddingTop: 20,
		borderTopWidth: 1,
		borderTopColor: "#e5e7eb",
		fontSize: 9,
		color: "#6b7280",
		textAlign: "center",
	},

	// ── Heading ──────────────────────────────────────────────────
	heading: {
		fontSize: 14,
		fontWeight: "bold",
		color: "#111827", // gray-900
	},

	// ── Dates row (inline "Issued on …" / "Due on …") ───────────
	datesRow: {
		display: "flex",
		flexDirection: "row",
		marginTop: 16,
	},
	datesCol: {
		width: "50%",
	},
	dateLabel: {
		fontSize: 10,
		color: "#6b7280", // gray-500
	},
	dateValue: {
		fontSize: 10,
		color: "#374151", // gray-700
	},

	// ── From / To addresses ──────────────────────────────────────
	addressSection: {
		display: "flex",
		flexDirection: "row",
		marginTop: 16,
		paddingTop: 16,
		borderTopWidth: 1,
		borderTopColor: "#f3f4f6", // gray-100 (approx border-gray-900/5)
	},
	addressCol: {
		width: "50%",
	},
	addressLabel: {
		fontSize: 10,
		fontWeight: "bold",
		color: "#111827", // gray-900
		marginBottom: 6,
	},
	addressName: {
		fontSize: 10,
		fontWeight: "bold",
		color: "#111827", // gray-900
		marginBottom: 2,
	},
	addressDetail: {
		fontSize: 10,
		color: "#6b7280", // gray-500
		marginBottom: 2,
	},

	// ── Table ────────────────────────────────────────────────────
	table: {
		marginTop: 32,
		marginBottom: 20,
	},
	tableHeader: {
		display: "flex",
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: "#e5e7eb", // gray-200
		paddingBottom: 8,
		marginBottom: 0,
	},
	tableRow: {
		display: "flex",
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: "#f3f4f6", // gray-100
		paddingTop: 10,
		paddingBottom: 10,
	},
	tableCell: {
		flex: 1,
		fontSize: 10,
		color: "#374151", // gray-700
	},
	tableCellDesc: {
		flex: 3,
		fontSize: 10,
		fontWeight: "bold",
		color: "#111827", // gray-900
	},
	tableCellRight: {
		flex: 1,
		fontSize: 10,
		textAlign: "right",
		color: "#374151", // gray-700
	},
	tableHeaderCell: {
		flex: 1,
		fontSize: 10,
		fontWeight: "bold",
		color: "#111827", // gray-900
	},
	tableHeaderCellDesc: {
		flex: 3,
		fontSize: 10,
		fontWeight: "bold",
		color: "#111827", // gray-900
	},
	tableHeaderCellRight: {
		flex: 1,
		fontSize: 10,
		fontWeight: "bold",
		color: "#111827", // gray-900
		textAlign: "right",
	},

	// ── Totals ───────────────────────────────────────────────────
	totalsSection: {
		marginTop: 12,
		paddingTop: 0,
	},
	totalRow: {
		display: "flex",
		flexDirection: "row",
		justifyContent: "flex-end",
		marginBottom: 6,
	},
	totalLabel: {
		width: 150,
		color: "#374151", // gray-700
		paddingRight: 10,
		textAlign: "right",
	},
	totalValue: {
		width: 100,
		textAlign: "right",
		color: "#111827", // gray-900
	},
	discountValue: {
		width: 100,
		textAlign: "right",
		color: "#059669", // green-600
	},
	grandTotal: {
		display: "flex",
		flexDirection: "row",
		justifyContent: "flex-end",
		marginTop: 6,
		paddingTop: 0,
	},
	grandTotalLabel: {
		width: 150,
		fontWeight: "bold",
		fontSize: 11,
		color: "#111827", // gray-900
		paddingRight: 10,
		textAlign: "right",
	},
	grandTotalValue: {
		width: 100,
		textAlign: "right",
		fontWeight: "bold",
		fontSize: 11,
		color: "#111827", // gray-900
	},

	// ── Notes ────────────────────────────────────────────────────
	notesSection: {
		marginTop: 24,
	},
	notesHeading: {
		fontSize: 11,
		fontWeight: "bold",
		color: "#111827", // gray-900
		marginBottom: 6,
	},
	notesText: {
		fontSize: 10,
		color: "#6b7280", // gray-500
	},
});
