"use client";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";
import { whatsappApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
	BanIcon,
	CircleAlertIcon,
	Link2Icon,
	SearchIcon,
	ShieldOffIcon,
	TagIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
	ALL_FILTER_VALUE,
	buildContactsInput,
	displayName,
	type FlagFilter,
	formatDate,
	getLinkLabel,
	type LinkType,
} from "./contacts-page-utils";

export function WhatsAppContactsPageClient() {
	const [search, setSearch] = useState("");
	const [tag, setTag] = useState(ALL_FILTER_VALUE);
	const [linkType, setLinkType] = useState<LinkType>(ALL_FILTER_VALUE);
	const [blocked, setBlocked] = useState<FlagFilter>(ALL_FILTER_VALUE);
	const [optedOut, setOptedOut] = useState<FlagFilter>(ALL_FILTER_VALUE);

	const contactsInput = useMemo(
		() =>
			buildContactsInput({
				search,
				tag,
				linkType,
				blocked,
				optedOut,
			}),
		[blocked, linkType, optedOut, search, tag],
	);

	const contactsQuery = useQuery({
		...whatsappApi.listContactsOptions(contactsInput),
		refetchOnWindowFocus: false,
	});
	const tagsQuery = useQuery({
		...whatsappApi.listContactTagsOptions(),
		refetchOnWindowFocus: false,
	});

	const contacts = contactsQuery.data?.data ?? [];
	const tags = tagsQuery.data?.data ?? [];
	const linkedCount = contacts.filter((contact) => contact.externalId).length;
	const optedOutCount = contacts.filter(
		(contact) => contact.isOptedOut,
	).length;
	const blockedCount = contacts.filter((contact) => contact.isBlocked).length;
	const hasActiveFilters =
		Boolean(search.trim()) ||
		tag !== ALL_FILTER_VALUE ||
		linkType !== ALL_FILTER_VALUE ||
		blocked !== ALL_FILTER_VALUE ||
		optedOut !== ALL_FILTER_VALUE;

	return (
		<div className="flex min-h-[calc(100vh-5rem)] flex-col bg-background">
			<div className="border-b bg-white px-4 py-4 lg:px-6">
				<div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
					<div>
						<h1 className="m-0 text-base font-semibold text-foreground">
							WhatsApp contacts
						</h1>
						<div className="mt-2 flex flex-wrap gap-2">
							<Badge variant="outline">
								{contacts.length} visible
							</Badge>
							<Badge variant="outline">
								{linkedCount} linked
							</Badge>
							{optedOutCount > 0 ? (
								<Badge variant="destructive">
									{optedOutCount} opted out
								</Badge>
							) : null}
							{blockedCount > 0 ? (
								<Badge variant="destructive">
									{blockedCount} blocked
								</Badge>
							) : null}
						</div>
					</div>

					<div className="grid gap-2 md:grid-cols-[minmax(220px,320px)_130px_130px_130px_130px_auto]">
						<div className="relative">
							<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={search}
								onChange={(event) =>
									setSearch(event.target.value)
								}
								placeholder="Search name, phone, WA ID"
								className="h-9 pl-9"
							/>
						</div>
						<Select value={tag} onValueChange={setTag}>
							<SelectTrigger className="h-9 text-xs">
								<SelectValue placeholder="Tag" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={ALL_FILTER_VALUE}>
									All tags
								</SelectItem>
								{tags.map((item) => (
									<SelectItem
										key={item.name}
										value={item.name}
									>
										{item.name} ({item.contactCount})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select
							value={linkType}
							onValueChange={(value) =>
								setLinkType(value as LinkType)
							}
						>
							<SelectTrigger className="h-9 text-xs">
								<SelectValue placeholder="Link" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All links</SelectItem>
								<SelectItem value="linked">Linked</SelectItem>
								<SelectItem value="unlinked">
									Unlinked
								</SelectItem>
								<SelectItem value="client">Clients</SelectItem>
								<SelectItem value="crew">Crew</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={optedOut}
							onValueChange={(value) =>
								setOptedOut(value as FlagFilter)
							}
						>
							<SelectTrigger className="h-9 text-xs">
								<SelectValue placeholder="Opt-out" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Opt-out</SelectItem>
								<SelectItem value="yes">Opted out</SelectItem>
								<SelectItem value="no">Allowed</SelectItem>
							</SelectContent>
						</Select>
						<Select
							value={blocked}
							onValueChange={(value) =>
								setBlocked(value as FlagFilter)
							}
						>
							<SelectTrigger className="h-9 text-xs">
								<SelectValue placeholder="Blocked" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Blocked</SelectItem>
								<SelectItem value="yes">Blocked</SelectItem>
								<SelectItem value="no">Open</SelectItem>
							</SelectContent>
						</Select>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className={cn(
								"h-9 px-2 text-xs",
								!hasActiveFilters && "invisible",
							)}
							onClick={() => {
								setSearch("");
								setTag(ALL_FILTER_VALUE);
								setLinkType(ALL_FILTER_VALUE);
								setBlocked(ALL_FILTER_VALUE);
								setOptedOut(ALL_FILTER_VALUE);
							}}
						>
							Clear
						</Button>
					</div>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-auto">
				{contactsQuery.isLoading ? (
					<div className="space-y-2 p-4 lg:p-6">
						{Array.from({ length: 8 }).map((_, index) => (
							<div
								key={`contact-skeleton-${index + 1}`}
								className="h-14 animate-pulse rounded-lg bg-neutral-100"
							/>
						))}
					</div>
				) : contacts.length === 0 ? (
					<div className="p-4 lg:p-6">
						<Alert className="border-border/70 bg-background">
							<CircleAlertIcon />
							<AlertTitle>No contacts found</AlertTitle>
							<AlertDescription>
								Contacts appear after inbound messages or
								outbound sends.
							</AlertDescription>
						</Alert>
					</div>
				) : (
					<table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
						<thead className="sticky top-0 z-10 bg-neutral-50 text-muted-foreground text-xs">
							<tr>
								<th className="border-b px-6 py-3 text-left font-medium">
									Contact
								</th>
								<th className="border-b px-4 py-3 text-left font-medium">
									Tags
								</th>
								<th className="border-b px-4 py-3 text-left font-medium">
									CRM link
								</th>
								<th className="border-b px-4 py-3 text-left font-medium">
									Rules
								</th>
								<th className="border-b px-4 py-3 text-left font-medium">
									Last message
								</th>
								<th className="border-b px-6 py-3 text-right font-medium">
									Next action
								</th>
							</tr>
						</thead>
						<tbody>
							{contacts.map((contact) => (
								<tr
									key={contact.id}
									className="bg-white hover:bg-neutral-50/80"
								>
									<td className="border-b px-6 py-4 align-top">
										<div className="font-medium text-foreground">
											{displayName(contact)}
										</div>
										<div className="mt-1 text-muted-foreground text-xs">
											{contact.phoneNumber} • WA{" "}
											{contact.waId}
										</div>
									</td>
									<td className="border-b px-4 py-4 align-top">
										<div className="flex max-w-[260px] flex-wrap gap-1.5">
											{contact.tags.length === 0 ? (
												<span className="text-muted-foreground text-xs">
													No tags
												</span>
											) : (
												contact.tags.map((name) => (
													<Badge
														key={name}
														variant="secondary"
													>
														<TagIcon className="mr-1 size-3" />
														{name}
													</Badge>
												))
											)}
										</div>
									</td>
									<td className="border-b px-4 py-4 align-top">
										<div className="flex items-center gap-2">
											<Link2Icon className="size-3.5 text-muted-foreground" />
											<Badge variant="outline">
												{getLinkLabel(contact)}
											</Badge>
										</div>
										{contact.externalId ? (
											<div className="mt-1 max-w-[180px] truncate text-muted-foreground text-xs">
												{contact.externalId}
											</div>
										) : null}
									</td>
									<td className="border-b px-4 py-4 align-top">
										<div className="flex flex-wrap gap-1.5">
											{contact.isOptedOut ? (
												<Badge variant="destructive">
													<ShieldOffIcon className="mr-1 size-3" />
													Opted out
												</Badge>
											) : (
												<Badge variant="outline">
													Allowed
												</Badge>
											)}
											{contact.isBlocked ? (
												<Badge variant="destructive">
													<BanIcon className="mr-1 size-3" />
													Blocked
												</Badge>
											) : null}
										</div>
									</td>
									<td className="border-b px-4 py-4 align-top text-muted-foreground">
										{formatDate(contact.lastMessageAt)}
									</td>
									<td className="border-b px-6 py-4 text-right align-top">
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled
											className="h-8"
										>
											Link
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}
