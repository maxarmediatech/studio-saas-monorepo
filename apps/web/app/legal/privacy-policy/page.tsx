import type { Metadata } from "next";
import { LegalPage } from "@/modules/legal/components/LegalPage";
import { privacyPolicySections } from "@/modules/legal/content";

export const metadata: Metadata = {
	title: "Privacy Policy",
};

export default function PrivacyPolicyPage() {
	return (
		<LegalPage
			title="Privacy Policy"
			description="How Stuwiz collects, uses, protects, and shares information for the Stuwiz platform."
			effectiveDate="01/03/2026"
			updatedDate="19/04/2026"
			sections={privacyPolicySections}
		/>
	);
}
