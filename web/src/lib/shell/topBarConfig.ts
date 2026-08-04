import { resolve } from "$app/paths";
import {
  BookOpen,
  CircleHelp,
  CircleUserRound,
  LogIn,
  LogOut,
  ScrollText,
  UserPlus,
} from "@lucide/svelte";
import { siteContent } from "@shaxda/i18n";
import type { NavPanelGroup, TopBarConfig } from "$lib/shell/appShell.svelte";

const nav = siteContent.so.nav;
const topBar = siteContent.so.topBar;

// V1.1 will replace this flag with real authentication state.
export const SIGNED_IN = false as boolean;

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

export function accountGroup(): NavPanelGroup {
  return {
    id: "account",
    label: topBar.groupAccount,
    items: SIGNED_IN
      ? [
          {
            id: "profile",
            label: nav.profile,
            icon: CircleUserRound,
            href: "/profile",
          },
          {
            id: "logout",
            label: nav.logout,
            icon: LogOut,
            onSelect: () => {},
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

export function defaultTopBar(pathname: string): TopBarConfig {
  if (pathname !== resolve("/")) {
    return { actions: [], panels: [], brandGuard: null };
  }

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
        label: topBar.accountLabel,
        shortLabel: topBar.accountShort,
        icon: CircleUserRound,
        panel: "account",
      },
    ],
    panels: [accountGroup(), pageLinks],
    brandGuard: null,
  };
}
