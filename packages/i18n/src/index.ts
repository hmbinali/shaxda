import { learnContentSo } from "./content/learn.so";
import { legalContentSo } from "./content/legal.so";

export * from "./content/learn.so";
export * from "./content/legal.so";
export * from "./content/types";

export const defaultLocale = "so";
export const locales = ["so"] as const;

const publicDescription =
  "Shaxda waa ciyaar Soomaali ah oo lagu barto xeerarka, lagu ciyaaro hal qalab, laguna diyaariyay ciyaar marti ah.";

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
      // TODO(translation-review): A native/fluent Somali reviewer must verify
      // these board-navigation labels and instructions before release.
      removalTarget: "Dhagax bilow ah oo la saari karo",
      movablePiece: "Dhagax dhaqaaqi kara",
      keyboardHelp:
        "Isticmaal fallaadhaha si aad looxa ugu dhex socoto, Enter ama Space si aad u ciyaarto, Escape si aad doorashada uga baxdo.",
      playerPiece: {
        A: "Dhagaxa ciyaaryahan A",
        B: "Dhagaxa ciyaaryahan B",
      },
      emptyPoint: "Bar bannaan",
    },
    localGame: {
      title: "Ciyaar qalabkan",
      description: "Ciyaar shax laba qof ah oo hal qalab lagu wada ciyaaro.",
      heading: "Ciyaar qalabkan",
      phaseLabel: "Wejiga",
      turnLabel: "Wareegga",
      actingLabel: "Ciyaaraya",
      firstAdvantageLabel: "Horrayn",
      piecesLabel: "Dhagax",
      inHandLabel: "Gacanta",
      onBoardLabel: "Looxa",
      capturedLabel: "Qabtay",
      turnsSinceCaptureLabel: "Dhaqaaqyo qabasho la'aan",
      blockedPrompt:
        "Ciyaaryahanka wareegga leh wuu xanniban yahay; ciyaaryahanka kale ha baneeyo meel sharci ah.",
      playerNames: {
        A: "Ciyaaryahan A",
        B: "Ciyaaryahan B",
      },
      phases: {
        placement: "Dhigis",
        initialRemoval: "Ka saarista bilowga",
        movement: "Dhaqdhaqaaq",
        capture: "Qabasho",
        gameOver: "Dhammaad",
      },
      controls: {
        newGame: "Ciyaar cusub",
        resign: "Is dhiib",
        exit: "Ka bax",
        soundOn: "Codka shid",
        soundOff: "Codka dami",
      },
      tabletop: {
        states: {
          acting: "Wareeggaaga",
          opponentActing: "Wareegga ciyaaryahanka kale",
          spaceMaking: "Meel bannay",
          blocked: "Waa xanniban yahay",
          winner: "Guuleystay",
          loser: "Ciyaartu way dhammaatay",
          waiting: "Sug",
        },
        instructions: {
          place: "Dhagax dhig",
          remove: "Dhagax ka saar",
          move: "Dhagax dhaqaaji",
          capture: "Dhagax qabso",
          makeSpace: "Meel u bannay ciyaaryahanka xanniban",
        },
        reserve: "Dhagaxa gacanta",
        drawApproaching: "Barbaro ayaa soo dhow",
        turnsRemaining: "dhaqaaq ayaa haray",
        details: "Faahfaahinta ciyaarta",
        cancel: "Jooji",
        confirm: "Xaqiiji",
      },
      prompts: {
        newGame: "Ciyaar cusub ma bilaabaysaa?",
        resign: "Ma hubtaa inaad is dhiibayso?",
        leave: "Ma hubtaa inaad ciyaarta ka baxayso?",
      },
      invalid: {
        gameOver: "Ciyaartu way dhammaatay.",
        illegalPoint: "Bartaas hadda lama ciyaari karo.",
        selectMovablePiece: "Dooro dhagax dhaqaaqi kara.",
        illegalMove: "Dhaqaaqaas sharci ma aha.",
        actionRejected: "Tallaabada lama aqbalin.",
      },
      result: {
        winnerLabel: "Guuleystay",
        drawLabel: "Barbaro",
        reasons: {
          opponentBelowThree:
            "Qofka ka soo horjeeda wuxuu ka haray wax ka yar saddex dhagax.",
          opponentCapturedAll:
            "Dhammaan dhagaxa qofka ka soo horjeeda waa la qabtay.",
          resignation: "Ciyaaryahan ayaa is dhiibay.",
          drawTermination: "Ciyaartu waxay ku dhammaatay barbaro.",
          bothBlocked: "Labada ciyaaryahanba way xanniban yihiin.",
          forcedJareSpaceMaking:
            "Bannaynta keliya waxay samayn lahayd jare qasab ah.",
        },
      },
      // TODO(translation-review): A native/fluent Somali reviewer must verify
      // these composable screen-reader announcement fragments before release.
      announce: {
        placed: "wuxuu dhagax dhigay barta",
        moved: "wuxuu dhagax ka dhaqaajiyay barta",
        movedTo: "una dhaqaajiyay barta",
        jareFormed: "wuxuuna sameeyay jare",
        captured: "wuxuu qabtay dhagaxa yaal barta",
        removedInitial: "wuxuu saaray dhagaxa bilowga ee barta",
        turnPrefix: "Wareegga",
        phasePrefix: "Wejiga",
        spaceMaking: "Meel ayaa loo bannaynayaa ciyaaryahanka xanniban.",
        winner: "Guuleystay",
        draw: "Ciyaartu waa barbaro.",
        resigned: "wuu is dhiibay",
        stateSynced: "Xaaladda ciyaarta waa la waafajiyay.",
      },
    },
    onlineGame: {
      title: "Ciyaar marti ah",
      description: "Samee qol shax ah ama ku biir xiriiriye marti ah.",
      heading: "Ciyaar marti ah",
      nameLabel: "Magaca martida",
      roomCodeLabel: "Koodhka qolka",
      shareLabel: "Xiriiriyaha qolka",
      createRoom: "Samee qol",
      joinRoom: "Ku biir",
      copyLink: "Koobi garee",
      copied: "Waa la koobiyeeyay",
      leave: "Ka bax",
      newRoom: "Qol cusub",
      waiting: "Sug ciyaaryahanka kale.",
      claimWin: "Qaado guusha",
      youLabel: "Adiga",
      opponentLabel: "Ka soo horjeeda",
      emptySlot: "Weli lama gelin",
      connectionLabel: "Xiriirka",
      statusLabel: "Xaaladda",
      roomLabel: "Qolka",
      connection: {
        idle: "Aan bilaaban",
        connecting: "Wuu xirmayaa",
        reconnecting: "Dib ayuu u xirmayaa",
        connected: "Wuu xiran yahay",
        closed: "Wuu go'ay",
        error: "Khalad xiriir",
      },
      notices: {
        reconnecting: "Xiriirkii wuu go'ay; dib ayaa loo xirmayaa.",
        opponentDisconnected:
          "Ciyaaryahanka kale xiriirkii wuu go'ay. Sug inuu soo noqdo.",
        idleNudge: "Wareeggaaga waa la sugayaa.",
        claimAvailable:
          "Ciyaaryahanka kale ma joogo; guusha waad qaadan kartaa.",
      },
      result: {
        reasons: {
          opponentAbandoned: {
            winner: "Ciyaaryahanka kale wuu baxay; waad guuleysatay.",
            loser: "Xiriirkaaga wuu go'ay; ciyaaryahanka kale ayaa guuleystay.",
          },
          opponentIdleTimeout: {
            winner: "Ciyaaryahanka kale wuu hakaday; waad guuleysatay.",
            loser: "Waad hakaday; ciyaaryahanka kale ayaa guuleystay.",
          },
        },
      },
      invalid: {
        gameOver: "Ciyaartu way dhammaatay.",
        illegalPoint: "Bartaas hadda lama ciyaari karo.",
        selectMovablePiece: "Dooro dhagax dhaqaaqi kara.",
        illegalMove: "Dhaqaaqaas sharci ma aha.",
        actionRejected: "Tallaabada lama aqbalin.",
      },
      errors: {
        invalidMessage: "Fariinta qolka lama fahmin.",
        roomNotFound: "Qolka lama helin.",
        roomMismatch: "Koodhka qolka lama jaanqaadayo.",
        roomFull: "Qolku wuu buuxaa.",
        notJoined: "Marka hore ku biir qolka.",
        waitingForOpponent: "Sug ciyaaryahanka kale.",
        notYourTurn: "Wareeggaaga ma aha.",
        wrongPhase: "Wejiga ciyaartu tallaabadan ma qaadan karo.",
        pointOccupied: "Bartaas dhagax ayaa yaal.",
        pointEmpty: "Bartaas way bannaan tahay.",
        notOpponentPiece: "Dooro dhagax ka soo horjeeda.",
        notOwnPiece: "Dooro dhagaxaaga.",
        notAdjacent: "Bartaas kuma xigto.",
        destinationOccupied: "Meesha loo socdo dhagax ayaa yaal.",
        noPiecesInHand: "Dhagax gacanta ku haray ma jiro.",
        alreadyRemovedInitial: "Dhagax bilow ah horay ayaad u saartay.",
        notSpaceMaking: "Dhaqaaqaas meel bannayn sharci ah ma aha.",
        unsupportedAction: "Tallaabadaas lama taageero.",
        notClaimable: "Guusha hadda lama qaadan karo.",
        rateLimited: "Codsiyo badan ayaa yimid; sug wax yar.",
        tooManyRooms: "Qolal badan ayaad furtay; mid isticmaal ama sug.",
        capacityFull: "Adeeggu hadda wuu buuxaa; mar kale isku day.",
        turnstileFailed: "Hubinta amniga lama dhammaystirin.",
        messageTooLarge: "Fariintu way ka weyn tahay inta la oggol yahay.",
        createFailed: "Qolka lama samayn karo hadda.",
      },
      form: {
        namePlaceholder: "Magacaaga",
        codePlaceholder: "ABCD1234",
      },
    },
    pwa: {
      offline: {
        title: "Qalabku khadka kama jiro",
        body: "Ciyaarta qalabkan way sii shaqaynaysaa haddii boggu horay u kaydsanaa.",
      },
      offlineReady: {
        title: "Shaxda waa diyaar offline",
        body: "Ciyaarta qalabkan hadda waa la furi karaa marka khadku maqanyahay.",
      },
      update: {
        title: "Cusboonaysiin ayaa diyaar ah",
        body: "Nooc cusub ayaa la helay.",
        action: "Cusboonaysii",
      },
      install: {
        title: "Ku rakib Shaxda",
        body: "Ku dar qalabka si ciyaarta qalabkan si fudud loogu furo.",
        action: "Rakib",
        dismiss: "Hadda ma aha",
      },
    },
  },
} as const;

