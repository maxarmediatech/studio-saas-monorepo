"use client";

import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { ExternalLinkIcon, FileTextIcon, LinkIcon } from "lucide-react";

type QuickLink = {
	label: string;
	type: "pdf" | "doc" | "link";
	href?: string;
};

type QuickLinksCardProps = {
	links?: QuickLink[];
};

const defaultLinks: QuickLink[] = [
	{ label: "Signed contract", type: "pdf" },
	{ label: "Event timeline", type: "doc" },
	{ label: "Moodboard", type: "link" },
];

function getLinkIcon(type: QuickLink["type"]) {
	switch (type) {
		case "link":
			return LinkIcon;
		default:
			return FileTextIcon;
	}
}

function getLinkTypeName(type: QuickLink["type"]) {
	switch (type) {
		case "pdf":
			return "PDF";
		case "doc":
			return "Doc";
		case "link":
			return "Link";
	}
}

export function QuickLinksCard({ links = defaultLinks }: QuickLinksCardProps) {
	return (
		<Card className="shadow-none rounded-lg">
			<CardHeader>
				<CardTitle className="text-base">Quick links</CardTitle>
				<CardDescription>Shortcuts for key references.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{links.map((link) => {
					const Icon = getLinkIcon(link.type);
					return (
						<div
							key={link.label}
							className="flex items-center justify-between rounded-lg border bg-muted/10 px-3 py-2 text-sm"
						>
							<div className="flex items-center gap-3">
								<div className="rounded-md border bg-background p-2">
									<Icon className="h-4 w-4 text-muted-foreground" />
								</div>
								<div>
									<p className="text-sm font-medium">{link.label}</p>
									<p className="text-xs text-muted-foreground">
										{getLinkTypeName(link.type)}
									</p>
								</div>
							</div>
							<Button
								size="icon"
								variant="ghost"
								disabled={!link.href}
								className="shrink-0"
							>
								<ExternalLinkIcon className="h-4 w-4" />
								<span className="sr-only">Open {link.label}</span>
							</Button>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
