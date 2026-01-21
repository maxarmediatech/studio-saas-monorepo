"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";

import { discussionsApi, discussionsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Hash, Lock } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

function UserAvatar({
	name,
	className,
}: {
	name?: string | null;
	className?: string;
}) {
	const initial = name?.charAt(0)?.toUpperCase() ?? "?";
	return (
		<div
			className={cn(
				"flex shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-medium text-neutral-600",
				className,
			)}
		>
			{initial}
		</div>
	);
}

export default function NewDiscussionPage() {
	const params = useParams<{
		organizationSlug: string;
		channelSlug: string;
	}>();
	const router = useRouter();
	const queryClient = useQueryClient();

	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");

	const { data: channelData, isLoading: channelLoading } = useQuery(
		discussionsApi.getChannelBySlugOptions(params.channelSlug),
	);

	const channel = channelData?.data;

	const createDiscussionMutation = useMutation({
		...discussionsMutations.createDiscussion(),
		onSuccess: (data) => {
			queryClient.invalidateQueries({
				queryKey: orpc.discussions.listDiscussions.key(),
			});
			toast.success("Discussion created");
			router.push(
				`/app/${params.organizationSlug}/discussions/${params.channelSlug}/${data.data.id}`,
			);
		},
		onError: () => {
			toast.error("Failed to create discussion");
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim() || !channel?.id) return;

		createDiscussionMutation.mutate({
			channelId: channel.id,
			title: title.trim(),
			content: content.trim() || undefined,
		});
	};

	const backHref = `/app/${params.organizationSlug}/discussions/${params.channelSlug}`;

	if (channelLoading) {
		return (
			<div className="mx-auto w-full max-w-[800px]">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="mt-8 h-12 w-full" />
				<Skeleton className="mt-4 h-32 w-full" />
			</div>
		);
	}

	if (!channel) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-neutral-500">Channel not found</div>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-[800px]">
			<div className="flex items-center gap-3 pb-6 pt-2">
				<Link
					href={backHref}
					className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
				>
					<ArrowLeft className="size-5" />
				</Link>
				<div className="flex items-center gap-2">
					{channel.emoji ? (
						<span className="text-xl">{channel.emoji}</span>
					) : channel.visibility === "private" ? (
						<Lock className="size-5 text-neutral-400" />
					) : (
						<Hash className="size-5 text-neutral-400" />
					)}
					<h1 className="text-lg font-semibold text-neutral-900">
						New discussion in {channel.name}
					</h1>
				</div>
			</div>

			<form onSubmit={handleSubmit}>
				<div className="flex items-start gap-4">
					<UserAvatar name="You" className="mt-1 size-10" />
					<div className="min-w-0 flex-1 space-y-4">
						<Input
							placeholder="Discussion title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							className="h-12 border-0 bg-transparent px-0 text-lg font-medium shadow-none placeholder:text-neutral-400 focus-visible:ring-0"
							autoFocus
						/>
						<Textarea
							placeholder="Add more details (optional)"
							value={content}
							onChange={(e) => setContent(e.target.value)}
							rows={6}
							className="resize-none border-neutral-200"
						/>
						<div className="flex items-center justify-end gap-3 pt-2">
							<Button
								type="button"
								variant="ghost"
								onClick={() => router.back()}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={
									!title.trim() ||
									createDiscussionMutation.isPending
								}
							>
								{createDiscussionMutation.isPending
									? "Posting..."
									: "Post Discussion"}
							</Button>
						</div>
					</div>
				</div>
			</form>
		</div>
	);
}
