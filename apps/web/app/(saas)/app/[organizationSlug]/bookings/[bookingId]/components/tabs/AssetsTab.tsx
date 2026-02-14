"use client";

import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { FileTextIcon, FolderIcon, PlusIcon } from "lucide-react";

interface AssetsTabProps {
	bookingId: string;
}

type AssetItem = {
	name: string;
	type: string;
	size: string;
	updatedAt: string;
};

// Placeholder assets - will be populated from API in future
const defaultAssets: AssetItem[] = [];

function AssetRow({ asset }: { asset: AssetItem }) {
	return (
		<div className="flex items-center justify-between rounded-lg border bg-muted/10 px-3 py-2">
			<div className="flex items-center gap-3">
				<div className="rounded-md border bg-background p-2">
					<FileTextIcon className="h-4 w-4 text-muted-foreground" />
				</div>
				<div>
					<p className="text-sm font-medium">{asset.name}</p>
					<p className="text-xs text-muted-foreground">
						{asset.type} - {asset.size}
					</p>
				</div>
			</div>
			<span className="text-xs text-muted-foreground">
				Updated {asset.updatedAt}
			</span>
		</div>
	);
}

function EmptyAssets() {
	return (
		<div className="flex flex-col items-center gap-3 py-12 text-center">
			<FolderIcon className="h-8 w-8 text-muted-foreground/30" />
			<div>
				<p className="text-sm font-medium text-muted-foreground">
					No assets uploaded
				</p>
				<p className="text-xs text-muted-foreground">
					Upload files to share references and deliverables
				</p>
			</div>
			<Button size="sm" variant="outline" className="mt-2">
				<PlusIcon className="h-4 w-4 mr-1.5" />
				Upload file
			</Button>
		</div>
	);
}

export function AssetsTab({ bookingId: _bookingId }: AssetsTabProps) {
	// In future, fetch assets from API based on bookingId
	const assets = defaultAssets;

	return (
		<div className="space-y-6">
			<Card className="rounded-lg">
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle className="text-base">Assets and files</CardTitle>
						<CardDescription>
							Shared references and deliverables.
						</CardDescription>
					</div>
					{assets.length > 0 && (
						<Button size="sm" variant="outline">
							<PlusIcon className="h-4 w-4 mr-1.5" />
							Upload
						</Button>
					)}
				</CardHeader>
				<CardContent>
					{assets.length === 0 ? (
						<EmptyAssets />
					) : (
						<div className="space-y-3">
							{assets.map((asset) => (
								<AssetRow key={asset.name} asset={asset} />
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
