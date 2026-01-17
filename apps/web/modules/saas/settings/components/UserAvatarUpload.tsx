"use client";

import { authClient } from "@repo/auth/client";
import { useSession } from "@saas/auth/hooks/use-session";
import { Spinner } from "@shared/components/Spinner";
import { UserAvatar } from "@shared/components/UserAvatar";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { CropImageDialog } from "./CropImageDialog";

export function UserAvatarUpload({
	onSuccess,
	onError,
}: {
	onSuccess: () => void;
	onError: () => void;
}) {
	const { user, reloadSession } = useSession();
	const [uploading, setUploading] = useState(false);
	const [cropDialogOpen, setCropDialogOpen] = useState(false);
	const [image, setImage] = useState<File | null>(null);

	const { getRootProps, getInputProps } = useDropzone({
		onDrop: (acceptedFiles) => {
			setImage(acceptedFiles[0]);
			setCropDialogOpen(true);
		},
		accept: {
			"image/png": [".png"],
			"image/jpeg": [".jpg", ".jpeg"],
		},
		multiple: false,
	});

	if (!user) {
		return null;
	}

	const onCrop = async (croppedImageData: Blob | null) => {
		if (!croppedImageData) {
			return;
		}

		setUploading(true);
		try {
			// Get presigned URL from unified API
			const presignedRes = await fetch("/api/uploads/presigned-url", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					fileName: "avatar.png",
					fileType: "image/png",
					fileSize: croppedImageData.size,
					context: "avatars",
				}),
			});

			if (!presignedRes.ok) {
				const error = await presignedRes.json();
				throw new Error(error.message || "Failed to get upload URL");
			}

			const { url, key } = await presignedRes.json();

			// Upload directly to R2
			const uploadRes = await fetch(url, {
				method: "PUT",
				body: croppedImageData,
				headers: {
					"Content-Type": "image/png",
				},
			});

			if (!uploadRes.ok) {
				throw new Error("Failed to upload image");
			}

			// Update user profile with storage key
			const { error } = await authClient.updateUser({
				image: key,
			});

			if (error) {
				throw error;
			}

			await reloadSession();
			onSuccess();
		} catch {
			onError();
		} finally {
			setUploading(false);
		}
	};

	return (
		<>
			<div className="relative size-24 rounded-full" {...getRootProps()}>
				<input {...getInputProps()} />
				<UserAvatar
					className="size-24 cursor-pointer text-xl"
					avatarUrl={user.image}
					name={user.name ?? ""}
				/>

				{uploading && (
					<div className="absolute inset-0 z-20 flex items-center justify-center bg-card/90">
						<Spinner className="size-6" />
					</div>
				)}
			</div>

			<CropImageDialog
				image={image}
				open={cropDialogOpen}
				onOpenChange={setCropDialogOpen}
				onCrop={onCrop}
			/>
		</>
	);
}
