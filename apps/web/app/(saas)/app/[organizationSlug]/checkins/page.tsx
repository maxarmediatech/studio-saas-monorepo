"use client";

import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Textarea } from "@repo/ui/components/textarea";
import { checkinsApi, checkinsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, nextMonday } from "date-fns";
import { Hand, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const FREQUENCY_OPTIONS = [
	{ value: "daily", label: "Every day" },
	{ value: "weekdays", label: "Monday to Friday" },
	{ value: "weekly", label: "Every week" },
] as const;

function getNextCheckinDate(
	frequency: "daily" | "weekdays" | "weekly",
	scheduledTime?: string,
): string {
	const now = new Date();
	let nextDate: Date;

	switch (frequency) {
		case "daily":
			nextDate = addDays(now, 1);
			break;
		case "weekdays": {
			const dayOfWeek = now.getDay();
			if (dayOfWeek === 5) nextDate = addDays(now, 3);
			else if (dayOfWeek === 6) nextDate = addDays(now, 2);
			else nextDate = addDays(now, 1);
			break;
		}
		case "weekly":
			nextDate = nextMonday(now);
			break;
		default:
			nextDate = addDays(now, 1);
	}

	const timeStr = scheduledTime ?? "09:00";
	return `${format(nextDate, "EEE d MMM")} @ ${timeStr}`;
}

interface CheckinTypeCardProps {
	checkinType: {
		id: string;
		name: string;
		emoji: string | null;
		frequency: "daily" | "weekdays" | "weekly";
		scheduledTime: string | null;
	};
	organizationSlug: string;
}

function CheckinTypeCard({
	checkinType,
	organizationSlug,
}: CheckinTypeCardProps) {
	const nextCheckin = getNextCheckinDate(
		checkinType.frequency,
		checkinType.scheduledTime ?? undefined,
	);

	return (
		<Link
			href={`/app/${organizationSlug}/checkins/${checkinType.id}`}
			className="flex items-center justify-between p-4 rounded-lg hover:bg-neutral-50 transition-colors group"
		>
			<div className="flex items-center gap-3">
				<span className="text-2xl">{checkinType.emoji ?? "👋"}</span>
				<div>
					<div className="font-medium text-neutral-900">
						{checkinType.name}
					</div>
					<div className="text-sm text-neutral-500">
						Next: {nextCheckin}
					</div>
				</div>
			</div>
			<Button
				variant="ghost"
				size="icon"
				className="opacity-0 group-hover:opacity-100 transition-opacity"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
				}}
			>
				<MoreHorizontal className="size-4" />
			</Button>
		</Link>
	);
}

interface CreateCheckinTypeDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	teams: Array<{ id: string; name: string }>;
}

