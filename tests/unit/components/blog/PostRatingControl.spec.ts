import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import PostRatingControl from "@/components/blog/PostRatingControl.vue";

describe("PostRatingControl.vue", () => {
  it("renders rating summary and the unified help trigger", () => {
    const wrapper = mount(PostRatingControl, {
      props: {
        ratingScore: 7.8,
        ratingCount: 15,
      },
    });

    expect(wrapper.text()).toContain("3.9 / 5");
    expect(wrapper.text()).toContain("(15)");
    expect(
      wrapper.find(".p-help-tooltip__trigger").attributes("aria-label"),
    ).toBe("查看评分参考标准");
    expect(wrapper.find(".p-help-tooltip__popover").exists()).toBe(false);
  });

  it("shows hover score dynamically when hovering on half stars", async () => {
    const wrapper = mount(PostRatingControl, {
      props: {
        ratingScore: 6.0,
        ratingCount: 5,
      },
    });

    // Find the 4th star right half (8 points)
    const rightHalves = wrapper.findAll(".post-rating__half--right");
    expect(rightHalves.length).toBe(5);

    await rightHalves[3].trigger("mouseenter");
    expect(wrapper.find(".post-rating__dynamic-score").text()).toBe("4.0 星");

    await wrapper.find(".post-rating__control").trigger("mouseleave");
    expect(wrapper.find(".post-rating__dynamic-score").exists()).toBe(false);
  });

  it("emits a one-point rating from the half-star range control", async () => {
    const wrapper = mount(PostRatingControl);
    const slider = wrapper.get<HTMLInputElement>(".post-rating__slider input");

    await slider.setValue("1");

    expect(wrapper.emitted("rate")).toEqual([[1]]);
    expect(wrapper.get(".post-rating__slider output").text()).toBe("0.5 星");
  });

  it("emits rate event when clicking on a star half", async () => {
    const wrapper = mount(PostRatingControl, {
      props: {
        ratingScore: 0,
        ratingCount: 0,
      },
    });

    const leftHalves = wrapper.findAll(".post-rating__half--left");
    // Click 3rd star left half -> 5 points
    await leftHalves[2].trigger("click");

    expect(wrapper.emitted("rate")).toBeTruthy();
    expect(wrapper.emitted("rate")![0]).toEqual([5]);
  });

  it("emits clear event when clicking clear button", async () => {
    const wrapper = mount(PostRatingControl, {
      props: {
        ratingScore: 8.0,
        ratingCount: 1,
        viewerRating: 8,
      },
    });

    expect(wrapper.text()).toContain("我的评分 4.0 星");
    const clearBtn = wrapper.find(".post-rating__clear");
    expect(clearBtn.exists()).toBe(true);

    await clearBtn.trigger("click");
    expect(wrapper.emitted("clear")).toBeTruthy();
  });

  it("announces a failed rating next to the control", () => {
    const wrapper = mount(PostRatingControl, {
      props: { errorMessage: "评分未保存，请重试" },
    });

    expect(wrapper.get(".post-rating__error").attributes("role")).toBe("alert");
    expect(wrapper.text()).toContain("评分未保存，请重试");
  });

  it("shows rating guidelines with a three-star pass baseline", async () => {
    const wrapper = mount(PostRatingControl);
    await wrapper.get(".p-help-tooltip__trigger").trigger("click");

    const popover = wrapper.get(".p-help-tooltip__popover");
    expect(popover.text()).toContain("3 星为合格");
    expect(popover.text()).toContain("力荐");
    expect(popover.text()).toContain("推荐");
    expect(popover.text()).toContain("及格 / 还行");
    expect(popover.text()).toContain("一般");
    expect(popover.text()).toContain("较差");
  });
});
