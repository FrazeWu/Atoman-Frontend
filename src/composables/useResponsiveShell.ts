import type { Component } from "vue";
import { IconBookmark as Bookmark, IconBook2 as BookOpen, IconCompass as Compass, IconDots as Ellipsis, IconFolder as Folder, IconHeart as Heart, IconPlaylist as ListMusic, IconMessage as MessageSquare, IconRadio as Radio, IconRss as Rss, IconSearch as Search, IconUser as UserRound } from '@tabler/icons-vue';
import { modulePathUrl, moduleUrl } from "@/router/siteUrls";
import type { ModuleRoomKey } from "@/config/moduleRooms";

export type MobilePrimaryTabKey = string;

export type MobilePrimaryTab = {
	key: MobilePrimaryTabKey;
	label: string;
	module: ModuleRoomKey;
	href: string;
	icon: Component;
};

export type MobileMoreItem = {
	module: ModuleRoomKey;
	label: string;
	href: string;
	icon: Component;
};

const tabs = (
	module: ModuleRoomKey,
	entries: Array<[string, string, string, Component]>,
): MobilePrimaryTab[] =>
	entries.map(([key, label, path, icon]) => ({
		key,
		label,
		module,
		href: path === "/" ? moduleUrl(module) : modulePathUrl(module, path),
		icon,
	}));

const MOBILE_PRIMARY_TABS: Record<ModuleRoomKey, MobilePrimaryTab[]> = {
	feed: tabs("feed", [
		["discover", "发现", "/", Compass],
		["subscriptions", "订阅", "/subscriptions", Rss],
		["reading-list", "稍后阅读", "/reading-list", Bookmark],
		["starred", "收藏", "/starred", Heart],
	]),
	blog: tabs("blog", [
		["discover", "发现", "/", Compass],
		["notes", "短笺", "/notes", MessageSquare],
		["subscriptions", "订阅", "/subscriptions", Rss],
		["bookmarks", "收藏", "/bookmarks", Bookmark],
	]),
	books: tabs("books", [
		["discover", "发现", "/", Compass],
		["search", "搜索", "/search", Search],
		["library", "书库", "/library", BookOpen],
		["contributions", "贡献", "/contributions", UserRound],
	]),
	music: tabs("music", [
		["discover", "发现", "/discover", Compass],
		["search", "搜索", "/songs", Search],
		["library", "歌单", "/playlists", ListMusic],
		["me", "我的", "/me", UserRound],
		["more", "更多", "/more", Ellipsis],
	]),
	forum: tabs("forum", [
		["topics", "话题", "/", MessageSquare],
		["categories", "分类", "/categories", Folder],
		["search", "搜索", "/search", Search],
		["me", "我的", "/me", UserRound],
	]),
	debate: tabs("debate", [
		["topics", "辩题", "/", MessageSquare],
		["search", "搜索", "/search", Search],
		["me", "我的", "/me", UserRound],
	]),
	timeline: tabs("timeline", [
		["timeline", "时间轴", "/", Radio],
		["persons", "人物", "/persons", UserRound],
		["search", "搜索", "/search", Search],
		["me", "我的", "/me", UserRound],
	]),
	podcast: tabs("podcast", [
		["discover", "发现", "/", Compass],
		["playlists", "播放列表", "/favorites", ListMusic],
		["subscriptions", "订阅", "/subscriptions", Rss],
		["me", "我的", "/me", UserRound],
	]),
	video: tabs("video", [
		["discover", "发现", "/", Compass],
		["search", "搜索", "/search", Search],
		["subscriptions", "订阅", "/subscriptions", Rss],
		["favorites", "收藏", "/favorites", Bookmark],
	]),
};

const MORE_ITEMS: MobileMoreItem[] = [
	{ module: "feed", label: "订阅", href: moduleUrl("feed"), icon: Rss },
	{ module: "blog", label: "博客", href: moduleUrl("blog"), icon: Compass },
	{ module: "books", label: "读书", href: moduleUrl("books"), icon: BookOpen },
	{ module: "music", label: "音乐", href: moduleUrl("music"), icon: Radio },
	{
		module: "forum",
		label: "论坛",
		href: moduleUrl("forum"),
		icon: MessageSquare,
	},
	{
		module: "debate",
		label: "辩题",
		href: moduleUrl("debate"),
		icon: MessageSquare,
	},
	{
		module: "timeline",
		label: "时间线",
		href: moduleUrl("timeline"),
		icon: Radio,
	},
	{
		module: "podcast",
		label: "播客",
		href: moduleUrl("podcast"),
		icon: ListMusic,
	},
	{ module: "video", label: "视频", href: moduleUrl("video"), icon: Compass },
];

export const getMobilePrimaryTabs = (
	module?: ModuleRoomKey,
): MobilePrimaryTab[] =>
	module ? MOBILE_PRIMARY_TABS[module].map((tab) => ({ ...tab })) : [];

export const getMobileMoreItems = (): MobileMoreItem[] =>
	MORE_ITEMS.map((item) => ({ ...item }));
