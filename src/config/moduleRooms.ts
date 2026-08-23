import type { ModuleRoomKey } from "@atoman/module-config";
import type { SiteContext } from "@/router/siteContext";

export {
	footbarLinks,
	moduleNavOrder,
	moduleRooms,
	notificationRoom,
	topbarNavOrder,
} from "@atoman/module-config";
export type {
	FootbarPanel,
	ModuleRoom,
	ModuleRoomKey,
} from "@atoman/module-config";

export const isRoomRouteActive = (key: ModuleRoomKey, context: SiteContext) =>
	context.type === "module" && context.module === key;
