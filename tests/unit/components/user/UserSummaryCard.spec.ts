import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import UserSummaryCard from "@/components/user/UserSummaryCard.vue";

const user = {
  username: "author",
  display_name: "Author",
  avatar_url: "",
  quality: 72.35,
  contribution_total: 1280,
};

describe("UserSummaryCard.vue", () => {
  it("shows exact metrics for a profile summary", () => {
    const wrapper = mount(UserSummaryCard, {
      props: { user, exactContribution: true },
      global: { stubs: { PAvatar: true } },
    });

    expect(wrapper.text()).toContain("信誉分72.4");
    expect(wrapper.text()).toContain("贡献分1,280");
  });

  it("uses compact contribution buckets for embedded summaries", () => {
    const wrapper = mount(UserSummaryCard, {
      props: { user },
      global: { stubs: { PAvatar: true } },
    });

    expect(wrapper.text()).toContain("信誉分72.4");
    expect(wrapper.text()).toContain("贡献分1k+");
  });

  it("renders a profile link when requested", () => {
    const wrapper = mount(UserSummaryCard, {
      props: { user, link: true },
      global: { stubs: { PAvatar: true, RouterLink: true } },
    });

    expect(wrapper.findComponent({ name: "RouterLink" }).exists()).toBe(true);
  });
});
