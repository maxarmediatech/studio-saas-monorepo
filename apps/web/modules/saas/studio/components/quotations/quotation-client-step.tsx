"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { ClientNameField } from "./quotation-client-name-field";
import { QuotationDetailsSection } from "./quotation-details-section";
import type { QuotationClient, QuotationDraft } from "./quotation-wizard-data";
import {
	createDraftId,
	createLeadFromQuotationClient,
	updateQuotationClientField,
} from "./quotation-wizard-data";
import { FieldBlock } from "./quotation-wizard-parts";

const SOURCE_SUGGESTIONS = [
	"Word of Mouth",
	"Instagram",
	"Google",
	"Referral",
	"Wedding Portal",
	"Previous Client",
];

type PatchDraft = <K extends keyof QuotationDraft>(
	key: K,
	value: QuotationDraft[K],
) => void;

export function ClientStep({
	draft,
	patchDraft,
	errors,
}: {
	draft: QuotationDraft;
	patchDraft: PatchDraft;
	errors: Record<string, string>;
}) {
	const clients = draft.clients ?? [];

	const addClient = () => {
		patchDraft("clients", [
			...clients,
			{
				id: createDraftId("client"),
				clientId: null,
				clientUpdatedAt: null,
				persistAsLead: false,
				name: "",
				email: "",
				phoneNumber: "",
				alternatePhone: "",
				address: "",
				profession: "",
				source: "",
				socialHandle: "",
				notes: "",
			},
		]);
	};

	const updateClient = (
		id: string,
		key: keyof QuotationClient,
		value: string,
	) => {
		patchDraft(
			"clients",
			clients.map((client) =>
				client.id === id
					? updateQuotationClientField(client, key, value)
					: client,
			),
		);
	};
	const selectClient = (
		id: string,
		selected: {
			id: string;
			name: string;
			email: string | null;
			phoneNumber: string | null;
			alternatePhone: string | null;
			address: string | null;
			metadata: Record<string, unknown> | null;
			updatedAt: string;
		},
	) => {
		const metadata = selected.metadata ?? {};
		patchDraft(
			"clients",
			clients.map((client) =>
				client.id === id
					? {
							...client,
							clientId: selected.id,
							clientUpdatedAt: selected.updatedAt,
							persistAsLead: false,
							name: selected.name,
							email: selected.email ?? "",
							phoneNumber: selected.phoneNumber ?? "",
							alternatePhone: selected.alternatePhone ?? "",
							address: selected.address ?? "",
							profession: String(metadata.profession ?? ""),
							source: String(metadata.source ?? ""),
							socialHandle: String(metadata.socialHandle ?? ""),
							notes: String(metadata.notes ?? ""),
						}
					: client,
			),
		);
	};
	const createLead = (id: string, name: string) => {
		patchDraft(
			"clients",
			clients.map((client) =>
				client.id === id
					? createLeadFromQuotationClient(client, name)
					: client,
			),
		);
	};

	const removeClient = (id: string) => {
		if (clients.length === 1) {
			return;
		}
		patchDraft(
			"clients",
			clients.filter((client) => client.id !== id),
		);
	};

	return (
		<div className="space-y-4">
			<QuotationDetailsSection
				draft={draft}
				patchDraft={patchDraft}
				errors={errors}
			/>
			<h2 className="text-lg font-semibold">Client details</h2>
			<Card>
				<CardContent className="space-y-6">
					<div className="space-y-4">
						{clients.length === 0 ? (
							<div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-6">
								<UsersIcon className="h-8 w-8 shrink-0 text-muted-foreground/50" />
								<div className="text-left">
									<p className="text-sm text-muted-foreground">
										No clients added yet
									</p>
									<Button
										type="button"
										variant="link"
										size="sm"
										className="h-auto p-0"
										onClick={addClient}
									>
										Add first client
									</Button>
								</div>
							</div>
						) : (
							clients.map((client, index) => (
								<div
									key={client.id}
									className="overflow-hidden rounded-lg border bg-muted/10"
								>
									<div className="flex items-center justify-between gap-2 border-b bg-muted/20 px-4 py-3">
										<div className="flex items-center gap-2">
											<UsersIcon className="h-4 w-4 text-muted-foreground" />
											<span className="text-sm font-medium">
												Client {index + 1}
											</span>
										</div>
										{clients.length > 1 && (
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
												onClick={() =>
													removeClient(client.id)
												}
											>
												<Trash2Icon className="h-4 w-4" />
												<span className="sr-only">
													Remove client
												</span>
											</Button>
										)}
									</div>
									<div className="space-y-4 p-4">
										<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
											<FieldBlock
												label="Name *"
												error={
													errors[
														`quotation-client-${client.id}-name`
													]
												}
											>
												<ClientNameField
													client={client}
													inputId={`quotation-client-${client.id}-name`}
													onNameChange={(name) =>
														updateClient(
															client.id,
															"name",
															name,
														)
													}
													onCreateLead={(name) =>
														createLead(
															client.id,
															name,
														)
													}
													onSelect={(selected) =>
														selectClient(
															client.id,
															selected,
														)
													}
												/>
											</FieldBlock>
											<FieldBlock label="Email">
												<Input
													type="email"
													value={client.email}
													placeholder="email@example.com"
													onChange={(event) =>
														updateClient(
															client.id,
															"email",
															event.target.value,
														)
													}
												/>
											</FieldBlock>
										</div>
										<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
											<FieldBlock label="Phone">
												<Input
													value={client.phoneNumber}
													placeholder="+91 9876543210"
													onChange={(event) =>
														updateClient(
															client.id,
															"phoneNumber",
															event.target.value,
														)
													}
												/>
											</FieldBlock>
											<FieldBlock label="Alternate Phone">
												<Input
													value={
														client.alternatePhone
													}
													placeholder="+91 9876543210"
													onChange={(event) =>
														updateClient(
															client.id,
															"alternatePhone",
															event.target.value,
														)
													}
												/>
											</FieldBlock>
										</div>
										<FieldBlock label="Address">
											<Textarea
												value={client.address}
												placeholder="Enter full address"
												rows={2}
												onChange={(event) =>
													updateClient(
														client.id,
														"address",
														event.target.value,
													)
												}
											/>
										</FieldBlock>
										<CollapsibleSection
											title="Additional Info"
											defaultOpen={false}
										>
											<FieldBlock label="How did they find you?">
												<Input
													value={client.source}
													placeholder="e.g. Instagram, Friend's referral"
													onChange={(event) =>
														updateClient(
															client.id,
															"source",
															event.target.value,
														)
													}
												/>
												<div className="flex flex-wrap gap-1.5 pt-1.5">
													{SOURCE_SUGGESTIONS.map(
														(suggestion) => (
															<Badge
																key={suggestion}
																variant="outline"
																className="cursor-pointer text-xs transition-colors hover:bg-accent"
																onClick={() =>
																	updateClient(
																		client.id,
																		"source",
																		suggestion,
																	)
																}
															>
																{suggestion}
															</Badge>
														),
													)}
												</div>
											</FieldBlock>
											<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
												<FieldBlock label="Profession">
													<Input
														value={
															client.profession
														}
														placeholder="e.g. Software Engineer, Doctor"
														onChange={(event) =>
															updateClient(
																client.id,
																"profession",
																event.target
																	.value,
															)
														}
													/>
												</FieldBlock>
												<FieldBlock label="Social Handle">
													<Input
														value={
															client.socialHandle
														}
														placeholder="@instagram_handle"
														onChange={(event) =>
															updateClient(
																client.id,
																"socialHandle",
																event.target
																	.value,
															)
														}
													/>
												</FieldBlock>
											</div>
											<FieldBlock label="Notes">
												<Textarea
													value={client.notes}
													placeholder="Preferences, expectations, cultural considerations..."
													className="resize-none"
													rows={3}
													onChange={(event) =>
														updateClient(
															client.id,
															"notes",
															event.target.value,
														)
													}
												/>
											</FieldBlock>
										</CollapsibleSection>
									</div>
								</div>
							))
						)}
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="w-full justify-center border-dashed"
							onClick={addClient}
						>
							<PlusIcon className="mr-2 h-4 w-4" />
							Add another client
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
