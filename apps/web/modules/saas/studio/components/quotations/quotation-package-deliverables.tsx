"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { PackageIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { QuotationDeliverable } from "./quotation-wizard-data";
import { FieldBlock } from "./quotation-wizard-parts";

export function PackageDeliverablesSection({
	deliverables,
	onAddDeliverable,
	onRemoveDeliverable,
	onUpdateDeliverable,
}: {
	deliverables: QuotationDeliverable[];
	onAddDeliverable: () => void;
	onRemoveDeliverable: (id: string) => void;
	onUpdateDeliverable: (
		id: string,
		patch: Partial<QuotationDeliverable>,
	) => void;
}) {
	return (
		<div className="space-y-3">
			<div>
				<p className="text-sm font-medium">Deliverables</p>
				<p className="text-sm text-muted-foreground">
					Outputs included in this package option.
				</p>
			</div>
			{deliverables.length === 0 ? (
				<div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-6">
					<PackageIcon className="h-8 w-8 shrink-0 text-muted-foreground/50" />
					<div className="text-left">
						<p className="text-sm text-muted-foreground">
							No deliverables added for this package.
						</p>
						<Button
							type="button"
							variant="link"
							size="sm"
							className="h-auto p-0"
							onClick={onAddDeliverable}
						>
							Add first deliverable
						</Button>
					</div>
				</div>
			) : (
				<div className="space-y-3">
					{deliverables.map((deliverable, index) => (
						<div
							key={deliverable.id}
							className="overflow-hidden rounded-lg border bg-background"
						>
							<div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-3 py-2">
								<p className="text-sm font-medium">
									Deliverable {index + 1}
								</p>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
									onClick={() =>
										onRemoveDeliverable(deliverable.id)
									}
								>
									<Trash2Icon className="h-4 w-4" />
									<span className="sr-only">
										Remove deliverable
									</span>
								</Button>
							</div>
							<div className="grid gap-3 p-3 sm:grid-cols-[1fr_140px]">
								<FieldBlock label="Deliverable">
									<Input
										value={deliverable.name}
										onChange={(event) =>
											onUpdateDeliverable(
												deliverable.id,
												{
													name: event.target.value,
												},
											)
										}
									/>
								</FieldBlock>
								<FieldBlock label="Qty">
									<Input
										value={deliverable.quantity}
										onChange={(event) =>
											onUpdateDeliverable(
												deliverable.id,
												{
													quantity:
														event.target.value,
												},
											)
										}
									/>
								</FieldBlock>
								<FieldBlock
									label="Details"
									className="sm:col-span-2"
								>
									<Textarea
										value={deliverable.details}
										placeholder="Specifications, quality, quantity notes or inclusions"
										rows={3}
										onChange={(event) =>
											onUpdateDeliverable(
												deliverable.id,
												{
													details: event.target.value,
												},
											)
										}
									/>
								</FieldBlock>
							</div>
						</div>
					))}
					<Button
						type="button"
						variant="outline"
						className="w-full justify-center border-dashed"
						onClick={onAddDeliverable}
					>
						<PlusIcon className="mr-2 size-4" />
						Add another deliverable
					</Button>
				</div>
			)}
		</div>
	);
}
