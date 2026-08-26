export const BIRTH_DATE_SLOT_POSITIONS = [0, 1, 2, 3, 5, 6, 8, 9] as const;

export interface PartialDateParts {
	year: string;
	month: string;
	day: string;
}

type DatePartKey = keyof PartialDateParts;

const DATE_PART_LIMITS = {
	year: 4,
	month: 2,
	day: 2,
} satisfies Record<DatePartKey, number>;

const DATE_PART_PLACEHOLDERS = {
	year: "yyyy",
	month: "mm",
	day: "dd",
} satisfies Record<DatePartKey, string>;

function emptyPartialDateParts(): PartialDateParts {
	return { year: "", month: "", day: "" };
}

function digitsOnly(value: string, limit: number) {
	return value.replace(/\D/g, "").slice(0, limit);
}

function parseDatePart(value: string, part: DatePartKey) {
	const normalized = value.trim().toLowerCase();
	if (!normalized) return "";

	const limit = DATE_PART_LIMITS[part];
	const unknownMarker = "-".repeat(limit);
	const placeholder = DATE_PART_PLACEHOLDERS[part][0];
	const compact = normalized.replaceAll(placeholder, "");
	if (compact === unknownMarker) return unknownMarker;

	const digits = digitsOnly(compact, limit);
	if (digits) return digits;

	// Preserve partially typed unknown markers so the mask can finish -- or ----.
	if (/^-+$/.test(compact)) {
		return compact.slice(0, limit);
	}

	return "";
}

function splitDateInput(value: string) {
	if (value.includes("/")) return value.split("/");

	const hyphenated = value.match(/^([^-/]+)-([^-/]+)-([^-/]+)$/);
	if (hyphenated) return hyphenated.slice(1);

	return [value];
}

export function normalizePartialDateParts(
	parts: PartialDateParts,
): PartialDateParts {
	const year = parseDatePart(parts.year, "year");
	if (year === "----") return { year, month: "--", day: "--" };

	const month = parseDatePart(parts.month, "month");
	if (month === "--") return { year, month, day: "--" };
	if (!month) return { year, month: "", day: "" };

	return {
		year,
		month,
		day: parseDatePart(parts.day, "day"),
	};
}

export function getBirthDateDigits(value: string) {
	return value.replace(/\D/g, "").slice(0, 8);
}

export function parsePartialDateParts(value: string): PartialDateParts {
	const trimmed = value.trim();
	if (!trimmed) return emptyPartialDateParts();

	const segments = splitDateInput(trimmed);
	if (segments.length === 1 && /^\d{1,8}$/.test(trimmed)) {
		const digits = getBirthDateDigits(trimmed);
		return normalizePartialDateParts({
			year: digits.slice(0, 4),
			month: digits.slice(4, 6),
			day: digits.slice(6, 8),
		});
	}

	return normalizePartialDateParts({
		year: segments[0] ?? "",
		month: segments[1] ?? "",
		day: segments[2] ?? "",
	});
}

function formatDatePart(value: string, part: DatePartKey) {
	const normalized = value.trim();
	const limit = DATE_PART_LIMITS[part];
	const placeholder = DATE_PART_PLACEHOLDERS[part];
	const unknownMarker = "-".repeat(limit);

	if (normalized === unknownMarker) return unknownMarker;
	if (/^-+$/.test(normalized)) {
		return `${normalized.slice(0, limit)}${placeholder.slice(normalized.length)}`;
	}

	const digits = digitsOnly(normalized, limit);
	return digits ? `${digits}${placeholder.slice(digits.length)}` : placeholder;
}

export function formatPartialDateInput(parts: PartialDateParts) {
	const normalized = normalizePartialDateParts(parts);
	return [
		formatDatePart(normalized.year, "year"),
		formatDatePart(normalized.month, "month"),
		formatDatePart(normalized.day, "day"),
	].join("/");
}

function isValidDatePart(value: string, min: number, max: number) {
	if (!/^\d{2}$/.test(value)) return true;
	const number = Number(value);
	return number >= min && number <= max;
}

function isLeapYear(year: number) {
	return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number) {
	if (month === 2) return isLeapYear(year) ? 29 : 28;
	return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isPartialDateValid(parts: PartialDateParts) {
	const normalized = normalizePartialDateParts(parts);
	if (normalized.year === "----" || !/^\d{4}$/.test(normalized.year))
		return true;
	if (
		!normalized.month ||
		normalized.month === "--" ||
		normalized.month.length < 2
	)
		return true;
	if (!isValidDatePart(normalized.month, 1, 12)) return false;
	if (!normalized.day || normalized.day === "--" || normalized.day.length < 2)
		return true;
	if (!isValidDatePart(normalized.day, 1, 31)) return false;

	return (
		daysInMonth(Number(normalized.year), Number(normalized.month)) >=
		Number(normalized.day)
	);
}

export function serializePartialDate(parts?: PartialDateParts) {
	const normalized = normalizePartialDateParts(parts ?? emptyPartialDateParts());
	const year = normalized.year.trim();
	if (year === "----") return "----/--/--";
	if (!/^\d{4}$/.test(year) || !isPartialDateValid(normalized)) return "";

	const month = normalized.month.trim();
	if (!month || month === "--") return `${year}/--/--`;
	if (!/^\d{2}$/.test(month) || !isValidDatePart(month, 1, 12)) return "";

	const day = normalized.day.trim();
	if (!day || day === "--") return `${year}/${month}/--`;
	if (!/^\d{2}$/.test(day) || !isValidDatePart(day, 1, 31)) return "";

	return `${year}-${month}-${day}`;
}

export function formatBirthDateInput(value: string) {
	return formatPartialDateInput(parsePartialDateParts(value));
}

export function getBirthDateCursorIndex(digitCount: number) {
	const safeDigitCount = Math.max(0, Math.min(digitCount, 8));
	if (safeDigitCount >= 8) return 10;
	return BIRTH_DATE_SLOT_POSITIONS[safeDigitCount];
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
