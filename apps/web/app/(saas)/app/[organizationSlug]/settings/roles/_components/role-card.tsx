"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Edit2, Lock, Trash2 } from "lucide-react";

interface Role {
	id: string;
	name: string;
	description: string;
	isStatic: boolean;
	permissions: Record<string, string[]>;
	color?: string;
}

interface RoleCardProps {
	role: Role;
	canManage: boolean;
	onEdit?: () => void;
	onDelete?: () => void;
}

export function RoleCard({ role, canManage, onEdit, onDelete }: RoleCardProps) {
	return (
		<Card className="relative">
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-2">
					<div className="space-y-1">
						<CardTitle className="flex items-center gap-2 text-base">
							{role.isStatic && (
								<Lock className="h-3.5 w-3.5 text-muted-foreground" />
							)}
							{role.name}
						</CardTitle>
						<CardDescription className="text-xs">
							{role.description}
						</CardDescription>
					</div>
					{role.isStatic ? (
						<Badge variant="outline" className="shrink-0 text-xs">
							System
						</Badge>
					) : (
						canManage && (
							<div className="flex gap-1">
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7"
									onClick={onEdit}
								>
									<Edit2 className="h-3.5 w-3.5" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7 text-destructive hover:text-destructive"
									onClick={onDelete}
								>
									<Trash2 className="h-3.5 w-3.5" />
								</Button>
							</div>
						)
					)}
				</div>
			</CardHeader>
		</Card>
	);
}
