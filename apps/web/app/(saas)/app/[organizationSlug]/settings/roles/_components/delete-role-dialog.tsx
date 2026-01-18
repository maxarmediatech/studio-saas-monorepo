"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Loader2 } from "lucide-react";

interface DeleteRoleDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	roleName: string;
	onConfirm: () => void;
	isDeleting: boolean;
}

export function DeleteRoleDialog({
	open,
	onOpenChange,
	roleName,
	onConfirm,
	isDeleting,
}: DeleteRoleDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Role</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to delete the role "
						<strong>{roleName}</strong>"? This action cannot be
						undone. Make sure no members are assigned to this role
						before deleting.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isDeleting}>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						disabled={isDeleting}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{isDeleting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Deleting...
							</>
						) : (
							"Delete Role"
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
