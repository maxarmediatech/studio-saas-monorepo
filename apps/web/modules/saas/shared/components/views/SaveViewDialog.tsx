"use client";

import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { cn } from "@repo/ui/lib/utils";
import {
	AlertCircleIcon,
	BookmarkIcon,
	CalendarIcon,
	CheckIcon,
	CheckSquareIcon,
	FilterIcon,
	ListIcon,
	StarIcon,
	TagIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

export interface SaveViewFormData {
	name: string;
	description?: string;
	icon?: string;
	color?: string;
	isPublic: boolean;
}

export interface SaveViewDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (data: SaveViewFormData) => void;
	initialData?: Partial<SaveViewFormData>;
	isLoading?: boolean;
}

const COLORS = [
	{ name: "gray", value: "#6b7280" },
	{ name: "red", value: "#ef4444" },
	{ name: "orange", value: "#f97316" },
	{ name: "yellow", value: "#eab308" },
	{ name: "green", value: "#22c55e" },
	{ name: "blue", value: "#3b82f6" },
	{ name: "purple", value: "#a855f7" },
	{ name: "pink", value: "#ec4899" },
];

const ICONS = [
	{ name: "List", icon: ListIcon },
	{ name: "Calendar", icon: CalendarIcon },
	{ name: "CheckSquare", icon: CheckSquareIcon },
	{ name: "AlertCircle", icon: AlertCircleIcon },
	{ name: "Star", icon: StarIcon },
	{ name: "Bookmark", icon: BookmarkIcon },
	{ name: "Filter", icon: FilterIcon },
	{ name: "Tag", icon: TagIcon },
];

export function SaveViewDialog({
	open,
	onOpenChange,
	onSave,
	initialData,
	isLoading,
}: SaveViewDialogProps) {
	const [name, setName] = useState(initialData?.name || "");
	const [description, setDescription] = useState(
		initialData?.description || "",
	);
	const [icon, setIcon] = useState(initialData?.icon || "List");
	const [color, setColor] = useState(initialData?.color || "gray");
	const [isPublic, setIsPublic] = useState(initialData?.isPublic || false);

	useEffect(() => {
		if (open) {
			setName(initialData?.name || "");
			setDescription(initialData?.description || "");
			setIcon(initialData?.icon || "List");
			setColor(initialData?.color || "gray");
			setIsPublic(initialData?.isPublic || false);
		}
	}, [open, initialData]);

	const handleSave = () => {
		onSave({
			name,
			description: description || undefined,
			icon,
			color,
			isPublic,
		});
		onOpenChange(false);
	};

	const selectedColor = COLORS.find((c) => c.name === color);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>
						{initialData?.name ? "Edit View" : "Save View"}
					</DialogTitle>
					<DialogDescription>
						Save your current filter configuration as a named view.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<div className="flex gap-2">
							<Select
								value={icon}
								onValueChange={setIcon}
								disabled={isLoading}
							>
								<SelectTrigger className="w-18 shrink-0">
									<SelectValue placeholder="Icon" />
								</SelectTrigger>
								<SelectContent className="min-w-0">
									{ICONS.map((item) => (
										<SelectItem
											key={item.name}
											value={item.name}
										>
											<item.icon className="size-4" />
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Input
								id="name"
								placeholder="My view"
								value={name}
								onChange={(e) => setName(e.target.value)}
								disabled={isLoading}
								className="flex-1"
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Input
							id="description"
							placeholder="Optional description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							disabled={isLoading}
						/>
					</div>

					<div className="space-y-2">
						<Label>Color</Label>
						<div className="flex flex-wrap gap-2">
							{COLORS.map((c) => (
								<button
									key={c.name}
									type="button"
									onClick={() => setColor(c.name)}
									disabled={isLoading}
									className={cn(
										"flex size-6 items-center justify-center rounded-full transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
										color === c.name &&
											"ring-2 ring-ring ring-offset-2",
									)}
									style={{ backgroundColor: c.value }}
									aria-label={`Select ${c.name} color`}
								>
									{color === c.name && (
										<CheckIcon className="size-3 text-white" />
									)}
								</button>
							))}
						</div>
					</div>

					<div className="flex items-center space-x-2 pt-2">
						<Checkbox
							id="public"
							checked={isPublic}
							onCheckedChange={(checked) =>
								setIsPublic(checked as boolean)
							}
							disabled={isLoading}
						/>
						<Label
							htmlFor="public"
							className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>
							Share with team
						</Label>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isLoading}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSave}
						disabled={!name.trim() || isLoading}
					>
						{isLoading ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
