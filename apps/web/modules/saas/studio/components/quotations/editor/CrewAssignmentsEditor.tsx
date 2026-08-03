import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Field, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { XIcon } from "lucide-react";
import type { CrewOption } from "./types";

type Assignment = {
	crewId: string;
	role?: string;
	isLead?: boolean;
	rate?: string;
};

export function CrewAssignmentsEditor({
	crews,
	assignments,
	showRate = false,
	showRole = false,
	onChange,
}: {
	crews: CrewOption[];
	assignments: Assignment[];
	showRate?: boolean;
	showRole?: boolean;
	onChange: (assignments: Assignment[]) => void;
}) {
	const selectedIds = new Set(assignments.map((item) => item.crewId));
	return (
		<div className="flex flex-col gap-2">
			<Select
				onValueChange={(crewId) =>
					onChange([
						...assignments,
						{
							crewId,
							...(showRate ? { rate: "" } : {}),
							...(showRole ? { role: "" } : {}),
						},
					])
				}
			>
				<SelectTrigger aria-label="Assign crew" size="sm">
					<SelectValue placeholder="Assign crew" />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectLabel>Available crew</SelectLabel>
						{crews
							.filter((crew) => !selectedIds.has(crew.id))
							.map((crew) => (
								<SelectItem key={crew.id} value={crew.id}>
									{crew.name}
								</SelectItem>
							))}
					</SelectGroup>
				</SelectContent>
			</Select>
			{assignments.map((assignment, index) => (
				<div
					key={assignment.crewId}
					className="flex items-center gap-2"
				>
					<span className="min-w-28 truncate text-sm font-medium">
						{crews.find((crew) => crew.id === assignment.crewId)
							?.name ?? "Crew"}
					</span>
					{showRole && (
						<Input
							aria-label="Crew assignment role"
							className="max-w-40"
							value={assignment.role ?? ""}
							placeholder="Role"
							onChange={(event) =>
								onChange(
									assignments.map((item, itemIndex) =>
										itemIndex === index
											? {
													...item,
													role:
														event.target.value ||
														undefined,
												}
											: item,
									),
								)
							}
						/>
					)}
					{showRate && (
						<Input
							aria-label="Crew shoot rate"
							className="max-w-40"
							type="number"
							min="0"
							step="0.01"
							value={assignment.rate ?? ""}
							placeholder="Shoot rate"
							onChange={(event) =>
								onChange(
									assignments.map((item, itemIndex) =>
										itemIndex === index
											? {
													...item,
													rate: event.target.value,
												}
											: item,
									),
								)
							}
						/>
					)}
					<Field orientation="horizontal" className="shrink-0">
						<Checkbox
							id={`crew-assignment-lead-${assignment.crewId}`}
							checked={assignment.isLead ?? false}
							onCheckedChange={(checked) =>
								onChange(
									assignments.map((item, itemIndex) =>
										itemIndex === index
											? {
													...item,
													isLead: checked === true,
												}
											: item,
									),
								)
							}
						/>
						<FieldLabel
							htmlFor={`crew-assignment-lead-${assignment.crewId}`}
						>
							Lead
						</FieldLabel>
					</Field>
					<Button
						type="button"
						size="icon"
						variant="ghost"
						onClick={() =>
							onChange(
								assignments.filter(
									(_, itemIndex) => itemIndex !== index,
								),
							)
						}
						aria-label="Remove crew assignment"
					>
						<XIcon />
					</Button>
				</div>
			))}
		</div>
	);
}
