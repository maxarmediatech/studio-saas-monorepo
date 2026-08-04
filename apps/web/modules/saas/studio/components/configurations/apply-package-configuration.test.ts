import { describe, expect, it } from "vitest";
import {
	applyPackageConfiguration,
	configurationControlMode,
	packageMatchesBookingType,
	selectQuotationBootstrap,
} from "./apply-package-configuration";

describe("applyPackageConfiguration", () => {
	it("maps column defaults and optional deliverable details", () => {
		expect(
			applyPackageConfiguration({
				id: "id",
				key: "premium",
				label: "Premium",
				defaultCost: "120000.00",
				description: "Complete coverage",
				metadata: {
					defaultDeliverables: [
						{ title: "Film", quantity: 1, details: "4K" },
					],
				},
			}),
		).toMatchObject({
			cost: "120000.00",
			description: "Complete coverage",
			deliverables: [{ name: "Film", quantity: 1, details: "4K" }],
		});
	});

	it("uses standard deliverables for legacy packages without defaults", () => {
		expect(
			applyPackageConfiguration({
				id: "legacy-id",
				key: "legacy",
				label: "Legacy package",
				defaultCost: "90000.00",
				description: null,
				metadata: {},
			}).deliverables,
		).toEqual([
			{ name: "Wedding Album", quantity: 1, details: "" },
			{ name: "Full Wedding Video", quantity: 1, details: "" },
			{ name: "Wedding Highlight", quantity: 1, details: "" },
			{
				name: "Edited Photos of Each Event",
				quantity: 1,
				details: "",
			},
		]);
	});

	it("respects an explicit package with no deliverables", () => {
		expect(
			applyPackageConfiguration({
				id: "empty-id",
				key: "empty",
				label: "No deliverables",
				defaultCost: null,
				description: null,
				metadata: { defaultDeliverables: [] },
			}).deliverables,
		).toEqual([]);
	});

	it("distinguishes successful-empty configuration from failure", () => {
		expect(
			configurationControlMode({
				isPending: false,
				isError: false,
				optionCount: 0,
			}),
		).toBe("freeText");
		expect(
			configurationControlMode({
				isPending: false,
				isError: true,
				optionCount: 0,
			}),
		).toBe("error");
	});

	it("bootstraps only an explicit default and filters its package", () => {
		const packages = [
			{
				id: "wedding-package",
				key: "premium",
				label: "Premium",
				defaultCost: null,
				description: null,
				metadata: null,
				bookingTypeFilter: "wedding",
				isDefault: true,
			},
		];
		expect(
			selectQuotationBootstrap(
				[
					{
						id: "portrait",
						key: "portrait",
						label: "Portrait",
						isDefault: false,
					},
				],
				packages,
			),
		).toBeNull();
		const selected = selectQuotationBootstrap(
			[
				{
					id: "wedding",
					key: "wedding",
					label: "Wedding",
					isDefault: true,
				},
			],
			packages,
		);
		expect(selected?.packageType?.id).toBe("wedding-package");
		const firstPackage = packages[0];
		if (!firstPackage) {
			throw new Error("Missing package fixture");
		}
		expect(
			packageMatchesBookingType(firstPackage, {
				key: "portrait",
				label: "Portrait",
			}),
		).toBe(false);
	});
});
