export const SIDEBAR_COLLAPSED_STORAGE_KEY = "shaxda:sidebar-collapsed:v1";

type SidebarPreferenceStorage = Pick<Storage, "getItem" | "setItem">;

export function readSidebarCollapsed(
  storage: SidebarPreferenceStorage | null,
): boolean {
  if (storage === null) {
    return false;
  }

  try {
    return storage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(
  storage: SidebarPreferenceStorage | null,
  collapsed: boolean,
): void {
  if (storage === null) {
    return;
  }

  try {
    storage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      collapsed ? "true" : "false",
    );
  } catch {
    // Sidebar controls remain usable when local storage is unavailable.
  }
}

export function getSidebarPreferenceStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
