"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { formatMoney } from "@saas/shared/lib";
import { useClientParams } from "@saas/studio/hooks/params/use-client-params";
import { bookingsApi, clientsApi } from "@saas/studio/lib/api";
import { UserAvatar } from "@shared/components/UserAvatar";
import { useQuery } from "@tanstack/react-query";
import {
	CheckCircle2Icon,
	ChevronRight,
	CircleIcon,
	FolderIcon,
	MailIcon,
	MapPinIcon,
	PencilIcon,
	PhoneIcon,
	PlayCircleIcon,
	UserIcon,
	XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

function getBookingStatusIcon(status: string) {
	switch (status.toLowerCase()) {
		case "completed":
			return <CheckCircle2Icon className="size-4 text-green-600" />;
		case "in_progress":
		case "post_production":
			return <PlayCircleIcon className="size-4 text-blue-600" />;
		case "cancelled":
			return <XCircleIcon className="size-4 text-red-600" />;
		default:
			return <CircleIcon className="size-4 text-muted-foreground" />;
	}
}

function getBookingStatusBadge(status: string) {
	const statusLower = status.toLowerCase();
	switch (statusLower) {
		case "completed":
			return (
				<Badge className="bg-green-500/10 text-green-600 border-green-500/20">
					Completed
				</Badge>
			);
		case "in_progress":
			return (
				<Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
					In Progress
				</Badge>
			);
		case "post_production":
			return (
				<Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">
					Post Production
				</Badge>
			);
		case "cancelled":
			return <Badge variant="destructive">Cancelled</Badge>;
		case "inquiry":
			return <Badge variant="outline">Inquiry</Badge>;
		case "confirmed":
			return (
				<Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
					Confirmed
				</Badge>
			);
		default:
			return <Badge variant="outline">{status}</Badge>;
	}
}

export default function ClientDetailPage() {
	const params = useParams<{
		organizationSlug: string;
		clientId: string;
	}>();
	const { openEdit } = useClientParams();

	const { data: clientData, isLoading: clientLoading } = useQuery(
		clientsApi.getOptions(params.clientId),
	);

	const client = clientData?.data;

	const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
		...bookingsApi.listOptions({
			clientId: params.clientId,
			sortBy: "createdAt",
			sortDirection: "desc",
			limit: 50,
		}),
		enabled: !!params.clientId,
	});

	const bookings = bookingsData?.data ?? [];

	const clientsHref = `/app/${params.organizationSlug}/clients`;

	if (clientLoading) {
		return (
			<div className="mx-auto w-full max-w-[800px] py-6 px-4">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="mt-8 h-8 w-96" />
				<Skeleton className="mt-4 h-4 w-64" />
				<Skeleton className="mt-6 h-24 w-full" />
			</div>
		);
	}

	if (!client) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-muted-foreground">Client not found</div>
			</div>
		);
	}

	const totalRevenue = bookings.reduce((sum, booking) => {
		return sum + Number.parseFloat(booking.totalReceived || "0");
	}, 0);

	return (
		<div className="mx-auto w-full max-w-[800px] py-6 px-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-sm">
					<Link
						href={clientsHref}
						className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
					>
						<UserIcon className="size-4" />
						Clients
					</Link>
					<ChevronRight className="size-4 text-muted-foreground" />
					<span className="font-medium text-foreground truncate max-w-[300px]">
						{client.name}
					</span>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => openEdit(client.id)}
				>
					<PencilIcon className="mr-1 size-4" />
					Edit
				</Button>
			</div>

			<div className="mt-8">
				<div className="flex items-start gap-4">
					<UserAvatar name={client.name} className="size-16" />
					<div className="flex-1 min-w-0">
						<h1 className="text-2xl font-semibold">
							{client.name}
						</h1>
						<div className="mt-3 space-y-2">
							{client.email && (
								<div className="flex items-center gap-2 text-sm">
									<MailIcon className="size-4 text-muted-foreground" />
									<a
										href={`mailto:${client.email}`}
										className="text-primary hover:underline"
									>
										{client.email}
									</a>
								</div>
							)}
							{client.phoneNumber && (
								<div className="flex items-center gap-2 text-sm">
									<PhoneIcon className="size-4 text-muted-foreground" />
									<a
										href={`tel:${client.phoneNumber}`}
										className="hover:underline"
									>
										{client.phoneNumber}
									</a>
									{client.alternatePhone && (
										<span className="text-muted-foreground">
											/ {client.alternatePhone}
										</span>
									)}
								</div>
							)}
							{client.address && (
								<div className="flex items-start gap-2 text-sm">
									<MapPinIcon className="size-4 text-muted-foreground mt-0.5" />
									<span className="text-muted-foreground">
										{client.address}
									</span>
								</div>
							)}
						</div>
						<div className="mt-4 flex items-center gap-4 text-sm">
							<div className="flex items-center gap-1.5">
								<FolderIcon className="size-4 text-muted-foreground" />
								<span className="font-medium">
									{client.bookingsCount}
								</span>
								<span className="text-muted-foreground">
									bookings
								</span>
							</div>
							{totalRevenue > 0 && (
								<div className="text-muted-foreground">
									<span className="font-medium text-foreground">
										{formatMoney(totalRevenue.toFixed(2))}
									</span>{" "}
									total received
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className="mt-8 border-t pt-6">
				<h2 className="font-semibold flex items-center gap-2">
					<FolderIcon className="size-4" />
					Bookings ({bookings.length})
				</h2>

				{bookingsLoading ? (
					<div className="mt-4 space-y-3">
						<Skeleton className="h-20 w-full" />
						<Skeleton className="h-20 w-full" />
					</div>
				) : bookings.length > 0 ? (
					<div className="mt-4 space-y-2">
						{bookings.map((booking) => {
							const balance = Number.parseFloat(
								booking.balance || "0",
							);
							const hasBalance = balance > 0;

							return (
								<Link
									key={booking.id}
									href={`/app/${params.organizationSlug}/bookings/${booking.id}`}
									className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
								>
									<div className="flex items-center gap-3 min-w-0">
										{getBookingStatusIcon(booking.status)}
										<div className="min-w-0">
											<div className="font-medium truncate">
												{booking.name}
											</div>
											<div className="text-xs text-muted-foreground">
												{booking.referenceNumber} ·{" "}
												{booking.packageType
													.split("_")
													.map(
														(w) =>
															w
																.charAt(0)
																.toUpperCase() +
															w.slice(1),
													)
													.join(" ")}
											</div>
										</div>
									</div>
									<div className="flex items-center gap-3 shrink-0">
										<div className="text-right text-sm">
											<div className="font-medium">
												{formatMoney(
													booking.packageCost,
												)}
											</div>
											{hasBalance && (
												<div className="text-xs text-amber-600">
													{formatMoney(
														booking.balance,
													)}{" "}
													due
												</div>
											)}
										</div>
										{getBookingStatusBadge(booking.status)}
									</div>
								</Link>
							);
						})}
					</div>
				) : (
					<div className="mt-4 text-sm text-muted-foreground">
						No bookings yet for this client.
					</div>
				)}
			</div>
		</div>
	);
}
