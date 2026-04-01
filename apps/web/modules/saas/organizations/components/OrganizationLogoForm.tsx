"use client";

import { authClient } from "@repo/auth/client";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { organizationListQueryKey } from "@saas/organizations/lib/api";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { Spinner } from "@shared/components/Spinner";
import {
	getUploadDropzoneAccept,
	getUploadHelperText,
	getUploadPolicy,
	getUploadResponseErrorMessage,
	getUploadTooLargeMessage,
	validateUploadFile,
} from "@shared/lib/upload-policy";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { CropImageDialog } from "../../settings/components/CropImageDialog";
import { OrganizationLogo } from "./OrganizationLogo";

const ORG_LOGO_UPLOAD_HELPER_TEXT = getUploadHelperText("org-logos");

export function OrganizationLogoForm() {
	const t = useTranslations();
	const [uploading, setUploading] = useState(false);
	const [cropDialogOpen, setCropDialogOpen] = useState(false);
	const [image, setImage] = useState<File | null>(null);
	const { activeOrganization, refetchActiveOrganization } =
		useActiveOrganization();
	const queryClient = useQueryClient();

	const { getRootProps, getInputProps } = useDropzone({
		onDrop: (acceptedFiles) => {
			setImage(acceptedFiles[0]);
			setCropDialogOpen(true);
		},
		onDropRejected: (rejections) => {
			const firstError = rejections[0]?.errors[0]?.code;
			if (firstError === "file-too-large") {
				toast.error(getUploadTooLargeMessage("org-logos"));
				return;
			}
			toast.error(ORG_LOGO_UPLOAD_HELPER_TEXT);
		},
		accept: getUploadDropzoneAccept("org-logos"),
		maxSize: getUploadPolicy("org-logos").maxFileSize,
		multiple: false,
	});

	if (!activeOrganization) {
		return null;
	}

	const onCrop = async (croppedImageData: Blob | null) => {
		if (!croppedImageData) {
			return;
		}

		const validationError = validateUploadFile(
			{
				name: "logo.png",
				type: "image/png",
				size: croppedImageData.size,
			},
			"org-logos",
		);
		if (validationError) {
			toast.error(validationError);
			return;
		}

		setUploading(true);
		try {
			// Get presigned URL from unified API
			const presignedRes = await fetch("/api/uploads/presigned-url", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					fileName: "logo.png",
					fileType: "image/png",
					fileSize: croppedImageData.size,
					context: "org-logos",
				}),
			});

			if (!presignedRes.ok) {
				throw new Error(
					await getUploadResponseErrorMessage(
						presignedRes,
						"Failed to get upload URL",
					),
				);
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

			// Update organization with storage key
			const { error } = await authClient.organization.update({
				organizationId: activeOrganization.id,
				data: {
					logo: key,
				},
			});

			if (error) {
				throw error;
			}

			toast.success(t("settings.account.avatar.notifications.success"));
			refetchActiveOrganization();
			queryClient.invalidateQueries({
				queryKey: organizationListQueryKey,
			});
		} catch {
			toast.error(t("settings.account.avatar.notifications.error"));
		} finally {
			setUploading(false);
		}
	};

	return (
		<SettingsItem
			title={t("organizations.settings.logo.title")}
			description={t("organizations.settings.logo.description")}
		>
			<div className="flex flex-col items-center gap-2">
				<div
					className="relative size-24 rounded-full"
					{...getRootProps()}
				>
					<input {...getInputProps()} />
					<OrganizationLogo
						className="size-24 cursor-pointer text-xl"
						logoUrl={activeOrganization.logo}
						name={activeOrganization.name ?? ""}
					/>

					{uploading && (
						<div className="absolute inset-0 z-20 flex items-center justify-center bg-card/90">
							<Spinner />
						</div>
					)}
				</div>
				<p className="text-center text-xs text-muted-foreground">
					{ORG_LOGO_UPLOAD_HELPER_TEXT}
				</p>
			</div>

			<CropImageDialog
				image={image}
				open={cropDialogOpen}
				onOpenChange={setCropDialogOpen}
				onCrop={onCrop}
			/>
		</SettingsItem>
	);
}
