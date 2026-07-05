export const defaultLocale = "so";
export const locales = ["so", "en"] as const;

export const messages = {
  so: {
    appName: "Shaxda",
    foundationLabel: "Aasaaska mashruuca",
    foundationSummary:
      "Qaab-dhismeedka app-ka Shaxda ayaa diyaar u ah marxaladaha xiga.",
  },
  en: {
    appName: "Shaxda",
    foundationLabel: "Project foundation",
    foundationSummary:
      "The Shaxda app foundation is ready for the next milestones.",
  },
} as const;

export type Locale = (typeof locales)[number];
