import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import type { RespondSessionRequestInput } from "../../../preload/types";
import { iconProps } from "../../app/icons";
import type { PendingRequest } from "../../app/types";
import { Button } from "../ui/button";

export function PendingRequestDock(props: {
	requests: PendingRequest[];
	drafts: Record<string, Record<string, string>>;
	onDraftChange: (
		requestId: string,
		questionId: string,
		value: string,
	) => void;
	onRespond: (
		requestId: string,
		response: RespondSessionRequestInput,
	) => Promise<void>;
}) {
	if (props.requests.length === 0) {
		return null;
	}
	return (
		<div className="mb-2 flex flex-col gap-2 rounded-[14px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox)_90%,transparent)] p-2.5 shadow-[0_14px_40px_-32px_var(--desktop-shadow)] backdrop-blur-xl">
			{props.requests.map((request) => {
				const questions = parseUserInputQuestions(request.data.raw);
				if (
					request.data.requestKind === "user-input" &&
					questions.length > 0
				) {
					return (
						<div
							className="grid gap-2"
							key={request.data.requestId}
						>
							<p className="m-0 text-[12px] font-semibold text-[var(--desktop-strong)]">
								Codex needs input
							</p>
							{questions.map((question) => (
								<label className="grid gap-1" key={question.id}>
									<span className="text-[12px] text-[var(--desktop-subtle)]">
										{question.question}
									</span>
									<input
										className="h-8 rounded-[8px] border border-[var(--desktop-inbox-border)] bg-transparent px-2.5 text-[13px] outline-none"
										value={
											props.drafts[
												request.data.requestId
											]?.[question.id] ??
											question.options[0] ??
											""
										}
										onChange={(event) =>
											props.onDraftChange(
												request.data.requestId,
												question.id,
												event.currentTarget.value,
											)
										}
									/>
								</label>
							))}
							<RequestActions
								acceptLabel="Submit"
								onAccept={() =>
									props.onRespond(request.data.requestId, {
										answers: Object.fromEntries(
											questions.map((question) => [
												question.id,
												props.drafts[
													request.data.requestId
												]?.[question.id] ??
													question.options[0] ??
													"ok",
											]),
										),
									})
								}
								onDecline={() =>
									props.onRespond(request.data.requestId, {
										decision: "cancel",
									})
								}
							/>
						</div>
					);
				}
				return (
					<div
						className="flex items-center justify-between gap-3"
						key={request.data.requestId}
					>
						<div className="min-w-0">
							<p className="m-0 truncate text-[12px] font-semibold text-[var(--desktop-strong)]">
								{request.data.requestKind} approval
							</p>
							<p className="m-0 truncate text-[12px] text-[var(--desktop-subtle)]">
								{request.data.requestId}
							</p>
						</div>
						<RequestActions
							acceptLabel="Accept"
							onAccept={() =>
								props.onRespond(request.data.requestId, {
									decision: "accept",
								})
							}
							onDecline={() =>
								props.onRespond(request.data.requestId, {
									decision: "decline",
								})
							}
						/>
					</div>
				);
			})}
		</div>
	);
}

function RequestActions(props: {
	acceptLabel: string;
	onAccept: () => void;
	onDecline: () => void;
}) {
	return (
		<div className="flex shrink-0 gap-1.5">
			<Button size="xs" type="button" onClick={props.onAccept}>
				<IconCircleCheck data-icon="inline-start" {...iconProps} />
				{props.acceptLabel}
			</Button>
			<Button
				size="xs"
				variant="outline"
				type="button"
				onClick={props.onDecline}
			>
				<IconCircleX data-icon="inline-start" {...iconProps} />
				Decline
			</Button>
		</div>
	);
}

function parseUserInputQuestions(value: unknown) {
	if (!value || typeof value !== "object" || !("questions" in value)) {
		return [];
	}
	const questions = (value as { questions?: unknown }).questions;
	if (!Array.isArray(questions)) {
		return [];
	}
	return questions.flatMap((question) => {
		if (!question || typeof question !== "object") {
			return [];
		}
		const record = question as {
			id?: unknown;
			question?: unknown;
			options?: unknown;
		};
		if (typeof record.id !== "string") {
			return [];
		}
		return [
			{
				id: record.id,
				question:
					typeof record.question === "string"
						? record.question
						: "Answer",
				options: Array.isArray(record.options)
					? record.options.flatMap((option) => {
							if (!option || typeof option !== "object") {
								return [];
							}
							const label = (option as { label?: unknown }).label;
							return typeof label === "string" ? [label] : [];
						})
					: [],
			},
		];
	});
}
