import type {
	PackageOption,
	QuotationDraft,
	QuotationEvent,
} from "./quotation-wizard-data";
import { createDraftId } from "./quotation-wizard-data";

type PatchDraft = <K extends keyof QuotationDraft>(
	key: K,
	value: QuotationDraft[K],
) => void;

export function useQuotationWizardCollections(
	draft: QuotationDraft,
	patchDraft: PatchDraft,
) {
	const updateEvent = (id: string, patch: Partial<QuotationEvent>) => {
		const nextEvents = draft.events.map((event) =>
			event.id === id ? { ...event, ...patch } : event,
		);
		patchDraft("events", nextEvents);
		if (patch.name !== undefined || patch.side !== undefined) {
			const changed = nextEvents.find((event) => event.id === id);
			patchDraft(
				"packages",
				draft.packages.map((pkg) => ({
					...pkg,
					coverage: pkg.coverage.map((item) =>
						item.eventId === id && changed
							? {
									...item,
									eventName: changed.name,
									side: changed.side,
								}
							: item,
					),
				})),
			);
		}
	};

	const addEvent = () => {
		const event: QuotationEvent = {
			id: createDraftId("event"),
			eventTypeId: null,
			eventTypeKey: null,
			date: "",
			side: "common",
			name: "",
			location: "",
			guestCount: "",
			tentative: true,
			notes: "",
		};
		patchDraft("events", [...draft.events, event]);
		patchDraft(
			"packages",
			draft.packages.map((pkg) => ({
				...pkg,
				coverage: [
					...pkg.coverage,
					{
						id: createDraftId("coverage"),
						eventId: event.id,
						eventName: event.name,
						side: event.side,
						roles: "",
					},
				],
			})),
		);
	};

	const removeEvent = (id: string) => {
		patchDraft(
			"events",
			draft.events.filter((event) => event.id !== id),
		);
		patchDraft(
			"packages",
			draft.packages.map((pkg) => ({
				...pkg,
				coverage: pkg.coverage.filter((item) => item.eventId !== id),
			})),
		);
	};

	const updatePackage = (id: string, patch: Partial<PackageOption>) => {
		patchDraft(
			"packages",
			draft.packages.map((pkg) =>
				pkg.id === id ? { ...pkg, ...patch } : pkg,
			),
		);
	};

	const addPackage = (pkg: PackageOption) => {
		patchDraft("packages", [...draft.packages, pkg]);
		patchDraft("selectedPackageId", pkg.id);
	};

	const removePackage = (id: string) => {
		const nextPackages = draft.packages.filter((pkg) => pkg.id !== id);
		patchDraft("packages", nextPackages);
		if (draft.selectedPackageId === id) {
			patchDraft("selectedPackageId", nextPackages[0]?.id ?? "");
		}
	};

	const duplicatePackage = (pkg: PackageOption) => {
		const newId = createDraftId("package");
		patchDraft("packages", [
			...draft.packages,
			{
				...pkg,
				id: newId,
				name: `${pkg.name || "Package"} revision`,
				coverage: pkg.coverage.map((coverage) => ({
					...coverage,
					id: createDraftId("coverage"),
				})),
				deliverables: pkg.deliverables.map((deliverable) => ({
					...deliverable,
					id: createDraftId("deliverable"),
				})),
			},
		]);
		patchDraft("selectedPackageId", newId);
	};

	return {
		addEvent,
		addPackage,
		duplicatePackage,
		removeEvent,
		removePackage,
		updateEvent,
		updatePackage,
	};
}
