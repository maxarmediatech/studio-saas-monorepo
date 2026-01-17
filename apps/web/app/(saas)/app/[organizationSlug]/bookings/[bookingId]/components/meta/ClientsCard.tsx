"use client";

import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { MailIcon, PhoneIcon, UserIcon } from "lucide-react";

type Client = {
	id: string;
	name: string;
	email?: string | null;
	phone?: string | null;
};

type ClientsCardProps = {
	clients: Client[];
};

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

function ClientRow({ client }: { client: Client }) {
	return (
		<div className="flex items-start gap-3 py-2">
			<Avatar className="h-8 w-8 shrink-0">
				<AvatarFallback className="text-xs">
					{getInitials(client.name)}
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1 space-y-1">
				<p className="text-sm font-medium truncate">{client.name}</p>
				{client.phone && (
					<a
						href={`tel:${client.phone}`}
						className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						<PhoneIcon className="h-3 w-3" />
						<span className="truncate">{client.phone}</span>
					</a>
				)}
				{client.email && (
					<a
						href={`mailto:${client.email}`}
						className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						<MailIcon className="h-3 w-3" />
						<span className="truncate">{client.email}</span>
					</a>
				)}
			</div>
		</div>
	);
}

function EmptyState() {
	return (
		<div className="flex flex-col items-center gap-2 py-6 text-center">
			<UserIcon className="h-6 w-6 text-muted-foreground/30" />
			<p className="text-xs text-muted-foreground">No clients linked</p>
		</div>
	);
}

export function ClientsCard({ clients }: ClientsCardProps) {
	const hasClients = clients.length > 0;

	return (
		<Card className="shadow-none rounded-lg">
			<CardHeader>
				<CardTitle className="text-base">Clients</CardTitle>
				<CardDescription>Contact information.</CardDescription>
			</CardHeader>
			<CardContent>
				{hasClients ? (
					<div className="divide-y">
						{clients.map((client) => (
							<ClientRow key={client.id} client={client} />
						))}
					</div>
				) : (
					<EmptyState />
				)}
			</CardContent>
		</Card>
	);
}
