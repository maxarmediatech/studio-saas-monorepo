"use client";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/ui/components/tabs";
import { PackageIcon, PlusIcon } from "lucide-react";
import { PackageSection } from "./quotation-package-section";
import type { PackageOption, QuotationEvent } from "./quotation-wizard-data";
import { createDraftId } from "./quotation-wizard-data";
import { formatMoney } from "./quotation-wizard-parts";

export function PackagesStep({
	packages,
	events,
	quotationType,
	quotationTypeKey,
	selectedPackageId,
	onSelect,
	onUpdate,
	onAddPackage,
	onRemovePackage,
	onDuplicatePackage,
	errors,
}: {
	packages: PackageOption[];
	events: QuotationEvent[];
	quotationType: string;
	quotationTypeKey: string | null;
	selectedPackageId: string;
	onSelect: (id: string) => void;
	onUpdate: (id: string, patch: Partial<PackageOption>) => void;
	onAddPackage: (pkg: PackageOption) => void;
	onRemovePackage: (id: string) => void;
	onDuplicatePackage: (pkg: PackageOption) => void;
	errors: Record<string, string>;
}) {
	const activePackageId = selectedPackageId || packages[0]?.id || "";

	const addPackage = () => {
		const id = createDraftId("package");
		onAddPackage({
			id,
			configurationId: null,
			configurationKey: null,
			configurationDefaultCost: null,
			configurationDescription: null,
			name: "",
			price: "",
			summary: "",
			deliverables: [],
			coverage: events.map((event) => ({
				id: createDraftId("coverage"),
				eventId: event.id,
				eventName: event.name,
				side: event.side,
				roles: "",
			})),
		});
	};

	return (
		<div className="space-y-4">
			<h2 className="text-lg font-semibold">Package Options</h2>
			<Card>
				<CardContent className="space-y-4">
					{packages.length === 0 ? (
						<div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-6">
							<PackageIcon className="h-8 w-8 shrink-0 text-muted-foreground/50" />
							<div className="text-left">
								<p className="text-sm text-muted-foreground">
									No package options added yet
								</p>
								<Button
									type="button"
									variant="link"
									size="sm"
									className="h-auto p-0"
									onClick={addPackage}
								>
									Add first package
								</Button>
							</div>
						</div>
					) : (
						<Tabs
							value={activePackageId}
							onValueChange={onSelect}
							className="gap-4"
						>
							<div className="flex flex-col gap-3 border-b pb-3 lg:flex-row lg:items-center lg:justify-between">
								<div className="overflow-x-auto pb-1">
									<TabsList className="h-auto w-max">
										{packages.map((pkg, index) => (
											<TabsTrigger
												key={pkg.id}
												value={pkg.id}
												className="h-9 px-3"
											>
												<span>
													{pkg.name ||
														`Package ${index + 1}`}
												</span>
												{pkg.price && (
													<span className="text-xs text-muted-foreground">
														{formatMoney(pkg.price)}
													</span>
												)}
											</TabsTrigger>
										))}
									</TabsList>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="w-full justify-center border-dashed lg:w-auto"
									onClick={addPackage}
								>
									<PlusIcon className="mr-2 h-4 w-4" />
									Add package
								</Button>
							</div>
							{packages.map((pkg, index) => (
								<TabsContent key={pkg.id} value={pkg.id}>
									<PackageSection
										pkg={pkg}
										index={index}
										events={events}
										quotationType={quotationType}
										quotationTypeKey={quotationTypeKey}
										canRemove={packages.length > 1}
										onRemove={() => onRemovePackage(pkg.id)}
										onDuplicate={() =>
											onDuplicatePackage(pkg)
										}
										onUpdate={(patch) =>
											onUpdate(pkg.id, patch)
										}
										errors={errors}
									/>
								</TabsContent>
							))}
						</Tabs>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
