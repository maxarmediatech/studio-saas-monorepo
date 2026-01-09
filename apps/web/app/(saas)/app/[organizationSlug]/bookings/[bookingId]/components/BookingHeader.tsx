import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";
import { format } from "date-fns";
import { CheckCircle2, Loader2, Package } from "lucide-react";

interface BookingHeaderProps {
	name: string;
	referenceNumber?: string | null;
	status: string;
	createdAt: string | Date;
	clientName?: string;
	isPaid?: boolean;
}

export function BookingHeader({
	name,
	referenceNumber,
	status,
	createdAt,
	clientName,
	isPaid = false,
}: BookingHeaderProps) {
	const orderId = referenceNumber || name;
	const formattedDate = format(new Date(createdAt), "MMM d, yyyy");

	return (
		<div className="flex flex-col gap-6 w-full mb-6">
			{/* Header Section */}
			<div className="flex flex-col gap-2">
				<div className="flex flex-wrap items-center gap-4">
					<h1 className="text-3xl font-bold tracking-tight text-foreground">
						{orderId}
					</h1>
					{isPaid && (
						<Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-transparent gap-1.5 px-3 py-1 text-sm font-medium rounded-full">
							<CheckCircle2 className="size-4 fill-green-700 text-white" />
							Paid
						</Badge>
					)}
					<Badge
						variant="secondary"
						className="bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border-transparent gap-1.5 px-3 py-1 text-sm font-medium rounded-full"
					>
						<Package className="size-4" />
						{status.charAt(0).toUpperCase() + status.slice(1)}
					</Badge>
				</div>
				<div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
					<span>Booked on {formattedDate}</span>
					<span>·</span>
					<span>
						Client{" "}
						<span className="text-foreground font-semibold underline decoration-1 underline-offset-4 cursor-pointer hover:text-primary transition-colors">
							{clientName || "Unknown Client"}
						</span>
					</span>
					<span>·</span>
					<span>Purchased via online store</span>
				</div>
			</div>

			{/* Status Section */}
			<div className="overflow-hidden rounded-xl border bg-background">
				{/* Top Gray Bar */}
				<div className="bg-muted/60 px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs">
					<div className="flex items-center gap-2 text-muted-foreground">
						<span>Primary Venue</span>
						<span className="font-medium text-foreground">
							Main Studio / On-Location
						</span>
					</div>
					<div className="text-muted-foreground">
						Event Date:{" "}
						<span className="font-medium text-foreground">
							TBD
						</span>
					</div>
				</div>

				{/* Stepper Content */}
				<div className="p-8">
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
						<StepItem
							label="Booking Scheduled"
							status="completed"
							icon={<CheckCircle2 className="size-4 text-foreground" />}
						/>
						<StepItem 
							label="In Progress" 
							status="active" 
							icon={<Loader2 className="size-4 animate-spin text-foreground" />}
						/>
						<StepItem label="Delivery Pending" status="inactive" />
						<StepItem label="Completed" status="inactive" />
					</div>
				</div>
			</div>
		</div>
	);
}

interface StepItemProps {
	label: string;
	status: "active" | "completed" | "inactive";
	icon?: React.ReactNode;
}

function StepItem({ label, status, icon }: StepItemProps) {
	return (
		<div className="flex flex-col gap-3 w-full group">
			<div className="flex items-center gap-2 min-h-[20px]">
				{icon && <span>{icon}</span>}
				<span
					className={cn(
						"text-sm font-medium transition-colors",
						status === "active"
							? "text-foreground"
							: "text-muted-foreground/80",
						status === "completed" && "text-foreground",
					)}
				>
					{label}
				</span>
			</div>
			<div
				className={cn(
					"h-1 w-full rounded-full transition-all duration-300",
					status === "active" ? "bg-foreground" : "bg-muted/80",
					status === "completed" && "bg-foreground",
				)}
			/>
		</div>
	);
}