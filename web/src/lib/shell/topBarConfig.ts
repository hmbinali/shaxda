import BookOpen from "@lucide/svelte/icons/book-open";
import CircleHelp from "@lucide/svelte/icons/circle-question-mark";
import CircleUserRound from "@lucide/svelte/icons/circle-user-round";
import History from "@lucide/svelte/icons/history";
import LogIn from "@lucide/svelte/icons/log-in";
import LogOut from "@lucide/svelte/icons/log-out";
import ScrollText from "@lucide/svelte/icons/scroll-text";
import UserPlus from "@lucide/svelte/icons/user-plus";
import { siteContent } from "@shaxda/i18n";
import type { NavPanelGroup, TopBarConfig } from "$lib/shell/appShell.svelte";

const nav = siteContent.so.nav;
const topBar = siteContent.so.topBar;

export type AccountNavigationState =
  | null
  | { status: "incomplete" }
  | {
      status: "complete";
      username: string;
      avatarMode: "initial" | "google";
      imageUrl: string | null;
      avatarColor: string;
      initial: string;
    };

export function pagesGroup(): NavPanelGroup {
  return {
    id: "pages",
    label: topBar.groupPages,
    items: [
      {
        id: "learn",
        label: nav.learnRules,
        icon: BookOpen,
        href: "/learn",
      },
      { id: "help", label: nav.help, icon: CircleHelp, href: "/help" },
    ],
  };
}

export function accountGroup(account: AccountNavigationState): NavPanelGroup {
  return {
    id: "account",
    label: topBar.groupAccount,
    items:
      account?.status === "complete"
        ? [
            {
              id: "profile",
              label: `@${account.username}`,
              icon: CircleUserRound,
              href: `/u/${account.username}`,
            },
            {
              id: "history",
              label: nav.history,
              icon: History,
              href: "/history",
            },
            {
              id: "account-settings",
              label: nav.account,
              icon: CircleUserRound,
              href: "/account",
            },
            {
              id: "logout",
              label: nav.logout,
              icon: LogOut,
              formAction: "/logout",
              danger: true,
            },
          ]
        : account?.status === "incomplete"
          ? [
              {
                id: "complete-registration",
                label: nav.completeRegistration,
                icon: UserPlus,
                href: "/register",
              },
              {
                id: "logout",
                label: nav.logout,
                icon: LogOut,
                formAction: "/logout",
                danger: true,
              },
            ]
          : [
              { id: "login", label: nav.login, icon: LogIn, href: "/login" },
              {
                id: "register",
                label: nav.register,
                icon: UserPlus,
                href: "/register",
              },
            ],
  };
}

export function defaultTopBar(
  _pathname: string,
  account: AccountNavigationState,
): TopBarConfig {
  const pageLinks = pagesGroup();
  pageLinks.items.push({
    id: "legal",
    label: nav.legal,
    icon: ScrollText,
    href: "/legal",
  });

  return {
    actions: [
      {
        id: "account",
        label:
          account?.status === "complete"
            ? `@${account.username}`
            : topBar.accountLabel,
        shortLabel:
          account?.status === "complete"
            ? `@${account.username}`
            : topBar.accountShort,
        icon: CircleUserRound,
        panel: "account",
      },
    ],
    panels: [accountGroup(account), pageLinks],
    brandGuard: null,
  };
}
