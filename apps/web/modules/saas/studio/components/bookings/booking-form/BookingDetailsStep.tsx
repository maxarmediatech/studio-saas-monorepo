"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { PlusIcon, TrashIcon } from "lucide-react";
import { configurationsApi, clientsApi } from "@saas/studio/lib/api";
import type { BookingFormValues } from "./booking-form-schema";

export function BookingDetailsStep() {
	const form = useFormContext<BookingFormValues>();

	// Fetch configurations
	const { data: bookingTypesData } = useQuery(configurationsApi.bookingTypesOptions());
	const { data: packageTypesData } = useQuery(configurationsApi.packageTypesOptions());
	const { data: relationTypesData } = useQuery(configurationsApi.relationTypesOptions());
	const { data: clientsData } = useQuery(clientsApi.listOptions({ limit: 100 }));

	const bookingTypes = bookingTypesData?.data ?? [];
	const packageTypes = packageTypesData?.data ?? [];
	const relationTypes = relationTypesData?.data ?? [];
	const clients = clientsData?.data ?? [];

	const {
		fields: participants,
		append: appendParticipant,
		remove: removeParticipant,
	} = useFieldArray({
		control: form.control,
		name: "participants",
	});

	const selectedBookingType = form.watch("bookingType");

	// Filter package types by booking type if metadata specifies it
	const filteredPackageTypes = packageTypes.filter((pkg) => {
		if (!selectedBookingType) return true;
		const bookingTypeMetadata = pkg.metadata as { bookingType?: string } | null;
		return !bookingTypeMetadata?.bookingType || bookingTypeMetadata.bookingType === selectedBookingType;
	});

	// Handle package selection - auto-fill cost
	const handlePackageChange = (value: string) => {
		form.setValue("packageType", value);
		const selectedPackage = packageTypes.find((p) => p.key === value);
		if (selectedPackage?.metadata) {
			const metadata = selectedPackage.metadata as { defaultCost?: string };
			if (metadata.defaultCost) {
				form.setValue("packageCost", metadata.defaultCost);
			}
		}
	};

	return (
		<div className="space-y-6">
			{/* Booking Details Card */}
			<Card>
				<CardHeader>
					<CardTitle>Booking Details</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
						{/* Booking Name */}
						<div className="md:col-span-2">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Booking Name</FormLabel>
										<FormControl>
											<Input {...field} placeholder="e.g. John & Jane Wedding" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* Booking Type */}
						<FormField
							control={form.control}
							name="bookingType"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Booking Type</FormLabel>
									<Select onValueChange={field.onChange} value={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select type" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{bookingTypes.map((type) => (
												<SelectItem key={type.id} value={type.key}>
													{type.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Package Type */}
						<FormField
							control={form.control}
							name="packageType"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Package</FormLabel>
									<Select
										onValueChange={handlePackageChange}
										value={field.value}
										disabled={!selectedBookingType}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select package" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{filteredPackageTypes.length > 0 ? (
												filteredPackageTypes.map((pkg) => (
													<SelectItem key={pkg.id} value={pkg.key}>
														{pkg.label}
													</SelectItem>
												))
											) : (
												<div className="p-2 text-sm text-muted-foreground text-center">
													No packages found
												</div>
											)}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Package Cost */}
						<FormField
							control={form.control}
							name="packageCost"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Package Cost</FormLabel>
									<FormControl>
										<div className="relative">
											<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
												₹
											</span>
											<Input
												{...field}
												className="pl-7"
												placeholder="0.00"
												disabled={!selectedBookingType}
											/>
										</div>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Notes */}
						<div className="md:col-span-2 lg:col-span-4">
							<FormField
								control={form.control}
								name="note"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Notes</FormLabel>
										<FormControl>
											<Textarea
												{...field}
												placeholder="Add any booking specific notes or requests"
												rows={2}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Participants Card */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<CardTitle>Participants</CardTitle>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() =>
							appendParticipant({
								clientId: "",
								role: "",
							})
						}
					>
						<PlusIcon className="mr-2 h-4 w-4" />
						Add Participant
					</Button>
				</CardHeader>
				<CardContent className="space-y-4">
					{participants.length === 0 ? (
						<p className="text-sm text-muted-foreground text-center py-4">
							No participants added. Click "Add Participant" to add clients to this booking.
						</p>
					) : (
						participants.map((field, index) => (
							<Card key={field.id} className="p-4">
								<div className="flex items-start gap-4">
									<div className="flex-1 grid gap-4 md:grid-cols-2">
										{/* Client Select */}
										<FormField
											control={form.control}
											name={`participants.${index}.clientId`}
											render={({ field }) => (
												<FormItem>
													<FormLabel>Client</FormLabel>
													<Select
														onValueChange={field.onChange}
														value={field.value}
													>
														<FormControl>
															<SelectTrigger>
																<SelectValue placeholder="Select client" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															{clients.map((client) => (
																<SelectItem key={client.id} value={client.id}>
																	{client.name}
																	{client.email && (
																		<span className="text-muted-foreground ml-2">
																			({client.email})
																		</span>
																	)}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>

										{/* Role Select */}
										<FormField
											control={form.control}
											name={`participants.${index}.role`}
											render={({ field }) => (
												<FormItem>
													<FormLabel>Role</FormLabel>
													<Select
														onValueChange={field.onChange}
														value={field.value}
													>
														<FormControl>
															<SelectTrigger>
																<SelectValue placeholder="Select role" />
															</SelectTrigger>
														</FormControl>
														<SelectContent>
															{relationTypes.map((type) => (
																<SelectItem key={type.id} value={type.key}>
																	{type.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									{/* Remove Button */}
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="mt-8"
										onClick={() => removeParticipant(index)}
										disabled={participants.length <= 1}
									>
										<TrashIcon className="h-4 w-4 text-destructive" />
									</Button>
								</div>
							</Card>
						))
					)}
				</CardContent>
			</Card>
		</div>
	);
}
