"use client";

import type { QuoteDetail } from "@repo/api/modules/studio/schemas/quote";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import { Field, FieldLabel } from "@repo/ui/components/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { quotesMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, PencilIcon, SendIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
	getQuoteActions,
	type QuoteAction,
	type QuotePresentationCapabilities,
} from "../quotation-helpers";
import { formatMoney } from "./QuotationDetailShared";

type ConfirmAction = Exclude<QuoteAction, "edit">;
const labels: Record<ConfirmAction, string> = {
	send: "Send",
	revise: "Revise",
	accept: "Accept",
	decline: "Decline",
	expire: "Expire",
	convert: "Convert",
};
const descriptions: Record<ConfirmAction, string> = {
	send: "Sending locks this version’s content.",
	revise: "This version becomes superseded and a new draft is created.",
	accept: "Acceptance snapshots the chosen option and cannot be changed.",
	decline: "This marks the sent quotation as declined.",
	expire: "This explicitly closes an overdue sent quotation.",
	convert: "This materializes the accepted booking blueprint exactly once.",
};

export function QuotationLifecycleActions({
	quote,
	capabilities,
	organizationSlug,
}: {
	quote: QuoteDetail;
	capabilities: QuotePresentationCapabilities;
	organizationSlug: string;
}) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
	const [selectedOptionId, setSelectedOptionId] = useState("");
	const send = useMutation(quotesMutations.send());
	const revise = useMutation(quotesMutations.revise());
	const accept = useMutation(quotesMutations.accept());
	const decline = useMutation(quotesMutations.decline());
	const expire = useMutation(quotesMutations.expire());
	const convert = useMutation(quotesMutations.convert());
	const pending = [send, revise, accept, decline, expire, convert].some(
		(mutation) => mutation.isPending,
	);
	const actions = getQuoteActions(quote, capabilities);

	const openAction = (action: ConfirmAction) => {
		setSelectedOptionId(
			quote.acceptance?.quoteOptionId ??
				quote.options.find((option) => option.isRecommended)?.id ??
				"",
		);
		setConfirm(action);
	};

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: orpc.quotes.key() });
	const runAction = async () => {
		if (!confirm) {
			return;
		}
		try {
			if (confirm === "send") {
				await send.mutateAsync({ id: quote.id });
			}
			if (confirm === "decline") {
				await decline.mutateAsync({ id: quote.id });
			}
			if (confirm === "expire") {
				await expire.mutateAsync({ id: quote.id });
			}
			if (confirm === "accept") {
				if (!selectedOptionId) {
					return;
				}
				await accept.mutateAsync({
					id: quote.id,
					quoteOptionId: selectedOptionId,
				});
			}
			if (confirm === "revise") {
				const result = await revise.mutateAsync({ id: quote.id });
				setConfirm(null);
				toast.success("Revision draft created");
				router.push(
					`/app/${organizationSlug}/quotations/${result.data.id}/edit`,
				);
				return;
			}
			if (confirm === "convert") {
				const result = await convert.mutateAsync({ id: quote.id });
				setConfirm(null);
				await invalidate();
				if (result.data.deletedAt) {
					toast.warning(
						`This quotation remains linked to deleted booking ${result.data.referenceNumber}; it cannot be converted again.`,
					);
					return;
				}
				toast.success(
					`Converted to booking ${result.data.referenceNumber}`,
				);
				router.push(
					`/app/${organizationSlug}/bookings/${result.data.id}`,
				);
				return;
			}
			setConfirm(null);
			toast.success(`${labels[confirm]} completed`);
			await invalidate();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Quotation action failed",
			);
		}
	};

	return (
		<>
			<div className="flex flex-wrap justify-end gap-2">
				{actions.includes("edit") ? (
					<Button size="sm" variant="outline" asChild>
						<Link
							href={`/app/${organizationSlug}/quotations/${quote.id}/edit`}
						>
							<PencilIcon data-icon="inline-start" />
							Edit draft
						</Link>
					</Button>
				) : null}
				{actions
					.filter(
						(action): action is ConfirmAction => action !== "edit",
					)
					.map((action) => (
						<Button
							type="button"
							key={action}
							size="sm"
							variant={
								action === "convert" ? "default" : "outline"
							}
							onClick={() => openAction(action)}
						>
							{action === "send" ? (
								<SendIcon data-icon="inline-start" />
							) : null}
							{labels[action]}
						</Button>
					))}
			</div>
			<AlertDialog
				open={Boolean(confirm)}
				onOpenChange={(open) => {
					if (!open) {
						setConfirm(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{confirm
								? `${labels[confirm]} quotation?`
								: "Confirm quotation action"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{confirm
								? descriptions[confirm]
								: "Review this action before continuing."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					{confirm === "accept" ? (
						<Field>
							<FieldLabel htmlFor="accepted-quote-option">
								Accepted option
							</FieldLabel>
							<Select
								value={selectedOptionId}
								onValueChange={setSelectedOptionId}
							>
								<SelectTrigger
									id="accepted-quote-option"
									className="w-full"
								>
									<SelectValue placeholder="Choose accepted option" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										<SelectLabel>
											Quotation options
										</SelectLabel>
										{quote.options.map((option) => (
											<SelectItem
												key={option.id}
												value={option.id}
											>
												{option.name} ·{" "}
												{formatMoney(
													quote.currency,
													option.totalAmount,
												)}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
					) : null}
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={
								pending ||
								(confirm === "accept" && !selectedOptionId)
							}
							onClick={() => void runAction()}
						>
							{pending ? (
								<Loader2Icon
									className="animate-spin"
									data-icon="inline-start"
								/>
							) : null}
							{confirm ? labels[confirm] : "Confirm"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
