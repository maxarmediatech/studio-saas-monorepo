"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/ui/components/tabs";
import { cn } from "@repo/ui/lib/utils";
import { formatMoney } from "@saas/shared/lib";
import {
	useBookingEditParams,
	useBookingParams,
} from "@saas/studio/hooks/params";
import { bookingsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, PencilIcon } from "lucide-react";
import { useState } from "react";
import { DeliverablesTab, OverviewTab, PaymentsTab, ShootsTab } from "./tabs";

type BookingStatus =
	| "new"
	| "preparation"
	| "shooting"
	| "delivery"
	| "completed"
	| "cancelled";

const statusColors: Record<BookingStatus, { bg: string; text: string }> = {
	new: { bg: "bg-yellow-100", text: "text-yellow-800" },
	preparation: { bg: "bg-blue-100", text: "text-blue-800" },
	shooting: { bg: "bg-purple-100", text: "text-purple-800" },
	delivery: { bg: "bg-orange-100", text: "text-orange-800" },
	completed: { bg: "bg-green-100", text: "text-green-800" },
	cancelled: { bg: "bg-gray-100", text: "text-gray-800" },
};

export function BookingDetailSheet() {
	const { bookingId, close } = useBookingParams();
	const { openEdit } = useBookingEditParams();
	const isOpen = Boolean(bookingId);
	const [isScrolled, setIsScrolled] = useState(false);

	const {
		data: booking,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		...bookingsApi.getOptions(bookingId ?? ""),
		enabled: isOpen && !!bookingId,
	});

	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const scrollTop = e.currentTarget.scrollTop;
		setIsScrolled(scrollTop > 0);
	};

	const bookingData = booking?.data;
	const status = bookingData?.status || "new";
	const statusStyle = statusColors[status] || statusColors.new;

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent
				side="right"
				className="sm:max-w-2xl p-0 gap-0 flex flex-col"
			>
				<SheetHeader
					className={cn(
						"shrink-0 px-6 py-4 transition-shadow duration-200",
						isScrolled &&
							"shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]",
					)}
				>
					{isLoading ? (
						<>
							<SheetTitle className="sr-only">
								Loading booking details
							</SheetTitle>
							<div className="space-y-3">
								<Skeleton className="h-8 w-3/4" />
								<Skeleton className="h-5 w-1/2" />
								<div className="flex gap-2 items-center">
									<Skeleton className="h-6 w-20" />
									<Skeleton className="h-6 w-32" />
								</div>
							</div>
						</>
					) : (
						<>
							<div className="flex items-center justify-between">
								<SheetTitle className="pr-4 text-2xl font-semibold break-words [overflow-wrap:anywhere]">
									{bookingData?.name}
								</SheetTitle>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => {
										if (bookingId) {
											close();
											openEdit(bookingId);
										}
									}}
								>
									<PencilIcon className="h-4 w-4" />
								</Button>
							</div>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<span className="font-mono">
									{bookingData?.referenceNumber}
								</span>
							</div>
							<div className="flex flex-wrap items-center gap-3 pt-2">
								<Badge
									variant="outline"
									className={cn(
										"capitalize",
										statusStyle.bg,
										statusStyle.text,
									)}
								>
									{status}
								</Badge>
								<div className="flex flex-wrap items-center gap-2 text-sm">
									<span className="text-muted-foreground">
										Package Cost:
									</span>
									<span className="font-semibold">
										{formatMoney(
											bookingData?.packageCost || "0",
										)}
									</span>
									<span className="text-muted-foreground">
										|
									</span>
									<span className="text-muted-foreground">
										Balance:
									</span>
									<span className="font-semibold">
										{formatMoney(
											bookingData?.balance || "0",
										)}
									</span>
								</div>
							</div>
						</>
					)}
				</SheetHeader>
				<div
					className="flex-1 min-h-0 overflow-y-auto"
					onScroll={handleScroll}
				>
					{isLoading ? (
						<div className="space-y-4 px-6 py-4">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-32 w-full" />
							<Skeleton className="h-32 w-full" />
							<Skeleton className="h-32 w-full" />
						</div>
					) : isError ? (
						<div className="flex flex-col items-center gap-2 py-8 px-6 text-center">
							<AlertCircleIcon className="h-10 w-10 text-destructive/50" />
							<p className="text-sm text-destructive">
								Failed to load booking
							</p>
							<Button
								variant="outline"
								size="sm"
								onClick={() => refetch()}
							>
								Try again
							</Button>
						</div>
					) : (
						<Tabs defaultValue="overview" className="w-full">
							<TabsList className="w-full justify-start overflow-x-auto rounded-none border-b px-6">
								<TabsTrigger value="overview">
									Overview
								</TabsTrigger>
								<TabsTrigger value="shoots">Shoots</TabsTrigger>
								<TabsTrigger value="deliverables">
									Deliverables
								</TabsTrigger>
								<TabsTrigger value="payments">
									Payments
								</TabsTrigger>
							</TabsList>
							<TabsContent value="overview" className="px-6 py-4">
								{bookingData && (
									<OverviewTab
										booking={{
											name: bookingData.name,
											referenceNumber:
												bookingData.referenceNumber,
											bookingType:
												bookingData.bookingType,
											packageType:
												bookingData.packageType,
											packageCost:
												bookingData.packageCost,
											totalReceived:
												bookingData.totalReceived,
											balance: bookingData.balance,
											phase: bookingData.status,
											note: bookingData.note,
											bookingDate:
												bookingData.bookingDate,
											createdAt: bookingData.createdAt,
											participants:
												bookingData.participants ?? [],
											events: bookingData.events ?? [],
											sourceQuotationCommitments:
												bookingData.sourceQuotationCommitments,
										}}
									/>
								)}
							</TabsContent>
							<TabsContent value="shoots" className="px-6 py-4">
								{bookingId && (
									<ShootsTab bookingId={bookingId} />
								)}
							</TabsContent>
							<TabsContent
								value="deliverables"
								className="px-6 py-4"
							>
								{bookingId && (
									<DeliverablesTab bookingId={bookingId} />
								)}
							</TabsContent>
							<TabsContent value="payments" className="px-6 py-4">
								{bookingId && bookingData && (
									<PaymentsTab
										bookingId={bookingId}
										packageCost={bookingData.packageCost}
										totalReceived={
											bookingData.totalReceived
										}
										balance={bookingData.balance}
									/>
								)}
							</TabsContent>
						</Tabs>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
