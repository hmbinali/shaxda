export const defaultLocale = "so";
export const locales = ["so"] as const;

export const messages = {
  so: {
    appName: "Shaxda",
    foundationLabel: "Qandaraasyada F1",
    foundationSummary:
      "Qaab-dhismeedka shaxda, xeerarka, iyo ciyaarta martida ayaa diyaar u ah marxaladaha xiga.",
  },
} as const;

export type Locale = (typeof locales)[number];
