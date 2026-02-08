import { StyleSheet } from "@react-pdf/renderer";

export const pdfStyles = StyleSheet.create({
	page: {
		padding: 40,
		fontSize: 11,
		fontFamily: "Helvetica",
		color: "#000",
	},
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
	},
	headerSubtitle: {
		fontSize: 12,
		color: "#666",
		marginBottom: 5,
	},
	section: {
		marginBottom: 20,
	},
	sectionTitle: {
		fontSize: 14,
		fontWeight: "bold",
		marginBottom: 10,
		color: "#1f2937",
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
		color: "#000",
	},
	table: {
		marginBottom: 20,
	},
	tableHeader: {
		display: "flex",
		flexDirection: "row",
		borderBottomWidth: 2,
		borderBottomColor: "#1f2937",
		paddingBottom: 8,
		marginBottom: 8,
		fontWeight: "bold",
	},
	tableRow: {
		display: "flex",
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: "#e5e7eb",
		paddingBottom: 8,
		marginBottom: 8,
	},
	tableCell: {
		flex: 1,
		fontSize: 10,
	},
	tableCellRight: {
		flex: 1,
		fontSize: 10,
		textAlign: "right",
	},
	footer: {
		marginTop: 40,
		paddingTop: 20,
		borderTopWidth: 1,
		borderTopColor: "#e5e7eb",
		fontSize: 9,
		color: "#666",
		textAlign: "center",
	},
	totalsSection: {
		marginTop: 20,
		paddingTop: 20,
		borderTopWidth: 1,
		borderTopColor: "#e5e7eb",
	},
	totalRow: {
		display: "flex",
		flexDirection: "row",
		justifyContent: "flex-end",
		marginBottom: 8,
	},
	totalLabel: {
		width: 150,
		fontWeight: "bold",
		paddingRight: 10,
	},
	totalValue: {
		width: 100,
		textAlign: "right",
	},
	grandTotal: {
		display: "flex",
		flexDirection: "row",
		justifyContent: "flex-end",
		marginTop: 10,
		paddingTop: 10,
		borderTopWidth: 2,
		borderTopColor: "#1f2937",
	},
	grandTotalLabel: {
		width: 150,
		fontWeight: "bold",
		fontSize: 12,
		paddingRight: 10,
	},
	grandTotalValue: {
		width: 100,
		textAlign: "right",
		fontWeight: "bold",
		fontSize: 12,
	},
});
