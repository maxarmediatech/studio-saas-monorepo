"use client";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
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
	const [selectedContactId, setSelectedContactId] = useState<string | null>(
		null,
	);

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
	const selectedContact =
		contacts.find((contact) => contact.id === selectedContactId) ??
		contacts[0] ??
		null;
	const hasActiveFilters =
		Boolean(search.trim()) ||
		tag !== ALL_FILTER_VALUE ||
		linkType !== ALL_FILTER_VALUE ||
		blocked !== ALL_FILTER_VALUE ||
		optedOut !== ALL_FILTER_VALUE;

	return (
		<div className="grid min-h-[calc(100vh-5rem)] bg-background lg:grid-cols-[420px_minmax(0,1fr)]">
			<aside className="min-h-0 border-r bg-neutral-50/70">
				<div className="border-b bg-white px-4 py-4">
					<div>
						<h1 className="m-0 text-base font-semibold text-foreground">
							WhatsApp contacts
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Segment contacts before broadcasts and automation.
						</p>
					</div>
					<div className="mt-4 space-y-3">
						<div className="relative">
							<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								value={search}
								onChange={(event) =>
									setSearch(event.target.value)
								}
								placeholder="Search name, phone, wa id"
								className="pl-9"
							/>
						</div>
						<div className="grid grid-cols-2 gap-2">
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
									<SelectItem value="all">
										All links
									</SelectItem>
									<SelectItem value="linked">
										Linked
									</SelectItem>
									<SelectItem value="unlinked">
										Unlinked
									</SelectItem>
									<SelectItem value="client">
										Clients
									</SelectItem>
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
									<SelectItem value="all">
										All opt-outs
									</SelectItem>
									<SelectItem value="yes">
										Opted out
									</SelectItem>
									<SelectItem value="no">
										Not opted out
									</SelectItem>
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
									<SelectItem value="all">
										All blocked
									</SelectItem>
									<SelectItem value="yes">Blocked</SelectItem>
									<SelectItem value="no">
										Not blocked
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
						{hasActiveFilters ? (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 px-0 text-muted-foreground text-xs"
								onClick={() => {
									setSearch("");
									setTag(ALL_FILTER_VALUE);
									setLinkType(ALL_FILTER_VALUE);
									setBlocked(ALL_FILTER_VALUE);
									setOptedOut(ALL_FILTER_VALUE);
								}}
							>
								Clear filters
							</Button>
						) : null}
					</div>
				</div>

				<ScrollArea className="h-[calc(100vh-18rem)]">
					<div className="space-y-2 p-3">
						{contactsQuery.isLoading ? (
							Array.from({ length: 8 }).map((_, index) => (
								<div
									key={`contact-skeleton-${index + 1}`}
									className="rounded-xl border bg-white p-4"
								>
									<div className="h-4 w-36 animate-pulse rounded bg-neutral-200" />
									<div className="mt-2 h-3 w-24 animate-pulse rounded bg-neutral-200" />
								</div>
							))
						) : contacts.length === 0 ? (
							<Alert className="border-border/70 bg-background">
								<CircleAlertIcon />
								<AlertTitle>No contacts found</AlertTitle>
								<AlertDescription>
									Contacts appear after inbound messages or
									outbound sends.
								</AlertDescription>
							</Alert>
						) : (
							contacts.map((contact) => (
								<button
									type="button"
									key={contact.id}
									onClick={() =>
										setSelectedContactId(contact.id)
									}
									className={cn(
										"w-full rounded-xl border bg-white p-4 text-left transition",
										selectedContact?.id === contact.id
											? "border-neutral-900 shadow-xs"
											: "border-border/70 hover:border-neutral-300",
									)}
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<p className="m-0 truncate text-sm font-semibold text-foreground">
												{displayName(contact)}
											</p>
											<p className="mt-1 text-xs text-muted-foreground">
												{contact.phoneNumber}
											</p>
										</div>
										<Badge variant="outline">
											{getLinkLabel(contact)}
										</Badge>
									</div>
									<div className="mt-3 flex flex-wrap gap-2">
										{contact.isOptedOut ? (
											<Badge variant="destructive">
												<ShieldOffIcon className="mr-1 size-3" />
												Opted out
											</Badge>
										) : null}
										{contact.isBlocked ? (
											<Badge variant="destructive">
												<BanIcon className="mr-1 size-3" />
												Blocked
											</Badge>
										) : null}
										{contact.tags
											.slice(0, 2)
											.map((name) => (
												<Badge
													key={name}
													variant="secondary"
												>
													{name}
												</Badge>
											))}
										{contact.tags.length > 2 ? (
											<Badge variant="secondary">
												+{contact.tags.length - 2}
											</Badge>
										) : null}
									</div>
								</button>
							))
						)}
					</div>
				</ScrollArea>
			</aside>

			<section className="min-h-0 overflow-hidden bg-white">
				<ScrollArea className="h-full">
					<div className="space-y-5 px-4 py-5 lg:px-6">
						{selectedContact ? (
							<>
								<div className="flex flex-col gap-3 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
									<div>
										<h2 className="m-0 text-xl font-semibold text-foreground">
											{displayName(selectedContact)}
										</h2>
										<p className="mt-1 text-sm text-muted-foreground">
											{selectedContact.phoneNumber} • WA{" "}
											{selectedContact.waId}
										</p>
									</div>
									<div className="flex flex-wrap gap-2">
										<Badge variant="outline">
											{getLinkLabel(selectedContact)}
										</Badge>
										{selectedContact.isOptedOut ? (
											<Badge variant="destructive">
												Opted out
											</Badge>
										) : null}
										{selectedContact.isBlocked ? (
											<Badge variant="destructive">
												Blocked
											</Badge>
										) : null}
									</div>
								</div>

								<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
									<div className="space-y-4 rounded-xl border border-border/70 bg-neutral-50/60 p-4">
										<p className="m-0 text-sm font-semibold text-foreground">
											CRM link
										</p>
										<div className="grid gap-3 sm:grid-cols-2">
											<div className="rounded-lg border bg-white p-3">
												<p className="m-0 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
													Current link
												</p>
												<p className="mt-2 text-sm font-medium text-foreground">
													{getLinkLabel(
														selectedContact,
													)}
												</p>
												<p className="mt-1 break-all text-muted-foreground text-xs">
													{selectedContact.externalId ??
														"No client or crew linked yet"}
												</p>
											</div>
											<div className="rounded-lg border bg-white p-3">
												<p className="m-0 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
													Last message
												</p>
												<p className="mt-2 text-sm font-medium text-foreground">
													{formatDate(
														selectedContact.lastMessageAt,
													)}
												</p>
											</div>
										</div>
										<Alert className="border-blue-200 bg-blue-50 text-blue-950">
											<Link2Icon />
											<AlertTitle>
												Link action pending
											</AlertTitle>
											<AlertDescription>
												This page now exposes current
												client/crew link state. The next
												slice should add manual link and
												unlink mutations.
											</AlertDescription>
										</Alert>
									</div>

									<div className="space-y-4">
										<div className="rounded-xl border border-border/70 bg-white p-4">
											<p className="m-0 text-sm font-semibold text-foreground">
												Tags
											</p>
											{selectedContact.tags.length ===
											0 ? (
												<p className="mt-2 text-sm text-muted-foreground">
													No tags assigned.
												</p>
											) : (
												<div className="mt-3 flex flex-wrap gap-2">
													{selectedContact.tags.map(
														(name) => (
															<Badge
																key={name}
																variant="secondary"
															>
																<TagIcon className="mr-1 size-3" />
																{name}
															</Badge>
														),
													)}
												</div>
											)}
										</div>

										<div className="rounded-xl border border-border/70 bg-white p-4">
											<p className="m-0 text-sm font-semibold text-foreground">
												Delivery rules
											</p>
											<div className="mt-3 space-y-2 text-sm">
												<div className="flex items-center justify-between">
													<span>
														Broadcast opt-out
													</span>
													<Badge
														variant={
															selectedContact.isOptedOut
																? "destructive"
																: "outline"
														}
													>
														{selectedContact.isOptedOut
															? "Excluded"
															: "Allowed"}
													</Badge>
												</div>
												<div className="flex items-center justify-between">
													<span>Blocked</span>
													<Badge
														variant={
															selectedContact.isBlocked
																? "destructive"
																: "outline"
														}
													>
														{selectedContact.isBlocked
															? "Blocked"
															: "Open"}
													</Badge>
												</div>
											</div>
										</div>
									</div>
								</div>
							</>
						) : (
							<Alert className="border-border/70 bg-background">
								<CircleAlertIcon />
								<AlertTitle>Select a contact</AlertTitle>
								<AlertDescription>
									Pick a WhatsApp contact from the list.
								</AlertDescription>
							</Alert>
						)}
					</div>
				</ScrollArea>
			</section>
		</div>
	);
}
