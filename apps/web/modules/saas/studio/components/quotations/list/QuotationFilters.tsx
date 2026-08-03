import { Field, FieldLabel } from "@repo/ui/components/field";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@repo/ui/components/input-group";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { SearchIcon } from "lucide-react";
import {
	QUOTE_STATUS_LABELS,
	QUOTE_STATUSES,
	type QuoteSortDirection,
	type QuoteSortField,
} from "../quotation-helpers";

type ClientOption = { id: string; name: string };

export function QuotationFilters({
	search,
	status,
	clientId,
	sortBy,
	sortDirection,
	clients,
	canFilterClients,
	onSearch,
	onStatus,
	onClient,
	onSort,
}: {
	search: string;
	status: (typeof QUOTE_STATUSES)[number] | "all";
	clientId: string | "all";
	sortBy: QuoteSortField;
	sortDirection: QuoteSortDirection;
	clients: ClientOption[];
	canFilterClients: boolean;
	onSearch: (value: string) => void;
	onStatus: (value: string) => void;
	onClient: (value: string) => void;
	onSort: (sortBy: QuoteSortField, direction: QuoteSortDirection) => void;
}) {
	const sortValue = `${sortBy}:${sortDirection}`;
	return (
		<div className="flex flex-col gap-2 lg:flex-row">
			<Field className="min-w-0 flex-1">
				<FieldLabel className="sr-only" htmlFor="quotation-search">
					Search quotations
				</FieldLabel>
				<InputGroup>
					<InputGroupAddon>
						<SearchIcon aria-hidden="true" />
					</InputGroupAddon>
					<InputGroupInput
						id="quotation-search"
						value={search}
						onChange={(event) => onSearch(event.target.value)}
						placeholder="Search quotation, number or client…"
					/>
				</InputGroup>
			</Field>
			<div className="grid grid-cols-2 gap-2 sm:flex">
				<Select value={status} onValueChange={onStatus}>
					<SelectTrigger
						aria-label="Filter by status"
						className="w-full sm:w-40"
					>
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectLabel>Status</SelectLabel>
							<SelectItem value="all">All statuses</SelectItem>
							{QUOTE_STATUSES.map((item) => (
								<SelectItem key={item} value={item}>
									{QUOTE_STATUS_LABELS[item]}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
				{canFilterClients ? (
					<Select value={clientId} onValueChange={onClient}>
						<SelectTrigger
							aria-label="Filter by client"
							className="w-full sm:w-48"
						>
							<SelectValue placeholder="Client" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectLabel>Client</SelectLabel>
								<SelectItem value="all">All clients</SelectItem>
								{clients.map((client) => (
									<SelectItem
										key={client.id}
										value={client.id}
									>
										{client.name}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				) : null}
				<Select
					value={sortValue}
					onValueChange={(value) => {
						const [nextSort, nextDirection] = value.split(":") as [
							QuoteSortField,
							QuoteSortDirection,
						];
						onSort(nextSort, nextDirection);
					}}
				>
					<SelectTrigger
						aria-label="Sort quotations"
						className="col-span-2 w-full sm:w-48"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectLabel>Sort</SelectLabel>
							<SelectItem value="createdAt:desc">
								Newest created
							</SelectItem>
							<SelectItem value="updatedAt:desc">
								Recently updated
							</SelectItem>
							<SelectItem value="quoteNumber:asc">
								Number A–Z
							</SelectItem>
							<SelectItem value="expiresAt:asc">
								Expiry soonest
							</SelectItem>
						</SelectGroup>
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}
