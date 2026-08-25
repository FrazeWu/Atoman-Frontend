import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SongRatingControl from "@/components/music/SongRatingControl.vue";

describe("SongRatingControl.vue", () => {
  it("renders the five-star aggregate and emits the selected score", async () => {
    const wrapper = mount(SongRatingControl, {
      props: {
        songTitle: "示例歌曲",
        ratingScore: 3.5,
        ratingCount: 12,
      },
    });

    expect(wrapper.text()).toContain("3.5 · 12");
    const stars = wrapper.findAll(".song-rating__star");
    expect(stars).toHaveLength(5);

    await stars[3].trigger("click");
    expect(wrapper.emitted("rate")).toEqual([[4]]);
  });

  it("fills aggregate stars to the exact half-star width", () => {
    const wrapper = mount(SongRatingControl, {
      props: {
        songTitle: "示例歌曲",
        ratingScore: 3.5,
        ratingCount: 2,
      },
    });

    expect(wrapper.findAll(".song-rating__star-fill")[3].attributes("style")).toContain("width: 9px");
  });

  it("shows the current score and emits clear for an authenticated viewer", async () => {
    const wrapper = mount(SongRatingControl, {
      props: {
        songTitle: "示例歌曲",
        viewerRating: 4,
      },
    });

    expect(wrapper.find(".song-rating__clear").exists()).toBe(true);
    await wrapper.find(".song-rating__clear").trigger("click");
    expect(wrapper.emitted("clear")).toHaveLength(1);
  });
});
