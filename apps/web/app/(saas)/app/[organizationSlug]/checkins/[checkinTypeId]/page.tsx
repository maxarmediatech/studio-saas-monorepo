"use client";

import type { EditorContentJson } from "@repo/editor";
import { LiteRichTextEditor, ReadOnlyRenderer } from "@repo/editor";
import { Button } from "@repo/ui/components/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
} from "@repo/ui/components/input-group";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useSession } from "@saas/auth/hooks/use-session";
import { checkinsApi, checkinsMutations } from "@saas/studio/lib/api";
import { UserAvatar } from "@shared/components/UserAvatar";
import { extractApiErrorMessage } from "@shared/lib/api-errors";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { Clock, Hand, Send, Settings } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const EMPTY_DOC: EditorContentJson = {
	type: "doc",
	content: [{ type: "paragraph" }],
};

function isEditorContentJson(value: unknown): value is EditorContentJson {
	if (typeof value !== "object" || value === null) return false;
	const record = value as Record<string, unknown>;
	return record.type === "doc";
}

function groupCheckinsByDate<T extends { checkinDate: Date | string }>(
	checkins: T[],
): { label: string; date: Date; items: T[] }[] {
	const groups: Record<string, { date: Date; items: T[] }> = {};

	for (const checkin of checkins) {
		const date = parsePlainDate(checkin.checkinDate);
		let label: string;

		if (isToday(date)) {
			label = "Today";
		} else if (isYesterday(date)) {
			label = "Yesterday";
		} else {
			label = format(date, "EEEE, MMMM d, yyyy");
		}

		if (!groups[label]) {
			groups[label] = { date, items: [] };
		}
		groups[label].items.push(checkin);
	}

	return Object.entries(groups)
		.map(([label, data]) => ({ label, ...data }))
		.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function parsePlainDate(value: Date | string): Date {
	if (value instanceof Date) return value;
	if (typeof value !== "string") return new Date(value);

	// Treat YYYY-MM-DD as a plain calendar date in the user's local timezone.
	const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
	if (!match) return new Date(value);

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	return new Date(year, month - 1, day);
}

interface Comment {
	id: string;
	content: string | null;
	contentText: string | null;
	contentJson: unknown;
	createdAt: Date | string;
	author?: {
		id: string;
		name: string | null;
		image: string | null;
	} | null;
}

interface CheckinPostProps {
	checkin: {
		id: string;
		content: string | null;
		contentText: string | null;
		contentJson: unknown;
		commentCount: number;
		createdAt: Date | string;
		author?: {
			id: string;
			name: string | null;
			image: string | null;
		} | null;
	};
}

function CheckinPost({ checkin }: CheckinPostProps) {
	const { user } = useSession();
	const queryClient = useQueryClient();
	const [replyDoc, setReplyDoc] = useState<EditorContentJson>(EMPTY_DOC);
	const [replyText, setReplyText] = useState("");
	const [showReplyInput, setShowReplyInput] = useState(false);

	const { data: commentsData } = useQuery({
		...checkinsApi.listCommentsOptions({ checkinId: checkin.id }),
		enabled: checkin.commentCount > 0,
	});

	const comments = (commentsData?.data ?? []) as Comment[];

	const createCommentMutation = useMutation({
		...checkinsMutations.createComment(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.checkins.listComments.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.checkins.listCheckins.key(),
			});
			setReplyDoc(EMPTY_DOC);
			setReplyText("");
			setShowReplyInput(false);
		},
		onError: (error) => {
			toast.error(extractApiErrorMessage(error, "Failed to post reply"));
		},
	});

	const handleSubmitReply = () => {
		if (!replyText.trim()) return;
		createCommentMutation.mutate({
			checkinId: checkin.id,
			contentJson: replyDoc,
		});
	};

	return (
		<div className="rounded-lg border bg-card">
			<div className="p-4">
				<div className="flex items-start gap-3">
					<UserAvatar
						name={checkin.author?.name ?? "Unknown"}
						avatarUrl={checkin.author?.image}
						className="size-8"
					/>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2">
							<span className="font-medium text-sm">
								{checkin.author?.name ?? "Unknown"}
							</span>
							<span className="text-xs text-muted-foreground">
								{formatDistanceToNow(
									new Date(checkin.createdAt),
									{ addSuffix: true },
								)}
							</span>
						</div>
						{isEditorContentJson(checkin.contentJson) ? (
							<ReadOnlyRenderer
								content={checkin.contentJson}
								className="mt-1 text-sm"
							/>
						) : (
							<p className="mt-1 text-sm">
								{checkin.contentText ?? checkin.content}
							</p>
						)}
					</div>
				</div>
			</div>

			{comments.map((comment) => (
				<div key={comment.id} className="border-t p-4">
					<div className="flex items-start gap-3">
						<UserAvatar
							name={comment.author?.name ?? "Unknown"}
							avatarUrl={comment.author?.image}
							className="size-8"
						/>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2">
								<span className="font-medium text-sm">
									{comment.author?.name ?? "Unknown"}
								</span>
								<span className="text-xs text-muted-foreground">
									{formatDistanceToNow(
										new Date(comment.createdAt),
										{ addSuffix: true },
									)}
								</span>
							</div>
							{isEditorContentJson(comment.contentJson) ? (
								<ReadOnlyRenderer
									content={comment.contentJson}
									className="mt-1 text-sm"
								/>
							) : (
								<p className="mt-1 text-sm">
									{comment.contentText ?? comment.content}
								</p>
							)}
						</div>
					</div>
				</div>
			))}

			<div className="border-t p-3">
				{showReplyInput ? (
					<InputGroup className="bg-background">
						<LiteRichTextEditor
							value={replyDoc}
							onChange={(payload) => {
								setReplyDoc(payload.json);
								setReplyText(payload.text);
							}}
							onSubmit={handleSubmitReply}
							placeholder="Write a reply..."
							className="min-h-[60px] w-full resize-none bg-transparent px-3 py-2 text-sm outline-none"
							editable={!createCommentMutation.isPending}
						/>
						<InputGroupAddon align="block-end">
							<InputGroupButton
								className="ml-auto"
								size="sm"
								variant="default"
								onClick={handleSubmitReply}
								disabled={
									!replyText.trim() ||
									createCommentMutation.isPending
								}
							>
								<Send className="size-3" />
								Reply
							</InputGroupButton>
						</InputGroupAddon>
					</InputGroup>
				) : (
					<button
						type="button"
						onClick={() => setShowReplyInput(true)}
						className="w-full flex items-center gap-2 py-2 px-1 -mx-1 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
					>
						<UserAvatar
							name={user?.name ?? "You"}
							avatarUrl={user?.image}
							className="size-6"
						/>
						<span>Reply...</span>
					</button>
				)}
			</div>
		</div>
	);
}

