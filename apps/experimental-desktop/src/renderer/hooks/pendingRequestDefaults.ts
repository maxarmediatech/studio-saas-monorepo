export function defaultAnswers(value: unknown) {
	const answers: Record<string, string[]> = {};
	if (!value || typeof value !== "object" || !("questions" in value)) {
		return answers;
	}
	const questions = (value as { questions?: unknown }).questions;
	if (!Array.isArray(questions)) {
		return answers;
	}
	for (const question of questions) {
		if (!question || typeof question !== "object") {
			continue;
		}
		const record = question as {
			id?: unknown;
			options?: unknown;
		};
		if (typeof record.id !== "string") {
			continue;
		}
		const firstOption = Array.isArray(record.options)
			? record.options.find(
					(option): option is { label: string } =>
						!!option &&
						typeof option === "object" &&
						"label" in option &&
						typeof option.label === "string",
				)
			: undefined;
		answers[record.id] = [firstOption?.label ?? "ok"];
	}
	return answers;
}
