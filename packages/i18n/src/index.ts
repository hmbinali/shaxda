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
        blockedSpaceMade: "Meel loo furay",
        drawByEightyTurns: "Barbaro 80 wareeg",
        drawByRepetition: "Barbaro soo noqnoqosho",
        forcedJareSpaceMaking: "Barbaro jare qasab ah",
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
        blockedSpaceMade: "Dhinaca kale ayaa sameeyay meel lagu dhaqaaqo.",
        drawByEightyTurns:
          "80 wareeg ayaa dhammaaday iyada oo aan qabasho jirin.",
        drawByRepetition: "Isla xaalad dhaqdhaqaaq ayaa timid saddex jeer.",
        forcedJareSpaceMaking:
          "Meel furistu waxay qasab ka dhigaysaa jare, sidaas darteed waa barbaro.",
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
