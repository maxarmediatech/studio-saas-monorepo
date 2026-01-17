"use client";

import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/ui/components/tabs";
import { BookingDetailResponsiveGrid } from "./booking-detail-responsive-grid";
import { BookingDetailScrollArea } from "./booking-detail-scroll-area";
import { BookingHeroSection } from "./BookingHeroSection";
import { BookingMetaPanel } from "./meta";
import {
	ActivitiesTab,
	// AssetsTab,
	DeliverablesTab,
	// FinancesTab, // Moved to OverviewTabEnhanced
	OverviewTabEnhanced,
	ShootsTab,
	// TasksTab, // Moved to OverviewTabEnhanced
} from "./tabs";

type Participant = {
	client?: {
		id: string;
		name: string;
		email?: string | null;
		phone?: string | null;
	} | null;
};

type Attachment = {
	name: string;
	size: number;
	type: string;
	url: string;
};

interface BookingDetailTabsProps {
	bookingId: string;
	booking: {
		referenceNumber?: string;
		name: string;
		status: string;
		statusLabel?: string;
		priority?: string;
		bookingType?: string | null;
		packageType?: string | null;
		packageCost: string;
		totalReceived: string;
		balance: string;
		note?: string | null;
		guestCount?: number | null;
		eventDate?: string | Date | null;
		eventTime?: string | null;
		venue?: string | null;
		city?: string | null;
		createdAt?: string | Date | null;
		leadSource?: string | null;
		coordinator?: string | null;
		participants?: Participant[];
		contractAttachment?: Attachment | null;
	};
	onMessageClients?: () => void;
	onShareBrief?: () => void;
	onAddTask?: () => void;
}

export function BookingDetailTabs({
	bookingId,
	booking,
	onMessageClients,
	onShareBrief,
	onAddTask,
}: BookingDetailTabsProps) {
	return (
		<BookingDetailScrollArea>
			<div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
				<div className="space-y-6">
					{/* Hero Section */}
					<BookingHeroSection
						booking={{
							referenceNumber: booking.referenceNumber,
							name: booking.name,
							status: booking.status,
							statusLabel: booking.statusLabel,
							priority: booking.priority,
							bookingType: booking.bookingType,
							packageType: booking.packageType,
							eventDate: booking.eventDate,
							eventTime: booking.eventTime,
							venue: booking.venue,
							city: booking.city,
							createdAt: booking.createdAt,
						}}
						onMessageClients={onMessageClients}
						onShareBrief={onShareBrief}
						onAddTask={onAddTask}
					/>

					{/* Main content + Meta sidebar */}
					<BookingDetailResponsiveGrid>
						{/* Left: Tabs */}
						<div className="space-y-5">
							<Tabs defaultValue="overview" className="space-y-4">
								<TabsList className="w-full justify-start gap-1 overflow-x-auto">
									<TabsTrigger value="overview">Overview</TabsTrigger>
									<TabsTrigger value="sessions">Shoots</TabsTrigger>
									<TabsTrigger value="deliverables">Deliverables</TabsTrigger>
									<TabsTrigger value="activities">Activity</TabsTrigger>
									{/* <TabsTrigger value="finances">Finances</TabsTrigger> */}
									{/* <TabsTrigger value="assets">Assets</TabsTrigger> */}
								</TabsList>

								<TabsContent value="overview" className="pt-2">
									<OverviewTabEnhanced
										bookingId={bookingId}
										booking={{
											name: booking.name,
											status: booking.status,
											packageCost: booking.packageCost,
											totalReceived: booking.totalReceived,
											note: booking.note,
											guestCount: booking.guestCount,
											participants: booking.participants,
										}}
									/>
								</TabsContent>

								<TabsContent value="sessions" className="pt-2">
									<ShootsTab bookingId={bookingId} />
								</TabsContent>

								<TabsContent value="deliverables" className="pt-2">
									<DeliverablesTab bookingId={bookingId} />
								</TabsContent>

								<TabsContent value="activities" className="pt-2">
									<ActivitiesTab bookingId={bookingId} />
								</TabsContent>

								{/* <TabsContent value="finances" className="pt-2">
									<FinancesTab bookingId={bookingId} />
								</TabsContent> */}

								{/* <TabsContent value="assets" className="pt-2">
									<AssetsTab bookingId={bookingId} />
								</TabsContent> */}
							</Tabs>
						</div>

						{/* Right: Meta sidebar */}
						<BookingMetaPanel
							bookingId={bookingId}
							booking={{
								participants: booking.participants,
								note: booking.note,
								contractAttachment: booking.contractAttachment,
							}}
						/>
					</BookingDetailResponsiveGrid>
				</div>
			</div>
		</BookingDetailScrollArea>
	);
}
