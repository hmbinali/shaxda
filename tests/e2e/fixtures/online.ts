import { expect, type Page } from "@playwright/test";

export async function actingSeat(page: Page): Promise<"A" | "B"> {
  const board = page.getByTestId("online-board");
  await expect(board).toHaveAttribute("data-current-player", /^[AB]$/);
  return (await board.getAttribute("data-current-player")) === "A" ? "A" : "B";
}

export async function placeOnline(
  pages: { A: Page; B: Page },
  point: string,
): Promise<"A" | "B"> {
  await Promise.all(
    Object.values(pages).map((page) =>
      expect(page.getByTestId("online-board")).toBeVisible(),
    ),
  );
  const seat = await actingSeat(pages.A);
  await expect(pages[seat].getByTestId("online-board")).toHaveAttribute(
    "data-current-player",
    seat,
  );
  await pages[seat].locator(`[data-point-id="${point}"]`).click();
  for (const page of Object.values(pages)) {
    await expect(page.locator(`[data-point-id="${point}"]`)).toHaveAttribute(
      "data-occupant",
      seat,
    );
  }
  const next = seat === "A" ? "B" : "A";
  for (const page of Object.values(pages)) {
    await expect(page.getByTestId("online-board")).toHaveAttribute(
      "data-current-player",
      next,
    );
  }
  return seat;
}

export async function resignOnline(page: Page): Promise<void> {
  await page
    .getByTestId("app-top-bar")
    .getByRole("button", { name: "Fur ficillo kale" })
    .click();
  await page.getByRole("menuitem", { name: "Is dhiib" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Xaqiiji" })
    .click();
}