export default function CheckinTypeDetailPage() {
	const params = useParams<{
		organizationSlug: string;
		checkinTypeId: string;
	}>();
	const { user } = useSession();
	const queryClient = useQueryClient();

	const [newCheckinDoc, setNewCheckinDoc] =
		useState<EditorContentJson>(EMPTY_DOC);
	const [newCheckinText, setNewCheckinText] = useState("");

	const { data: checkinTypeData, isLoading: typeLoading } = useQuery(
		checkinsApi.getTypeOptions(params.checkinTypeId),
	);

	const { data: checkinsData, isLoading: checkinsLoading } = useQuery({
		...checkinsApi.listCheckinsOptions({
			checkinTypeId: params.checkinTypeId,
			limit: 50,
		}),
		enabled: !!params.checkinTypeId,
	});

	const checkinType = checkinTypeData?.data;
	const checkins = checkinsData?.data ?? [];
	const groupedCheckins = useMemo(
		() => groupCheckinsByDate(checkins),
		[checkins],
	);

	const createCheckinMutation = useMutation({
		...checkinsMutations.createCheckin(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.checkins.listCheckins.key(),
			});
			setNewCheckinDoc(EMPTY_DOC);
			setNewCheckinText("");
			toast.success("Checkin posted");
		},
		onError: (error) => {
			toast.error(
				extractApiErrorMessage(error, "Failed to post checkin"),
			);
		},
	});

	const handleSubmitCheckin = () => {
		if (!newCheckinText.trim()) return;

		createCheckinMutation.mutate({
			checkinTypeId: params.checkinTypeId,
			contentJson: newCheckinDoc,
		});
	};

	const awaitingCount = 0;

	if (typeLoading) {
		return (
			<div className="mx-auto w-full max-w-[700px] py-6">
				<Skeleton className="h-10 w-64 mb-4" />
				<Skeleton className="h-24 w-full mb-8" />
				<Skeleton className="h-32 w-full" />
			</div>
		);
	}

	if (!checkinType) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-muted-foreground">
					Checkin type not found
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-[700px] py-6">
			<div className="flex items-start justify-between mb-6">
				<div>
					<h1 className="text-2xl font-semibold flex items-center gap-2">
						<span>{checkinType.emoji ?? "👋"}</span>
						{checkinType.name}
					</h1>
					<div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
						<span className="flex items-center gap-1">
							<Clock className="size-3" />
							{checkinType.scheduledTime ?? "No time set"}
						</span>
						<span>•</span>
						<span>
							{checkinType.scope === "organization"
								? "Organization"
								: (checkinType.team?.name ?? "Team")}
						</span>
					</div>
				</div>
				<Button variant="outline" size="sm">
					<Settings className="size-4 mr-1" />
					Reminders only
				</Button>
			</div>

			<div className="rounded-xl border bg-card p-4 mb-8">
				<div className="flex items-start gap-3 mb-3">
					<UserAvatar
						name={user?.name ?? "You"}
						avatarUrl={user?.image}
						className="size-10"
					/>
					<div className="flex-1">
						<div className="font-medium text-sm">
							{user?.name ?? "You"}
						</div>
						<div className="text-xs text-muted-foreground">
							Write your checkin
						</div>
					</div>
				</div>

				<InputGroup className="bg-background">
					<LiteRichTextEditor
						value={newCheckinDoc}
						onChange={(payload) => {
							setNewCheckinDoc(payload.json);
							setNewCheckinText(payload.text);
						}}
						onSubmit={handleSubmitCheckin}
						placeholder="What are you working on?"
						editable={!createCheckinMutation.isPending}
						className="min-h-[80px] w-full resize-none bg-transparent px-3 py-3 text-sm outline-none"
					/>
					<InputGroupAddon align="block-end">
						<InputGroupButton
							className="ml-auto"
							size="sm"
							variant="default"
							onClick={handleSubmitCheckin}
							disabled={
								!newCheckinText.trim() ||
								createCheckinMutation.isPending
							}
						>
							<Send className="size-4" />
							Post
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			</div>

			{checkinsLoading ? (
				<div className="space-y-4">
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
			) : checkins.length === 0 ? (
				<div className="text-center py-12">
					<Hand className="mx-auto size-10 text-neutral-300 mb-3" />
					<p className="text-sm text-muted-foreground">
						No checkins yet. Be the first to post!
					</p>
				</div>
			) : (
				<div className="space-y-8">
					{groupedCheckins.map((group) => (
						<div key={group.label}>
							<div className="flex items-center justify-between mb-4">
								<h3 className="font-medium text-sm">
									{group.label}
								</h3>
								{awaitingCount > 0 &&
									group.label === "Today" && (
										<span className="text-sm text-muted-foreground">
											{awaitingCount} awaiting
										</span>
									)}
							</div>
							<div className="space-y-4">
								{group.items.map((checkin) => (
									<CheckinPost
										key={checkin.id}
										checkin={checkin}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
