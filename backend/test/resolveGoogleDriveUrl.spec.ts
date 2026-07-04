import { describe, it, expect } from "vitest";
import { resolveGoogleDriveUrl } from "../src/index";

describe("resolveGoogleDriveUrl", () => {
	it("resolves view/share link format with query params", () => {
		const input = "https://drive.google.com/file/d/1rrBjV0fnebfaNHqD97x6hAenvs30u9jx/view?usp=drive_link";
		const expected = "https://drive.google.com/uc?export=view&id=1rrBjV0fnebfaNHqD97x6hAenvs30u9jx";
		expect(resolveGoogleDriveUrl(input)).toBe(expected);
	});

	it("resolves view/share link format without query params", () => {
		const input = "https://drive.google.com/file/d/1rrBjV0fnebfaNHqD97x6hAenvs30u9jx/view";
		const expected = "https://drive.google.com/uc?export=view&id=1rrBjV0fnebfaNHqD97x6hAenvs30u9jx";
		expect(resolveGoogleDriveUrl(input)).toBe(expected);
	});

	it("resolves open link format", () => {
		const input = "https://drive.google.com/open?id=1rrBjV0fnebfaNHqD97x6hAenvs30u9jx";
		const expected = "https://drive.google.com/uc?export=view&id=1rrBjV0fnebfaNHqD97x6hAenvs30u9jx";
		expect(resolveGoogleDriveUrl(input)).toBe(expected);
	});

	it("resolves docs.google.com file link format", () => {
		const input = "https://docs.google.com/file/d/1rrBjV0fnebfaNHqD97x6hAenvs30u9jx/edit";
		const expected = "https://drive.google.com/uc?export=view&id=1rrBjV0fnebfaNHqD97x6hAenvs30u9jx";
		expect(resolveGoogleDriveUrl(input)).toBe(expected);
	});

	it("resolves uc?id format", () => {
		const input = "https://drive.google.com/uc?id=1rrBjV0fnebfaNHqD97x6hAenvs30u9jx";
		const expected = "https://drive.google.com/uc?export=view&id=1rrBjV0fnebfaNHqD97x6hAenvs30u9jx";
		expect(resolveGoogleDriveUrl(input)).toBe(expected);
	});

	it("resolves uc?export=download&id format", () => {
		const input = "https://drive.google.com/uc?export=download&id=1rrBjV0fnebfaNHqD97x6hAenvs30u9jx";
		const expected = "https://drive.google.com/uc?export=view&id=1rrBjV0fnebfaNHqD97x6hAenvs30u9jx";
		expect(resolveGoogleDriveUrl(input)).toBe(expected);
	});

	it("returns original URL for non-Google Drive links", () => {
		const input = "https://example.com/images/apple.png";
		expect(resolveGoogleDriveUrl(input)).toBe(input);
	});

	it("returns undefined for undefined input", () => {
		expect(resolveGoogleDriveUrl(undefined)).toBeUndefined();
	});
});
