"use client";

import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import { ChevronRightIcon, MessageCircleIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

interface Participant {
	role: string;
	client: {
		id: string;
		name: string;
		email: string | null;
		phoneNumber: string | null;
	};
}

interface ClientCardProps {
	participants: Participant[];
	organizationSlug: string;
	className?: string;
}

function getInitials(name: string): string {
	if (!name) return "?";
	const words = name.trim().split(/\s+/);
	if (words.length === 1) {
		return words[0].substring(0, 2).toUpperCase();
	}
	return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Displays primary client information with avatar
 * Shows "View all" link if multiple participants
 */
export function ClientCard({
	participants,
	organizationSlug,
	className,
}: ClientCardProps) {
	if (participants.length === 0) {
		return (
			<Card className={cn("shadow-none", className)}>
				<CardContent className="p-4">
					<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
						<UsersIcon className="h-4 w-4" />
						<span>Client</span>
					</div>
					<p className="mt-2 text-sm text-muted-foreground">
						No clients added
					</p>
				</CardContent>
			</Card>
		);
	}

	const primaryParticipant = participants[0];
	const hasMultiple = participants.length > 1;

	return (
		<Card className={cn("shadow-none", className)}>
			<CardContent className="p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
						<UsersIcon className="h-4 w-4" />
						<span>{hasMultiple ? "Clients" : "Client"}</span>
					</div>
					{/* Chat button placeholder */}
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6"
						aria-label="Message client"
					>
						<MessageCircleIcon className="h-3.5 w-3.5" />
					</Button>
				</div>

				<div className="mt-3 flex items-center gap-3">
					<Avatar className="h-10 w-10">
						<AvatarFallback className="bg-primary/10 text-primary">
							{getInitials(primaryParticipant.client.name)}
						</AvatarFallback>
					</Avatar>
					<div className="flex-1 min-w-0">
						<Link
							href={`/app/${organizationSlug}/clients/${primaryParticipant.client.id}`}
							className="font-medium hover:underline truncate block"
						>
							{primaryParticipant.client.name}
						</Link>
						<div className="flex items-center gap-2 mt-0.5">
							<Badge variant="secondary" className="text-xs">
								{primaryParticipant.role}
							</Badge>
							{/* TODO: Add booking count for this client */}
						</div>
					</div>
				</div>

				{hasMultiple && (
					<Button
						variant="ghost"
						size="sm"
						className="mt-3 w-full justify-between text-muted-foreground"
						asChild
					>
						<Link href="#clients">
							View all {participants.length} clients
							<ChevronRightIcon className="h-4 w-4" />
						</Link>
					</Button>
				)}
			</CardContent>
		</Card>
	);
}
