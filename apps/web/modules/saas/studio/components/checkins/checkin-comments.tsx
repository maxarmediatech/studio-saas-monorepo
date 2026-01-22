"use client";

import type { EditorContentJson } from "@repo/editor";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
	ThreadCard,
	type ThreadRootMessage,
} from "@saas/studio/components/thread";
import { checkinsApi, checkinsMutations } from "@saas/studio/lib/api";
import { extractApiErrorMessage } from "@shared/lib/api-errors";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

interface CheckinCommentsProps {
	checkinId: string;
}

export function CheckinComments({ checkinId }: CheckinCommentsProps) {
	const queryClient = useQueryClient();

	const [expandedThreads, setExpandedThreads] = useState<
		Record<string, ThreadRootMessage[]>
	>({});

	const { data: commentsData, isLoading } = useQuery(
		checkinsApi.listCommentsOptions({ checkinId }),
	);

	const comments = commentsData?.data ?? [];

	const createCommentMutation = useMutation({
		...checkinsMutations.createComment(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.checkins.listComments.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.checkins.listCheckins.key(),
			});
		},
		onError: (error) => {
			toast.error(
				extractApiErrorMessage(error, "Failed to post comment"),
			);
		},
	});

	const handleReply = (parentId: string, contentJson: EditorContentJson) => {
		createCommentMutation.mutate({
			checkinId,
			contentJson,
			parentId,
		});
	};

	const handleViewMoreReplies = async (threadRootId: string) => {
		try {
			const result = await queryClient.fetchQuery(
				checkinsApi.listCommentsOptions({ checkinId, threadRootId }),
			);

			if (result?.data) {
				setExpandedThreads((prev) => ({
					...prev,
					[threadRootId]: result.data as ThreadRootMessage[],
				}));
			}
		} catch {
			toast.error("Failed to load more replies");
		}
	};

	const getMessageWithExpandedReplies = (
		comment: ThreadRootMessage,
	): ThreadRootMessage => {
		const expanded = expandedThreads[comment.id];
		if (expanded && expanded.length > 0) {
			return {
				...comment,
				replies: expanded.flatMap((c) => [c, ...(c.replies ?? [])]),
			};
		}
		return comment;
	};

	if (isLoading) {
		return (
			<div className="mt-4 space-y-3">
				<Skeleton className="h-20 w-full rounded-lg" />
			</div>
		);
	}

	if (comments.length === 0) {
		return null;
	}

	return (
		<div className="mt-4 space-y-4">
			{(comments as ThreadRootMessage[]).map((comment) => (
				<ThreadCard
					key={comment.id}
					message={getMessageWithExpandedReplies(comment)}
					onReplySubmit={handleReply}
					onViewMoreReplies={handleViewMoreReplies}
					isSubmitting={createCommentMutation.isPending}
				/>
			))}
		</div>
	);
}
