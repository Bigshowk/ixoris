import { Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentAuth } from "../../common/current-auth.decorator";
import { AuthContext } from "../../common/auth-context";
import { NotificationsService } from "./notifications.service";

/** No @RequirePermissions here on purpose — every authenticated user can see their own notification feed, same as /auth/me. */
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Query("unreadOnly") unreadOnly: string | undefined, @CurrentAuth() auth: AuthContext) {
    return this.notifications.list(auth.companyId, auth.userId, unreadOnly === "true");
  }

  @Get("unread-count")
  unreadCount(@CurrentAuth() auth: AuthContext) {
    return this.notifications.countUnread(auth.companyId, auth.userId).then((count) => ({ count }));
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentAuth() auth: AuthContext) {
    return this.notifications.markRead(auth.companyId, id);
  }

  @Post("read-all")
  markAllRead(@CurrentAuth() auth: AuthContext) {
    return this.notifications.markAllRead(auth.companyId, auth.userId);
  }
}
