"use client";

import { Button } from "@repo/ui/components/button";
import { orpc } from "@shared/lib/orpc-query-utils";
import { yourWorkMutations } from "@saas/studio/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface SubscribeButtonProps {
	entityType: "task" | "deliverable" | "shoot";
	entityId: string;
	isSubscribed: boolean;
}

export function SubscribeButton({
	entityType,
	entityId,
	isSubscribed,
}: SubscribeButtonProps) {
	const queryClient = useQueryClient();

	const subscribeMutation = useMutation({
		...yourWorkMutations.subscribe(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.yourWork.key() });
			queryClient.invalidateQueries({ queryKey: orpc.notifications.key() });
			toast.success("Subscribed to updates");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to subscribe");
		},
	});

	const unsubscribeMutation = useMutation({
		...yourWorkMutations.unsubscribe(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.yourWork.key() });
			queryClient.invalidateQueries({ queryKey: orpc.notifications.key() });
			toast.success("Unsubscribed from updates");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to unsubscribe");
		},
	});

	const isLoading = subscribeMutation.isPending || unsubscribeMutation.isPending;

	const handleClick = () => {
		if (isSubscribed) {
			unsubscribeMutation.mutate({ entityType, entityId });
			return;
		}
		subscribeMutation.mutate({ entityType, entityId });
	};

	return (
		<Button
			variant={isSubscribed ? "secondary" : "outline"}
			size="sm"
			onClick={handleClick}
			disabled={isLoading}
		>
			{isSubscribed ? "Watching" : "Watch"}
		</Button>
	);
}
