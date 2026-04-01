import { expect, test } from "@playwright/test";
import {
	getUploadAccept,
	getUploadDropzoneAccept,
	getUploadHelperText,
	getUploadTooLargeMessage,
	validateUploadFile,
} from "../modules/shared/lib/upload-policy";

test.describe("upload policy", () => {
	test("formats contract helper text from shared policy", () => {
		expect(getUploadHelperText("contracts")).toBe(
			"PDF, JPG, PNG, WEBP up to 10 MB.",
		);
	});

	test("builds accept string for submission uploads", () => {
		expect(getUploadAccept("submissions")).toBe(
			".pdf,.jpg,.jpeg,.png,.mp4,.zip",
		);
	});

	test("builds dropzone config for avatar uploads", () => {
		expect(getUploadDropzoneAccept("avatars")).toEqual({
			"image/png": [".png"],
			"image/jpeg": [".jpg", ".jpeg"],
		});
	});

	test("rejects DOCX for contract uploads", () => {
		expect(
			validateUploadFile(
				{
					name: "contract.docx",
					type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
					size: 1024,
				},
				"contracts",
			),
		).toBe("Unsupported file type. Allowed: PDF, JPG, PNG, WEBP.");
	});

	test("rejects oversized receipt uploads", () => {
		expect(
			validateUploadFile(
				{
					name: "receipt.pdf",
					type: "application/pdf",
					size: 6 * 1024 * 1024,
				},
				"receipts",
			),
		).toBe(getUploadTooLargeMessage("receipts"));
	});
});
