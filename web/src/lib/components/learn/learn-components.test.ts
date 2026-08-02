import { fireEvent, render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import LearnSectionNav from "./LearnSectionNav.svelte";
import RuleDiagram from "./RuleDiagram.svelte";

describe("learn components", () => {
  it("renders a described board with coordinate-free overlay text", () => {
    const { container } = render(RuleDiagram, {
      props: {
        diagramId: "legal-movement",
        title: "Dhaqdhaqaaq sharci ah",
        caption: "Dhagaxu wuxuu raacaa khadka ku xiga.",
        description: "Labada meelood ee la iftiimiyay ayaa bannaan oo ku xiga.",
      },
    });
    const board = container.querySelector(".shaxda-board-svg");
    const description = container.querySelector("figcaption [id]");

    expect(board).toHaveAttribute("aria-label", "Dhaqdhaqaaq sharci ah");
    expect(board).toHaveAttribute("aria-describedby", description?.id);
    expect(
      container.querySelector('[data-testid="board-overlay"]'),
    ).toHaveAttribute("aria-hidden", "true");
    expect(container.textContent).not.toMatch(/\b[OMI][1-8]\b/);
    expect(container.textContent).toContain("Sharci");
    expect(container.textContent).toContain("Boodis");
  });

  it("keeps normal anchors and immediately highlights the clicked section", async () => {
    const sections = [
      { id: "bilowga", label: "Bilowga" },
      { id: "jare", label: "Jare" },
    ] as const;
    const { container } = render(LearnSectionNav, {
      props: { sections, label: "Qaybaha hagaha" },
    });

    expect(container.querySelectorAll('a[href="#bilowga"]')).toHaveLength(2);
    expect(container.querySelectorAll('a[href="#jare"]')).toHaveLength(2);
    expect(
      container.querySelectorAll('a[href="#bilowga"][aria-current="location"]'),
    ).toHaveLength(2);

    const jareLink =
      container.querySelector<HTMLAnchorElement>('a[href="#jare"]');
    const bilowgaLink =
      container.querySelector<HTMLAnchorElement>('a[href="#bilowga"]');

    expect(jareLink).not.toBeNull();
    expect(bilowgaLink).not.toBeNull();

    await fireEvent.click(jareLink!);
    expect(
      container.querySelectorAll('a[href="#jare"][aria-current="location"]'),
    ).toHaveLength(2);

    await fireEvent.click(bilowgaLink!);
    expect(
      container.querySelectorAll('a[href="#bilowga"][aria-current="location"]'),
    ).toHaveLength(2);
  });
});
