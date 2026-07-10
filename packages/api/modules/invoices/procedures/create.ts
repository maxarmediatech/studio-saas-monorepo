import { ORPCError } from "@orpc/server";
import {
	and,
	bookings,
	db,
	eq,
	invoiceLineItems,
	invoices,
	isNull,
} from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { formatAmount, safeTrackActivity } from "../../activities/lib";
import { centsToMoney, moneyToCents } from "../../studio/lib/money";
import { requirePermission } from "../../studio/lib/permissions";
import {
	createInvoiceInputSchema,
	createInvoiceOutputSchema,
} from "../../studio/schemas/invoice";
import {
	calculateGst,
	generateInvoiceNumber,
	getGstConfig,
	type TaxType,
} from "../lib/invoice-helpers";
import { computeLineItemFields } from "../lib/line-item-helpers";

export const createInvoice = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/invoices",
		tags: ["Invoices"],
		summary: "Create invoice",
		description: "Create a new invoice manually with line items",
	})
	.input(createInvoiceInputSchema)
	.output(createInvoiceOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "create");

		const {
			bookingId,
			issueDate,
			dueDate,
			notes,
			terms,
			discountAmount,
			lineItems,
			taxType: inputTaxType,
		} = input;

		const booking = await db.query.bookings.findFirst({
			where: and(
				eq(bookings.id, bookingId),
				eq(bookings.organizationId, context.organizationId),
				isNull(bookings.deletedAt),
			),
			columns: { id: true, name: true },
		});

		if (!booking) {
			throw new ORPCError("NOT_FOUND", {
				message: "Booking not found",
			});
		}

		const lineItemValues = lineItems.map((item, idx) => {
			const effectiveType = item.type ?? "item";
			const fields = computeLineItemFields(item, effectiveType);
			return {
				invoiceId: "",
				description: item.description,
				...fields,
				sortOrder: idx,
			};
		});

		const subtotalCents = lineItemValues.reduce(
			(sum, item) => sum + moneyToCents(item.amount),
			0,
		);

		const discountCents = discountAmount ? moneyToCents(discountAmount) : 0;
		if (discountCents > subtotalCents) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Discount cannot exceed subtotal",
			});
		}
		const discount = centsToMoney(discountCents);

		// Resolve tax type: use input value or fall back to org default
		let taxType: TaxType = "exclusive";
		if (inputTaxType) {
			taxType = inputTaxType;
		} else {
			const gstConfig = await getGstConfig(context.organizationId);
			taxType = gstConfig.defaultTaxType;
		}

		const { taxAmount, totalAmount } = await calculateGst(
			centsToMoney(subtotalCents),
			context.organizationId,
			discount,
			taxType,
		);

		return await db.transaction(async (tx) => {
			const invoiceNumber = await generateInvoiceNumber(
				bookingId,
				context.organizationId,
				tx,
			);

			const [created] = await tx
				.insert(invoices)
				.values({
					organizationId: context.organizationId,
					bookingId,
					invoiceNumber,
					status: "draft",
					issueDate,
					dueDate: dueDate ?? null,
					subtotal: centsToMoney(subtotalCents),
					taxAmount,
					discountAmount: discount,
					taxType,
					totalAmount,
					paidAmount: "0.00",
					notes: notes ?? null,
					terms: terms ?? null,
					createdBy: context.user.id,
					updatedBy: context.user.id,
				})
				.returning({ id: invoices.id });

			if (!created) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create invoice",
				});
			}

			const finalLineItemValues = lineItemValues.map((item) => ({
				...item,
				invoiceId: created.id,
			}));

			await tx.insert(invoiceLineItems).values(finalLineItemValues);

			await safeTrackActivity(context, {
				entityType: "invoice",
				entityId: created.id,
				entityName: `${invoiceNumber} (${formatAmount(totalAmount)})`,
				action: "created",
				parentEntityType: "booking",
				parentEntityId: bookingId,
				parentEntityName: booking.name,
				metadata: {
					invoiceNumber,
					totalAmount,
				},
			});

			return {
				data: { id: created.id },
				message: "Invoice created successfully",
			};
		});
	});
