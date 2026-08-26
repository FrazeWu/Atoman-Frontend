import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SongRatingControl from "@/components/music/SongRatingControl.vue";

describe("SongRatingControl.vue", () => {
  it("renders the public score separately and emits the selected personal score", async () => {
    const wrapper = mount(SongRatingControl, {
      props: {
        songTitle: "示例歌曲",
        ratingScore: 3.5,
        ratingCount: 12,
      },
    });

    expect(wrapper.text()).toContain("评分3.5（12 人）");
    const stars = wrapper.findAll(".song-rating__star");
    expect(stars).toHaveLength(5);
    expect(wrapper.findAll(".song-rating__star-fill")[0].attributes("style")).toContain("width: 0px");

    await stars[3].trigger("click");
    expect(wrapper.emitted("rate")).toEqual([[4]]);
  });

  it("hides the public score until six ratings are available", () => {
    const wrapper = mount(SongRatingControl, {
      props: {
        songTitle: "示例歌曲",
        ratingScore: 5,
        ratingCount: 1,
        viewerRating: 5,
      },
    });

    expect(wrapper.text()).toContain("依据不足（1 人）");
    expect(wrapper.find(".song-rating__score").exists()).toBe(false);
    expect(wrapper.findAll(".song-rating__star-fill")[4].attributes("style")).toContain("width: 18px");
  });

  it("fills only the viewer's personal rating", () => {
    const wrapper = mount(SongRatingControl, {
      props: {
        songTitle: "示例歌曲",
        ratingScore: 3.5,
        ratingCount: 2,
        viewerRating: 4,
      },
    });

    expect(
      wrapper.findAll(".song-rating__star-fill")[3].attributes("style"),
    ).toContain("width: 18px");
  });

  it("does not render a clear control", () => {
    const wrapper = mount(SongRatingControl, {
      props: {
        songTitle: "示例歌曲",
        viewerRating: 4,
      },
    });

    expect(wrapper.find(".song-rating__clear").exists()).toBe(false);
  });
});
