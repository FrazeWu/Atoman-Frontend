export type RecommendationLanguage =
	| "all"
	| "en"
	| "zh"
	| "ja"
	| "ko"
	| "de"
	| "es"
	| "fr"
	| "it"
	| "pt"
	| "nl"
	| "ru"
	| "ar"
	| "he"
	| "hi";

export const ALL_RECOMMENDATION_LANGUAGE = "all" as const;

export const recommendationLanguageOptions: Array<{
	label: string;
	value: RecommendationLanguage;
}> = [
	{ label: "全部语言", value: ALL_RECOMMENDATION_LANGUAGE },
	{ label: "English", value: "en" },
	{ label: "中文", value: "zh" },
	{ label: "日本語", value: "ja" },
	{ label: "한국어", value: "ko" },
	{ label: "Deutsch", value: "de" },
	{ label: "Español", value: "es" },
	{ label: "Français", value: "fr" },
	{ label: "Italiano", value: "it" },
	{ label: "Português", value: "pt" },
	{ label: "Nederlands", value: "nl" },
	{ label: "Русский", value: "ru" },
	{ label: "العربية", value: "ar" },
	{ label: "עברית", value: "he" },
	{ label: "हिन्दी", value: "hi" },
];

const supportedLanguages = new Set<RecommendationLanguage>(
	recommendationLanguageOptions.map((option) => option.value),
);

export function normalizeRecommendationLanguage(
	raw: unknown,
): RecommendationLanguage | null {
	if (typeof raw !== "string") return null;
	const value = raw.trim().toLowerCase().replaceAll("_", "-");
	if (!value) return null;
	const base = value.split("-")[0] as RecommendationLanguage;
	return supportedLanguages.has(base) ? base : null;
}

export function detectDefaultRecommendationLanguage(
	locales?: readonly string[],
): Exclude<RecommendationLanguage, "all"> {
	let candidates: readonly string[] = []
	if (locales && locales.length > 0) {
		candidates = locales
	} else if (typeof navigator !== "undefined") {
		if (navigator.languages && navigator.languages.length > 0) {
			candidates = navigator.languages
		} else {
			candidates = [navigator.language]
		}
	}

	for (const locale of candidates) {
		const language = normalizeRecommendationLanguage(locale);
		if (language && language !== ALL_RECOMMENDATION_LANGUAGE) return language;
	}
	return "en";
}
