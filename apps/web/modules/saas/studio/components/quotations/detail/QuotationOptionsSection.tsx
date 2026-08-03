import type { QuoteDetail } from "@repo/api/modules/studio/schemas/quote";
import { Badge } from "@repo/ui/components/badge";
import { Separator } from "@repo/ui/components/separator";
import { cn } from "@repo/ui/lib/utils";
import { CheckCircle2Icon, UsersIcon } from "lucide-react";
import { formatMoney } from "./QuotationDetailShared";

export function QuotationOptionsSection({ quote }: { quote: QuoteDetail }) {
	return (
		<div className="flex flex-col gap-5">
			<section className="flex flex-col gap-3">
				<h2 className="flex items-center gap-2 font-semibold">
					<UsersIcon aria-hidden="true" className="size-4" />
					Participants
				</h2>
				<div className="divide-y rounded-lg border">
					{quote.participants.map((participant) => (
						<div
							key={participant.id}
							className="flex items-center justify-between gap-4 p-4"
						>
							<div className="min-w-0">
								<p className="font-medium">
									{participant.client.name}
									{participant.isPrimary ? (
										<Badge
											className="ml-2"
											variant="secondary"
										>
											Primary
										</Badge>
									) : null}
								</p>
								<p className="truncate text-sm text-muted-foreground">
									{participant.client.email ??
										participant.client.phoneNumber ??
										"No contact detail"}
								</p>
							</div>
							<div className="shrink-0 text-right">
								<p className="text-sm">{participant.role}</p>
								{participant.side ? (
									<p className="text-xs text-muted-foreground">
										{participant.side}
									</p>
								) : null}
							</div>
						</div>
					))}
				</div>
			</section>
			<section className="flex flex-col gap-3">
				<h2 className="font-semibold">Option comparison</h2>
				<div className="grid gap-4 xl:grid-cols-2">
					{quote.options.map((option) => {
						const accepted =
							quote.acceptance?.quoteOptionId === option.id;
						return (
							<article
								key={option.id}
								className={cn(
									"overflow-hidden rounded-lg border",
									accepted && "border-primary",
								)}
							>
								<header className="flex items-start justify-between gap-4 p-4">
									<div>
										<h3 className="font-semibold">
											{option.name}
										</h3>
										{option.description ? (
											<p className="mt-1 text-sm text-muted-foreground">
												{option.description}
											</p>
										) : null}
									</div>
									<div className="flex flex-wrap justify-end gap-1">
										{option.isRecommended ? (
											<Badge variant="secondary">
												Recommended
											</Badge>
										) : null}
										{accepted ? (
											<Badge>
												<CheckCircle2Icon data-icon="inline-start" />
												Accepted
											</Badge>
										) : null}
									</div>
								</header>
								<Separator />
								<div className="divide-y">
									{option.lineItems.map((line) => (
										<div
											key={line.sortOrder}
											className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3 text-sm"
										>
											<div className="min-w-0">
												<p>{line.description}</p>
												<p className="text-xs capitalize text-muted-foreground">
													{line.type}
													{line.quantity
														? ` · ${line.quantity} × ${line.unitPrice}`
														: ""}
												</p>
											</div>
											<span className="tabular-nums">
												{formatMoney(
													quote.currency,
													line.amount,
												)}
											</span>
										</div>
									))}
								</div>
								<footer className="flex flex-col gap-1 bg-muted/40 p-4 text-sm">
									<Amount
										label="Subtotal"
										value={formatMoney(
											quote.currency,
											option.subtotal,
										)}
									/>
									<Amount
										label="Discount"
										value={`−${formatMoney(quote.currency, option.discountAmount)}`}
									/>
									<Amount
										label="Tax"
										value={formatMoney(
											quote.currency,
											option.taxAmount,
										)}
									/>
									<Separator className="my-1" />
									<Amount
										label="Total"
										value={formatMoney(
											quote.currency,
											option.totalAmount,
										)}
										strong
									/>
								</footer>
							</article>
						);
					})}
				</div>
			</section>
		</div>
	);
}

function Amount({
	label,
	value,
	strong = false,
}: {
	label: string;
	value: string;
	strong?: boolean;
}) {
	return (
		<div
			className={cn(
				"flex justify-between gap-4 tabular-nums",
				strong ? "text-base font-semibold" : "text-muted-foreground",
			)}
		>
			<span>{label}</span>
			<span>{value}</span>
		</div>
	);
}