function CreateCheckinTypeDialog({
	open,
	onOpenChange,
	teams,
}: CreateCheckinTypeDialogProps) {
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [emoji, setEmoji] = useState("👋");
	const [description, setDescription] = useState("");
	const [teamId, setTeamId] = useState("");
	const [frequency, setFrequency] = useState<"daily" | "weekdays" | "weekly">(
		"weekdays",
	);
	const [scheduledTime, setScheduledTime] = useState("09:00");

	const createMutation = useMutation({
		...checkinsMutations.createType(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.checkins.listTypes.key(),
			});
			toast.success("Checkin type created");
			onOpenChange(false);
			resetForm();
		},
		onError: () => {
			toast.error("Failed to create checkin type");
		},
	});

	const resetForm = () => {
		setName("");
		setEmoji("👋");
		setDescription("");
		setTeamId("");
		setFrequency("weekdays");
		setScheduledTime("09:00");
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim() || !teamId) return;

		createMutation.mutate({
			name: name.trim(),
			emoji: emoji || undefined,
			description: description.trim() || undefined,
			teamId,
			frequency,
			scheduledTime,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>New Checkin</DialogTitle>
					<p className="text-sm text-muted-foreground">
						Create a new checkin routine
					</p>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="flex gap-2">
						<Input
							value={emoji}
							onChange={(e) => setEmoji(e.target.value)}
							className="w-14 text-center text-lg"
							maxLength={2}
						/>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g Daily Standup"
							className="flex-1"
						/>
					</div>

					<Textarea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Add a description (optional)"
						rows={2}
					/>

					<div className="space-y-2">
						<Label>Team</Label>
						<Select value={teamId} onValueChange={setTeamId}>
							<SelectTrigger>
								<SelectValue placeholder="Select a team" />
							</SelectTrigger>
							<SelectContent>
								{teams.map((team) => (
									<SelectItem key={team.id} value={team.id}>
										{team.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							Only team members will be able to post checkins
						</p>
					</div>

					<div className="space-y-2">
						<Label>Frequency</Label>
						<RadioGroup
							value={frequency}
							onValueChange={(v) =>
								setFrequency(v as typeof frequency)
							}
						>
							{FREQUENCY_OPTIONS.map((option) => (
								<div
									key={option.value}
									className="flex items-center space-x-2"
								>
									<RadioGroupItem
										value={option.value}
										id={option.value}
									/>
									<Label
										htmlFor={option.value}
										className="font-normal"
									>
										{option.label}
									</Label>
								</div>
							))}
						</RadioGroup>
					</div>

					<div className="space-y-2">
						<Label>Time</Label>
						<Select
							value={scheduledTime}
							onValueChange={setScheduledTime}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Array.from({ length: 24 }, (_, i) => {
									const hour = i.toString().padStart(2, "0");
									return (
										<SelectItem
											key={`${hour}:00`}
											value={`${hour}:00`}
										>
											{hour}:00
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>
					</div>

					<div className="flex justify-end gap-2 pt-4">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={
								!name.trim() ||
								!teamId ||
								createMutation.isPending
							}
						>
							Save
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export default function CheckinsPage() {
	const params = useParams<{ organizationSlug: string }>();
	const [showCreateDialog, setShowCreateDialog] = useState(false);

	const { data: checkinTypesData, isLoading } = useQuery(
		checkinsApi.listTypesOptions({}),
	);

	const { data: teamsData } = useQuery({
		queryKey: ["teams"],
		queryFn: async () => {
			const response = await fetch("/api/auth/list-teams", {
				method: "GET",
				headers: { "Content-Type": "application/json" },
			});
			if (!response.ok) throw new Error("Failed to fetch teams");
			return response.json();
		},
	});

	const checkinTypes = checkinTypesData?.data ?? [];
	const teams = teamsData ?? [];

	if (isLoading) {
		return (
			<div className="mx-auto w-full max-w-[600px] py-8">
				<div className="flex items-center justify-center gap-3 mb-8">
					<Skeleton className="size-8" />
					<Skeleton className="h-8 w-32" />
				</div>
				<div className="space-y-2">
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
			</div>
		);
	}

	return (
		<>
			<div className="mx-auto w-full max-w-[600px] py-8">
				<div className="flex items-center justify-center gap-3 mb-8">
					<Hand className="size-8 text-neutral-400" />
					<h1 className="text-2xl font-semibold">Checkins</h1>
				</div>

				{checkinTypes.length === 0 ? (
					<div className="text-center py-12">
						<Hand className="mx-auto size-12 text-neutral-300 mb-4" />
						<h3 className="font-medium text-neutral-900 mb-1">
							No checkins yet
						</h3>
						<p className="text-sm text-neutral-500 mb-4">
							Create your first checkin routine to get started
						</p>
						<Button onClick={() => setShowCreateDialog(true)}>
							<Plus className="size-4 mr-2" />
							New Checkin
						</Button>
					</div>
				) : (
					<>
						<div className="space-y-1">
							{checkinTypes.map((checkinType) => (
								<CheckinTypeCard
									key={checkinType.id}
									checkinType={checkinType}
									organizationSlug={params.organizationSlug}
								/>
							))}
						</div>

						<div className="mt-6 flex justify-center">
							<Button
								variant="outline"
								onClick={() => setShowCreateDialog(true)}
							>
								<Plus className="size-4 mr-2" />
								New Checkin
							</Button>
						</div>
					</>
				)}
			</div>

			<CreateCheckinTypeDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
				teams={teams}
			/>
		</>
	);
}
