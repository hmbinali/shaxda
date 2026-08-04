import { resolve } from "$app/paths";
import { BookOpen, Menu, ScrollText } from "@lucide/svelte";
import { siteContent } from "@shaxda/i18n";
import type { NavPanelGroup, TopBarConfig } from "$lib/shell/appShell.svelte";

const nav = siteContent.so.nav;
const topBar = siteContent.so.topBar;

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
        id: "menu",
        label: topBar.menuLabel,
        shortLabel: topBar.menuShort,
        icon: Menu,
        panel: "menu",
      },
    ],
    panels: [pageLinks],
    brandGuard: null,
  };
}
