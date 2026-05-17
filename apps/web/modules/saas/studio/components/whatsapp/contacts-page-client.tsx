"use client";

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
import {
	DataTable,
	DataTableColumnHeader,
	DataTableRowActions,
	DataTableViewOptions,
	type RowAction,
} from "@saas/shared/components/data-table";
import "@saas/shared/components/data-table/types";
import { whatsappApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	BanIcon,
	Link2Icon,
	PencilIcon,
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
	type WhatsAppContact,
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
	const hasActiveFilters =
		Boolean(search.trim()) ||
		tag !== ALL_FILTER_VALUE ||
		linkType !== ALL_FILTER_VALUE ||
		blocked !== ALL_FILTER_VALUE ||
		optedOut !== ALL_FILTER_VALUE;

	const rowActions: RowAction<WhatsAppContact>[] = useMemo(
		() => [
			{
				label: "Link to CRM",
				icon: <Link2Icon className="h-4 w-4" />,
				disabled: true,
				onClick: () => {},
			},
			{
				label: "Edit tags",
				icon: <PencilIcon className="h-4 w-4" />,
				disabled: true,
				onClick: () => {},
			},
		],
		[],
	);

	const columns: ColumnDef<WhatsAppContact>[] = useMemo(
		() => [
			{
				id: "contact",
				accessorKey: "phoneNumber",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Contact" />
				),
				cell: ({ row }) => (
					<div>
						<p className="m-0 font-medium text-foreground">
							{displayName(row.original)}
						</p>
						<p className="mt-1 text-muted-foreground text-xs">
							{row.original.phoneNumber} • WA {row.original.waId}
						</p>
					</div>
				),
				meta: {
					label: "Contact",
					width: 260,
					minWidth: 220,
					headerClassName:
						"!border-r-0 bg-gray-100 z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[0.5px] after:bg-table-border-subtle",
					cellClassName:
						"!border-r-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[0.5px] before:bg-table-border-subtle after:absolute after:right-0 after:top-0 after:bottom-0 after:w-[0.5px] after:bg-table-border-subtle",
				},
				enableSorting: false,
				enableHiding: false,
			},
			{
				id: "tags",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Tags" />
				),
				cell: ({ row }) => (
					<div className="flex max-w-[260px] flex-wrap gap-1.5">
						{row.original.tags.length === 0 ? (
							<span className="text-muted-foreground">—</span>
						) : (
							row.original.tags.map((name) => (
								<Badge key={name} variant="secondary">
									<TagIcon className="mr-1 size-3" />
									{name}
								</Badge>
							))
						)}
					</div>
				),
				meta: {
					label: "Tags",
					width: 240,
					minWidth: 180,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "crmLink",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="CRM Link" />
				),
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<Link2Icon className="size-3.5 text-muted-foreground" />
						<Badge variant="outline">
							{getLinkLabel(row.original)}
						</Badge>
					</div>
				),
				meta: {
					label: "CRM Link",
					width: 150,
					minWidth: 130,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "rules",
				header: ({ column }) => (
					<DataTableColumnHeader column={column} title="Rules" />
				),
				cell: ({ row }) => (
					<div className="flex flex-wrap gap-1.5">
						{row.original.isOptedOut ? (
							<Badge variant="destructive">
								<ShieldOffIcon className="mr-1 size-3" />
								Opted out
							</Badge>
						) : (
							<Badge variant="outline">Allowed</Badge>
						)}
						{row.original.isBlocked ? (
							<Badge variant="destructive">
								<BanIcon className="mr-1 size-3" />
								Blocked
							</Badge>
						) : null}
					</div>
				),
				meta: {
					label: "Rules",
					width: 180,
					minWidth: 160,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "lastMessageAt",
				accessorKey: "lastMessageAt",
				header: ({ column }) => (
					<DataTableColumnHeader
						column={column}
						title="Last Message"
					/>
				),
				cell: ({ row }) => (
					<span className="text-muted-foreground">
						{formatDate(row.original.lastMessageAt)}
					</span>
				),
				meta: {
					label: "Last Message",
					width: 160,
					minWidth: 140,
				},
				enableSorting: false,
				enableHiding: true,
			},
			{
				id: "actions",
				header: ({ table }) => <DataTableViewOptions table={table} />,
				cell: ({ row }) => (
					<DataTableRowActions
						row={row.original}
						actions={rowActions}
					/>
				),
				enableSorting: false,
				enableHiding: false,
				meta: {
					width: 48,
					minWidth: 48,
					headerClassName:
						"!px-0 md:sticky md:right-0 bg-gray-100 z-10",
					cellClassName:
						"!px-0 md:sticky md:right-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10",
				},
			},
		],
		[rowActions],
	);

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
				<div className="relative w-full max-w-sm">
					<SearchIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search contacts..."
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						className="pl-9"
					/>
				</div>
				<div className="flex flex-wrap gap-2">
					<Select value={tag} onValueChange={setTag}>
						<SelectTrigger className="h-9 w-[150px]">
							<SelectValue placeholder="Tag" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL_FILTER_VALUE}>
								All tags
							</SelectItem>
							{tags.map((item) => (
								<SelectItem key={item.name} value={item.name}>
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
						<SelectTrigger className="h-9 w-[150px]">
							<SelectValue placeholder="Link" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All links</SelectItem>
							<SelectItem value="linked">Linked</SelectItem>
							<SelectItem value="unlinked">Unlinked</SelectItem>
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
						<SelectTrigger className="h-9 w-[140px]">
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
						<SelectTrigger className="h-9 w-[130px]">
							<SelectValue placeholder="Blocked" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Blocked</SelectItem>
							<SelectItem value="yes">Blocked</SelectItem>
							<SelectItem value="no">Open</SelectItem>
						</SelectContent>
					</Select>
					{hasActiveFilters ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								setSearch("");
								setTag(ALL_FILTER_VALUE);
								setLinkType(ALL_FILTER_VALUE);
								setBlocked(ALL_FILTER_VALUE);
								setOptedOut(ALL_FILTER_VALUE);
							}}
						>
							Reset
						</Button>
					) : null}
				</div>
			</div>

			<DataTable
				columns={columns}
				data={contacts}
				isLoading={contactsQuery.isLoading}
				isFetching={contactsQuery.isFetching}
				getRowId={(row) => row.id}
				stickyLeftColumns={[{ id: "contact", width: 260 }]}
				stickyRightColumns={[{ id: "actions", width: 48 }]}
				minWidth={1040}
				scrollControlsColumnId="contact"
				scrollStartColumn={1}
				emptyState={
					<div className="flex flex-col items-center gap-2">
						<Link2Icon className="h-12 w-12 text-muted-foreground/50" />
						<p className="text-muted-foreground">
							No WhatsApp contacts found
						</p>
					</div>
				}
			/>
		</div>
	);
}
