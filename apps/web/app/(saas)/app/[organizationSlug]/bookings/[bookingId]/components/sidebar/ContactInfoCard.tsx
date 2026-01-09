"use client";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import { MailIcon, PhoneIcon, MessageSquareIcon } from "lucide-react";

interface ContactInfoCardProps {
	email: string | null;
	phone: string | null;
	className?: string;
}

/**
 * Displays contact information with clickable action buttons
 * Includes email, phone, and WhatsApp (if phone available)
 */
export function ContactInfoCard({
	email,
	phone,
	className,
}: ContactInfoCardProps) {
	const hasContact = email || phone;

	if (!hasContact) {
		return (
			<Card className={cn("shadow-none", className)}>
				<CardContent className="p-4">
					<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
						<PhoneIcon className="h-4 w-4" />
						<span>Contact</span>
					</div>
					<p className="mt-2 text-sm text-muted-foreground">
						No contact information
					</p>
				</CardContent>
			</Card>
		);
	}

	// Format phone for WhatsApp (remove non-digits, ensure country code)
	const whatsappPhone = phone?.replace(/\D/g, "") || "";

	return (
		<Card className={cn("shadow-none", className)}>
			<CardContent className="p-4">
				<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
					<PhoneIcon className="h-4 w-4" />
					<span>Contact</span>
				</div>

				<div className="mt-3 flex flex-wrap gap-2">
					{email && (
						<Button
							variant="outline"
							size="sm"
							className="h-8 text-xs"
							asChild
						>
							<a href={`mailto:${email}`}>
								<MailIcon className="h-3.5 w-3.5 mr-1.5" />
								{email}
							</a>
						</Button>
					)}

					{phone && (
						<Button
							variant="outline"
							size="sm"
							className="h-8 text-xs"
							asChild
						>
							<a href={`tel:${phone}`}>
								<PhoneIcon className="h-3.5 w-3.5 mr-1.5" />
								{phone}
							</a>
						</Button>
					)}

					{whatsappPhone && (
						<Button
							variant="outline"
							size="sm"
							className="h-8 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
							asChild
						>
							<a
								href={`https://wa.me/${whatsappPhone}`}
								target="_blank"
								rel="noopener noreferrer"
							>
								<MessageSquareIcon className="h-3.5 w-3.5 mr-1.5" />
								WhatsApp
							</a>
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
