import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
// @ts-expect-error Vue SFC declarations are unavailable to the standalone TypeScript server.
import PMaskedDateInput from "@/components/ui/PMaskedDateInput.vue";
import { defineComponent, nextTick, ref } from "vue";

describe("PMaskedDateInput", () => {
	it("renders with initial yyyy/mm/dd placeholder digits when empty", () => {
		const wrapper = mount(PMaskedDateInput, {
			props: {
				modelValue: { year: "", month: "", day: "" },
				label: "出生日期",
			},
		});
		const input = wrapper.find('input[type="text"]')
			.element as HTMLInputElement;
		expect(input.value).toBe("yyyy/mm/dd");
	});

	it("formats initial model value correctly", () => {
		const wrapper = mount(PMaskedDateInput, {
			props: {
				modelValue: { year: "2026", month: "08", day: "03" },
				label: "出生日期",
			},
		});
		const input = wrapper.find('input[type="text"]')
			.element as HTMLInputElement;
		expect(input.value).toBe("2026/08/03");
	});

	it("accepts an unknown month and automatically marks the day unknown", async () => {
		const model = ref({ year: "", month: "", day: "" });
		const wrapper = mount(PMaskedDateInput, {
			props: {
				modelValue: model.value,
				"onUpdate:modelValue": (value: {
					year: string;
					month: string;
					day: string;
				}) => {
					model.value = value;
				},
			},
		});
		await wrapper.find('input[type="text"]').setValue("1990/--/20");
		expect(model.value).toEqual({ year: "1990", month: "--", day: "--" });
		expect(
			(wrapper.find('input[type="text"]').element as HTMLInputElement).value,
		).toBe("1990/--/--");
	});

	it("accepts a completely unknown required date", async () => {
		const model = ref({ year: "", month: "", day: "" });
		const wrapper = mount(PMaskedDateInput, {
			props: {
				modelValue: model.value,
				required: true,
				"onUpdate:modelValue": (value: {
					year: string;
					month: string;
					day: string;
				}) => {
					model.value = value;
				},
			},
		});
		await wrapper.find('input[type="text"]').setValue("----/--/--");
		expect(model.value).toEqual({ year: "----", month: "--", day: "--" });
		expect(
			(wrapper.find('input[type="text"]').element as HTMLInputElement).value,
		).toBe("----/--/--");
	});

	it("accepts a completely unknown date typed one dash at a time", async () => {
		const model = ref({ year: "", month: "", day: "" });
		const wrapper = mount(
			defineComponent({
				components: { PMaskedDateInput },
				setup() {
					return { model };
				},
				template: '<PMaskedDateInput v-model="model" required />',
			}),
		);
		const inputWrapper = wrapper.find('input[type="text"]');
		const input = inputWrapper.element as HTMLInputElement;

		await inputWrapper.trigger("focus");
		for (const dash of "----") {
			const start = input.selectionStart ?? 0;
			const end = input.selectionEnd ?? start;
			input.setRangeText(dash, start, end, "end");
			await inputWrapper.trigger("input");
			await nextTick();
		}

		expect(input.value).toBe("----/--/--");
		expect(model.value).toEqual({ year: "----", month: "--", day: "--" });
	});

	it("keeps year, month, and day digits in input order while typing", async () => {
		const model = ref({ year: "", month: "", day: "" });
		const wrapper = mount(
			defineComponent({
				components: { PMaskedDateInput },
				setup() {
					return { model };
				},
				template: '<PMaskedDateInput v-model="model" />',
			}),
		);
		const inputWrapper = wrapper.find('input[type="text"]');
		const input = inputWrapper.element as HTMLInputElement;

		await inputWrapper.trigger("focus");
		for (const digit of "20260807") {
			const start = input.selectionStart ?? 0;
			const end = input.selectionEnd ?? start;
			input.setRangeText(digit, start, end, "end");
			await inputWrapper.trigger("input");
			await nextTick();
		}

		expect(input.value).toBe("2026/08/07");
		expect(model.value).toEqual({
			year: "2026",
			month: "08",
			day: "07",
		});
	});

	it("allows sequential year entry to use the native input path", async () => {
		const wrapper = mount(PMaskedDateInput, {
			props: { modelValue: { year: "2", month: "", day: "" } },
		});
		const input = wrapper.find('input[type="text"]');
		const element = input.element as HTMLInputElement;
		element.setSelectionRange(1, 1);
		const event = new KeyboardEvent("keydown", {
			key: "0",
			bubbles: true,
			cancelable: true,
		});

		element.dispatchEvent(event);
		await nextTick();

		expect(event.defaultPrevented).toBe(false);
	});

	it("replaces the day at the current cursor without moving the caret to the year", async () => {
		const wrapper = mount(PMaskedDateInput, {
			props: {
				modelValue: { year: "2026", month: "08", day: "31" },
			},
		});
		const input = wrapper.find('input[type="text"]');
		const element = input.element as HTMLInputElement;
		element.setSelectionRange(8, 8);

		await input.trigger("keydown", { key: "1" });
		await input.trigger("keydown", { key: "5" });

		expect(element.value).toBe("2026/08/15");
		expect(element.selectionStart).toBe(10);
	});

	it("shows field help and explains that an empty end date means present", async () => {
		const wrapper = mount(PMaskedDateInput, {
			props: {
				modelValue: { year: "", month: "", day: "" },
				label: "退出时间",
				presentWhenEmpty: true,
				testId: "leave-date",
			},
		});
		await wrapper.get('[data-testid="leave-date-help-btn"]').trigger("click");
		expect(wrapper.text()).toContain("不填表示至今");
		expect(wrapper.text()).toContain("----/--/--");
	});
});
