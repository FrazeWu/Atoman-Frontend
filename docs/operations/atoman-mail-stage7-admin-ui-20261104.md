# Atoman Webmail Stage 7 — administrator invitation UI

Atoman's existing site administration uses /site/setting#users. Administrators and owners can click 发放邮箱邀请码 in the user-management toolbar or in an active user's action row. A modal searches current Atoman users through the existing protected administrator user API, displays the selected account and allows creating one invitation bound to that account. The one-time code is displayed only until the modal closes, with a manual copy control. It is never stored in URL, query string or browser local storage. If the feature flag is off, the modal reports that activation is unavailable, not fake success.

Invited users use /mail with their single-use code and independently chosen local part; validation accepts only 3-32 ASCII lowercase letters/digits, dots, underscores or hyphens with a leading and trailing alphanumeric character and no consecutive dots. Backend remains the authoritative final validator including reserved system names and unique constraints.

Logged-in administrators and owners see a self-reservation form instead of the invitation form. They choose their own address without an invitation. This creates only a reserved Atoman account mapping. The app never displays it as ready for sending/receiving while the separate Stalwart JMAP, R2 and TrueNAS operational gates have not been passed.

Tests: SettingUsersView, SettingMailInvitationDialog, MailWorkspaceView, api/mail, typecheck, production build and the existing Chrome desktop/mobile Webmail preview script. There is no separate Webmail login or Cloudflare project.
