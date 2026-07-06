export const defaultLocale = "so";
export const locales = ["so"] as const;

export const messages = {
  so: {
    appName: "Shaxda",
    foundationLabel: "Qandaraasyada F1",
    foundationSummary:
      "Qaab-dhismeedka shaxda, xeerarka, iyo ciyaarta martida ayaa diyaar u ah marxaladaha xiga.",
    boardGallery: {
      title: "Looxa shaxda",
      intro:
        "Muuqaalka looxa ayaa laga dhisay xaaladaha tijaabada ee la wadaago.",
      fixtureLabels: {
        emptyBoard: "Loox madhan",
        midPlacement: "Dhigista hore",
        placementJare: "Jare xilligii dhigista",
        initialRemoval: "Ka saarista bilowga",
        movement: "Dhaqdhaqaaq",
        capturePending: "Qabasho jare kadib",
        repeatedJare: "Jare soo noqnoqda",
        blockedPlayer: "Ciyaaryahan xanniban",
        blockedSpaceMade: "Bannayn xannibaad",
        drawByEightyTurns: "Barbaro 80 tallaabo",
        drawByRepetition: "Barbaro soo noqnoqosho",
        forcedJareSpaceMaking: "Bannayn jare qasab ah",
        win: "Guul",
        draw: "Barbaro",
      },
      fixtureDescriptions: {
        emptyBoard: "Dhammaan godadku way bannaan yihiin.",
        midPlacement: "Ciyaartoydu waxay bilaabeen inay dhagax dhigaan.",
        placementJare: "Saddex dhagax ayaa sameeyay jare xilligii dhigista.",
        initialRemoval: "Loox buuxa ka hor inta aan la saarin dhagaxda.",
        movement: "Labada dhinac waxay galeen wejiga dhaqdhaqaaqa.",
        capturePending: "Jare cusub ayaa keenay in dhagax la qabto.",
        repeatedJare: "Xaalad muujinaysa jare soo noqnoqda.",
        blockedPlayer: "Dhinac ayaa ku dhow in la xannibo.",
        blockedSpaceMade: "Dhaqdhaqaaq ayaa meel u furay dhinac xanniban.",
        drawByEightyTurns:
          "Ciyaartu waxay ku dhammaatay barbaro 80 tallaabo qabasho la'aan kadib.",
        drawByRepetition:
          "Ciyaartu waxay ku dhammaatay barbaro soo noqnoqosho kadib.",
        forcedJareSpaceMaking:
          "Meel bannaynta keliya waxay samayn lahayd jare, markaas ciyaartu waa barbaro.",
        win: "Ciyaartu waxay ku dhammaatay guul.",
        draw: "Ciyaartu waxay ku dhammaatay barbaro.",
      },
      selectedPoint: "Bar la doortay",
      legalHint: "Meel sharci ah",
      captureTarget: "Dhagax la qaban karo",
      playerPiece: {
        A: "Dhagaxa ciyaaryahan A",
        B: "Dhagaxa ciyaaryahan B",
      },
      emptyPoint: "Bar bannaan",
    },
  },
} as const;

export type Locale = (typeof locales)[number];
