import { QuotationListSkeleton } from "@saas/studio/components/quotations/QuotationsList";

export default function Loading() {
	return (
		<div className="p-4 lg:p-6">
			<QuotationListSkeleton />
		</div>
	);
}
