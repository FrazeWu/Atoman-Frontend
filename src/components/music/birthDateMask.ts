export const BIRTH_DATE_SLOT_POSITIONS = [0, 1, 2, 3, 5, 6, 8, 9] as const;

export interface PartialDateParts {
	year: string;
	month: string;
	day: string;
}

export function getBirthDateDigits(value: string) {
	return value.replace(/\D/g, "").slice(0, 8);
}

export function formatBirthDateInput(value: string) {
	const digits = getBirthDateDigits(value);
	const year = digits.slice(0, 4) || "yyyy";
	const month = digits.slice(4, 6) || "mm";
	const day = digits.slice(6, 8) || "dd";
	return `${year}/${month}/${day}`;
}

export function getBirthDateCursorIndex(digitCount: number) {
	const safeDigitCount = Math.max(0, Math.min(digitCount, 8));
	if (safeDigitCount >= 8) return 10;
	return BIRTH_DATE_SLOT_POSITIONS[safeDigitCount];
}

export function parsePartialDateParts(value: string): PartialDateParts {
	const trimmed = value.trim();
	if (!trimmed) return { year: "", month: "", day: "" };
	const unknownYearMatch = trimmed.match(
		/^(-{1,4})y*(?:\/(?:mm|--)?(?:\/(?:dd|--)?)?)?$/,
	);
	if (unknownYearMatch) {
		const year = unknownYearMatch[1];
		return year === "----"
			? { year, month: "--", day: "--" }
			: { year, month: "", day: "" };
	}

	if (/^\d{1,8}$/.test(trimmed)) {
		return {
			year: trimmed.slice(0, 4),
			month: trimmed.slice(4, 6),
			day: trimmed.slice(6, 8),
		};
	}

	const separator = trimmed.includes("/") ? "/" : "-";
	const [rawYear = "", rawMonth = "", rawDay = ""] = trimmed.split(separator);
	const year = rawYear.replace(/\D/g, "").slice(0, 4);
	const month =
		rawMonth === ""
			? ""
			: rawMonth.includes("-")
				? "--"
				: rawMonth.replace(/\D/g, "").slice(0, 2);
	const day =
		month === "--"
			? "--"
			: rawDay === ""
				? ""
				: rawDay.includes("-")
					? "--"
					: rawDay.replace(/\D/g, "").slice(0, 2);
	return { year, month, day };
}

export function formatPartialDateInput(parts: PartialDateParts) {
	if (!parts.year && !parts.month && !parts.day) return "yyyy/mm/dd";
	const year = parts.year === "----" ? "----" : `${parts.year}${"yyyy".slice(parts.year.length)}`;
	const month = parts.month === "--" ? "--" : `${parts.month}${"mm".slice(parts.month.length)}`;
	const day = parts.day === "--" ? "--" : `${parts.day}${"dd".slice(parts.day.length)}`;
	return `${year}/${month}/${day}`;
}

export function serializePartialDate(parts?: PartialDateParts) {
	const year = parts?.year.trim() ?? "";
	if (year === "----") return "----/--/--";
	if (year.length !== 4) return "";

	const month = parts?.month.trim() || "--";
	const day = month === "--" ? "--" : parts?.day.trim() || "--";
	if (month === "--") return `${year}/--/--`;
	if (day === "--") return `${year}/${month.padStart(2, "0")}/--`;
	return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function formatStoredPartialDate(value?: string, precision?: string) {
	if (precision === "unknown") return "----/--/--";
	if (!value) return "";
	const date = value.split("T")[0];
	const [year = "", month = "", day = ""] = date.split("-");
	if (precision === "year") return `${year}/--/--`;
	if (precision === "month") return `${year}/${month}/--`;
	return year && month && day ? `${year}-${month}-${day}` : value;
}
