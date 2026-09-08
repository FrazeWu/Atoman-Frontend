type RelatedLink = {
	label: string;
	href: string;
	action?: string;
};

export const relatedLinks: readonly RelatedLink[] = [
	{
		label: "Docker 镜像加速",
		href: "https://mirror.atoman.org/",
		action: "docker-proxy",
	},
	{
		label: "阮一峰的网络日志",
		href: "https://www.ruanyifeng.com/blog/",
	},
	{
		label: "少数派",
		href: "https://sspai.com/",
	},
	{
		label: "小众软件",
		href: "https://www.appinn.com/",
	},
	{
		label: "Matrix67",
		href: "https://matrix67.com/blog/",
	},
	{
		label: "稀土掘金",
		href: "https://juejin.cn/",
	},
	{
		label: "码农周刊",
		href: "https://github.com/toutiaoio/weekly.manong.io",
	},
	{
		label: "COOLSHELL",
		href: "https://coolshell.cn/",
	},
	{
		label: "更新 Issue",
		href: "https://github.com/FrazeWu/Atoman-Frontend/issues",
		action: "github-issues",
	},
	{
		label: "Telegram 社区",
		href: "https://t.me/+D7TjmjdFTV44MzI0",
		action: "telegram-community",
	},
	{
		label: "Discord 社区",
		href: "https://discord.gg/FJsMmceNB",
		action: "discord-community",
	},
] as const;
