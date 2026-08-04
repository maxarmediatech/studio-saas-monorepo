import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
	getUploadAccept,
	getUploadHelperText,
	getUploadResponseErrorMessage,
	validateUploadFile,
} from "@shared/lib/upload-policy";
import {
	FileTextIcon,
	Loader2Icon,
	PaperclipIcon,
	Trash2Icon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { BookingDraft } from "./types";

const accept = getUploadAccept("contracts");
const helperText = getUploadHelperText("contracts");
type Attachment = NonNullable<BookingDraft["contractAttachment"]>;

export function ContractAttachmentField({
	value,
	onChange,
	onUploaded,
}: {
	value: BookingDraft["contractAttachment"];
	onChange: (attachment: Attachment | null) => void;
	onUploaded: (key: string) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);

	const upload = async (file: File) => {
		const validationError = validateUploadFile(file, "contracts");
		if (validationError) {
			toast.error(validationError);
			return;
		}
		setUploading(true);
		try {
			const presigned = await fetch("/api/uploads/presigned-url", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					fileName: file.name,
					fileType: file.type,
					fileSize: file.size,
					context: "contracts",
				}),
			});
			if (!presigned.ok) {
				throw new Error(
					await getUploadResponseErrorMessage(
						presigned,
						"Failed to prepare document upload",
					),
				);
			}
			const { url, key } = (await presigned.json()) as {
				url: string;
				key: string;
			};
			const uploaded = await fetch(url, {
				method: "PUT",
				body: file,
				headers: { "Content-Type": file.type },
			});
			if (!uploaded.ok) {
				throw new Error("Document upload failed");
			}
			onChange({
				name: file.name,
				size: file.size,
				type: file.type,
				key,
				url: url.split("?")[0] ?? url,
			});
			onUploaded(key);
			toast.success("Contract document attached");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Upload failed",
			);
		} finally {
			setUploading(false);
			if (inputRef.current) {
				inputRef.current.value = "";
			}
		}
	};

	return (
		<Field>
			<FieldLabel htmlFor="quotation-contract-document">
				Contract document
			</FieldLabel>
			<Input
				id="quotation-contract-document"
				ref={inputRef}
				type="file"
				accept={accept}
				className="sr-only"
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) {
						void upload(file);
					}
				}}
			/>
			{value ? (
				<div className="flex items-center justify-between gap-3 rounded-md border p-3">
					<div className="flex min-w-0 items-center gap-3">
						<FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
						<span className="truncate text-sm">{value.name}</span>
					</div>
					<div className="flex items-center gap-1">
						<Button
							type="button"
							size="sm"
							variant="ghost"
							disabled={uploading}
							onClick={() => inputRef.current?.click()}
						>
							Replace
						</Button>
						<Button
							type="button"
							size="icon"
							variant="ghost"
							onClick={() => onChange(null)}
							aria-label="Remove contract document after saving"
						>
							<Trash2Icon />
						</Button>
					</div>
				</div>
			) : (
				<Button
					type="button"
					variant="outline"
					className="w-fit"
					disabled={uploading}
					onClick={() => inputRef.current?.click()}
				>
					{uploading ? (
						<Loader2Icon
							className="animate-spin"
							data-icon="inline-start"
						/>
					) : (
						<PaperclipIcon data-icon="inline-start" />
					)}
					Attach document
				</Button>
			)}
			<FieldDescription>
				{helperText} Replacement or removal takes effect only after this
				draft saves.
			</FieldDescription>
		</Field>
	);
}
