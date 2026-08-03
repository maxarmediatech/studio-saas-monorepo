import { Button } from "@repo/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@repo/ui/components/empty";
import { FieldError } from "@repo/ui/components/field";
import { PlusIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";

export function OperationSection({
	title,
	description,
	onAdd,
	isEmpty,
	children,
	id,
	error,
}: {
	title: string;
	description: string;
	onAdd: () => void;
	isEmpty: boolean;
	children: ReactNode;
	id?: string;
	error?: string;
}) {
	return (
		<section
			id={id}
			tabIndex={-1}
			aria-invalid={Boolean(error)}
			className="flex flex-col gap-3"
		>
			<div className="flex items-center justify-between gap-4">
				<div>
					<h3 className="font-medium">{title}</h3>
					<p className="text-sm text-muted-foreground">
						{description}
					</p>
				</div>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={onAdd}
				>
					<PlusIcon data-icon="inline-start" /> Add
				</Button>
			</div>
			{isEmpty ? (
				<Empty className="border py-6">
					<EmptyHeader>
						<EmptyTitle>
							No {title.toLowerCase()} planned
						</EmptyTitle>
						<EmptyDescription>{description}</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				children
			)}
			<FieldError>{error}</FieldError>
		</section>
	);
}

export function OperationCard({
	onRemove,
	children,
}: {
	onRemove: () => void;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-3 rounded-lg border p-4">
			<div className="flex justify-end">
				<Button
					type="button"
					size="icon"
					variant="ghost"
					onClick={onRemove}
					aria-label="Remove"
				>
					<Trash2Icon />
				</Button>
			</div>
			{children}
		</div>
	);
}
