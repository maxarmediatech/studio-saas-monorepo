"use client";

import { Input } from "@repo/ui/components/input";
import { quotesApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState } from "react";
import {
	canOfferCreateLead,
	getQuotationContactEnterAction,
} from "./quotation-contact-options";
import type { QuotationClient } from "./quotation-wizard-data";

export function ClientNameField({
	client,
	inputId,
	onNameChange,
	onSelect,
	onCreateLead,
}: {
	client: QuotationClient;
	inputId: string;
	onNameChange: (value: string) => void;
	onCreateLead: (value: string) => void;
	onSelect: (value: {
		id: string;
		name: string;
		email: string | null;
		phoneNumber: string | null;
		alternatePhone: string | null;
		address: string | null;
		metadata: Record<string, unknown> | null;
		updatedAt: string;
	}) => void;
}) {
	const [query, setQuery] = useState(client.name);
	const [debounced, setDebounced] = useState("");
	const [focused, setFocused] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);
	const listboxId = useId();
	useEffect(() => {
		const timeout = window.setTimeout(
			() => setDebounced(query.trim()),
			250,
		);
		return () => window.clearTimeout(timeout);
	}, [query]);
	const contacts = useQuery({
		...quotesApi.searchContactsOptions(debounced),
		enabled: debounced.length > 0 && focused,
	});
	const groups = contacts.data?.data;
	const results = useMemo(
		() => [...(groups?.leads ?? []), ...(groups?.clients ?? [])],
		[groups],
	);
	const choose = (item: (typeof results)[number]) => {
		setQuery(item.name);
		onSelect(item);
		setFocused(false);
		setActiveIndex(-1);
	};
	const createLead = () => {
		const name = query.trim();
		if (!name) {
			return;
		}
		setQuery(name);
		onCreateLead(name);
		setFocused(false);
		setActiveIndex(-1);
	};
	const createOptionIndex = results.length;
	const hasCreateOption = canOfferCreateLead(
		query,
		results.map(({ name }) => name),
		contacts.isFetching,
		groups !== undefined,
	);
	const optionCount = results.length + (hasCreateOption ? 1 : 0);
	return (
		<div className="relative">
			<Input
				id={inputId}
				role="combobox"
				aria-autocomplete="list"
				aria-expanded={focused && optionCount > 0}
				aria-controls={listboxId}
				aria-activedescendant={
					activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
				}
				value={query}
				placeholder="Enter or search client name"
				onFocus={() => setFocused(true)}
				onBlur={() => window.setTimeout(() => setFocused(false), 150)}
				onChange={(event) => {
					setQuery(event.target.value);
					onNameChange(event.target.value);
				}}
				onKeyDown={(event) => {
					if (event.key === "ArrowDown" && optionCount) {
						event.preventDefault();
						setFocused(true);
						setActiveIndex(
							(current) => (current + 1) % optionCount,
						);
					} else if (event.key === "ArrowUp" && optionCount) {
						event.preventDefault();
						setActiveIndex((current) =>
							current <= 0 ? optionCount - 1 : current - 1,
						);
					} else if (event.key === "Enter") {
						const action = getQuotationContactEnterAction(
							activeIndex,
							results.length,
							hasCreateOption,
						);
						if (action === "select" && results[activeIndex]) {
							event.preventDefault();
							choose(results[activeIndex]);
						} else if (action === "create") {
							event.preventDefault();
							createLead();
						}
					} else if (event.key === "Escape") {
						setFocused(false);
						setActiveIndex(-1);
					}
				}}
			/>
			{focused && optionCount > 0 ? (
				<div
					id={listboxId}
					role="listbox"
					className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
				>
					{groups
						? (["leads", "clients"] as const).map((group) =>
								groups[group].length ? (
									<div key={group}>
										<p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
											{group === "leads"
												? "Leads"
												: "Existing clients"}
										</p>
										{groups[group].map((item) => {
											const index = results.findIndex(
												(result) =>
													result.id === item.id,
											);
											return (
												<button
													type="button"
													role="option"
													aria-selected={
														activeIndex === index
													}
													id={`${listboxId}-${index}`}
													key={item.id}
													className={`block w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-accent ${activeIndex === index ? "bg-accent" : ""}`}
													onMouseDown={(event) =>
														event.preventDefault()
													}
													onMouseMove={() =>
														setActiveIndex(index)
													}
													onClick={() => choose(item)}
												>
													<span className="font-medium">
														{item.name}
													</span>
													<span className="ml-2 text-xs capitalize text-muted-foreground">
														{item.lifecycleStage} ·{" "}
														{item.phoneNumber ??
															item.email ??
															"name only"}
													</span>
												</button>
											);
										})}
									</div>
								) : null,
							)
						: null}
					{hasCreateOption ? (
						<button
							type="button"
							role="option"
							aria-selected={activeIndex === createOptionIndex}
							id={`${listboxId}-${createOptionIndex}`}
							className={`block w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-accent ${activeIndex === createOptionIndex ? "bg-accent" : ""}`}
							onMouseDown={(event) => event.preventDefault()}
							onMouseMove={() =>
								setActiveIndex(createOptionIndex)
							}
							onClick={createLead}
						>
							<span className="font-medium">
								Create lead: {query.trim()}
							</span>
							<span className="ml-2 text-xs text-muted-foreground">
								Name only is allowed
							</span>
						</button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