export const siteContent = {
  so: {
    metadata: {
      description: publicDescription,
      ogImageAlt: "Loox shaxda ah iyo magaca Shaxda",
    },
    nav: {
      home: "Hoy",
      learn: "Baro",
      legal: "Sharciga",
      localPlay: "Ciyaar qalabkan",
      onlinePlay: "Ciyaar marti ah",
    },
    sidebar: {
      skipToContent: "U bood nuxurka",
      openMenu: "Fur hagaha",
      closeMenu: "Xir hagaha",
    },
    footer: {
      tagline: "Shaxda Soomaali keliya, si fudud loogu barto loona ciyaaro.",
    },
    errorPage: {
      notFound: {
        title: "Bogga lama helin",
        description: "Bogga aad raadinayso ma jiro ama waa laga saaray boggan.",
      },
      unexpected: {
        title: "Waxbaa khaldamay",
        description:
          "Bogga lama soo bandhigi karo hadda. Fadlan mar kale isku day.",
      },
      homeCta: "Ku noqo hoyga",
      learnCta: "Baro shaxda",
    },
    pages: {
      home: {
        path: "/",
        title: "Shaxda",
        description: publicDescription,
        heroEyebrow: "Ciyaar dhaqameed Soomaali ah",
        heroTitle: "Shaxda",
        heroBody:
          "Bar xeerarka shaxda, ciyaar laba qof oo hal qalab wada jooga, kadibna la ciyaar marti aad xiriiriye u dirto marka qaybtaas diyaar noqoto.",
        primaryCta: "Ciyaar qalabkan",
        secondaryCta: "Ciyaar marti ah",
        highlights: [
          "Loox ka kooban saddex afar-gees oo isku xiran iyo 24 barood.",
          "Labada ciyaaryahan midkiiba wuxuu leeyahay 12 dhagax.",
          "Jare, irmaan, difaac, iyo dhaqdhaqaaq qorshaysan ayaa ciyaarta dhisa.",
        ],
        sections: [
          {
            title: "Maxay tahay shaxda?",
            body: "Shaxda waa ciyaar xeelad ah oo laba qof wada ciyaaraan. Ciyaaryahanku wuxuu isku dayaa inuu sameeyo jare, difaaco dhagaxiisa, kana faa'iideysto fursadaha qabashada.",
          },
          {
            title: "Qaab casri ah",
            body: "Boggan wuxuu isu keenayaa sharaxaad, barasho, xeerar, iyo waddooyin lagu ciyaaro iyadoo nuxurka ciyaarta dhaqanka ah la ilaalinayo.",
          },
          {
            title: "Bilow fudud",
            body: "Haddii aad cusub tahay ama aad rabto xeerarka oo dhan, ka bilow bogga Baro; hagahaas ayaa tallaabo tallaabo kuu diyaarinaya ciyaarta.",
          },
        ],
      },
      learn: learnContentSo,
      legal: legalContentSo,
    },
  },
} as const;

export type Locale = (typeof locales)[number];
