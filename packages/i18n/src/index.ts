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
        soundOn: "Codka shid",
        soundOff: "Codka dami",
      },
      prompts: {
        newGame: "Ciyaar cusub ma bilaabaysaa?",
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
      rules: "Xeerarka",
      privacy: "Asturnaanta",
      terms: "Shuruudaha",
      localPlay: "Ciyaar qalabkan",
      onlinePlay: "Ciyaar marti ah",
    },
    sidebar: {
      skipToContent: "U bood nuxurka",
      openMenu: "Fur hagaha",
      closeMenu: "Xir hagaha",
      expandSidebar: "Ballaari hagaha",
      collapseSidebar: "Isku koob astaamo",
    },
    footer: {
      tagline: "Shaxda Soomaali keliya, si fudud loogu barto loona ciyaaro.",
      reviewNote:
        "Qoraalka asturnaanta iyo shuruudaha wuxuu u baahan yahay dib u eegis mulkiile iyo sharci ka hor daahfurka.",
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
        learnCta: "Baro xeerarka",
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
            body: "Haddii aad cusub tahay, ka bilow bogga Baro. Haddii aad rabto xeerarka oo dhan, isticmaal bogga Xeerarka.",
          },
        ],
      },
      learn: {
        path: "/learn",
        title: "Baro shaxda",
        description:
          "Hage bilow ah oo Soomaali ah: qalabka, dhigista, jare, dhaqdhaqaaq, irmaan, iyo khaladaadka caanka ah.",
        heading: "Baro shaxda",
        intro:
          "Hagahan wuxuu sharxayaa sida ciyaartu u socoto laga bilaabo loox madhan ilaa guul ama barbaro.",
        quickStartTitle: "Bilow degdeg ah",
        quickStart: [
          "Diyaari 24 barood iyo laba kooxood oo dhagax ah.",
          "Ciyaaryahannadu midba mar ha dhigo dhagax ilaa looxu buuxsamo.",
          "Jare-kii ugu horreeyay ee xilligii dhigista ayaa go'aamiya cidda hormarta.",
          "Labada ciyaaryahan midkiiba ha saaro hal dhagax oo ka mid ah dhagaxa ka soo horjeeda.",
          "Kadib u dhaqaaq bar ku xigta oo bannaan, adigoo raadinaya jare cusub.",
        ],
        topics: [
          {
            title: "Qalabka iyo looxa",
            body: "Shaxdu waxay leedahay saddex afar-gees oo isku xiran. Waxaa jira 24 barood: 8 bannaanka ah, 8 dhexe ah, iyo 8 gudaha ah. Ciyaaryahan kasta wuxuu leeyahay 12 dhagax.",
          },
          {
            title: "Dhigista",
            body: "Ciyaaryahannadu way is dhaafsadaan dhigista hal dhagax markiiba ilaa dhammaan 24-ka barood la buuxiyo. Xilligan jare wuu samaysmi karaa, laakiin dhagax lama saaro.",
          },
          {
            title: "Horraynta",
            body: "Haddii qof sameeyo jare-kii ugu horreeyay xilligii dhigista, qofkaas ayaa helaya horraynta. Haddii jare la waayo, ciyaaryahanka aan bilaabin ayaa hormaraya.",
          },
          {
            title: "Ka saarista bilowga",
            body: "Marka looxu buuxsamo, ciyaaryahanka horraynta leh wuxuu marka hore saaraa hal dhagax oo ka mid ah dhagaxa ka soo horjeeda. Kadib ciyaaryahanka kale isna hal dhagax ayuu saaraa.",
          },
          {
            title: "Dhaqdhaqaaqa",
            body: "Ka dib ka saarista bilowga, ciyaaryahanka horraynta leh ayaa dhaqaaqa koowaad sameeya. Dhagax wuxuu u dhaqaaqi karaa oo keliya barta xigta ee ku xiran ee bannaan.",
          },
          {
            title: "Jare",
            body: "Jare waa saddex dhagax oo isku ciyaaryahan leeyahay oo ku jira sadar toosan oo isku xiran. Xilliga dhaqdhaqaaqa, jare cusub wuxuu oggolaanayaa in hal dhagax la qabto.",
          },
          {
            title: "Jare soo noqnoqda",
            body: "Jare lama isticmaali karo marar badan isagoo aan jabin. Dhagax waa inuu ka baxaa jare-ka, kadibna dib ugu noqdaa si jare cusub loo sameeyo.",
          },
          {
            title: "Irmaan",
            body: "Irmaan waa jare la ilaalin karo ama soo noqon kara oo qofka ka soo horjeeda uusan si fudud u xannibi karin. Waa meel xoog badan oo inta badan qabashooyin badan keenta.",
          },
        ],
        mistakesTitle: "Khaladaadka bilowga",
        mistakes: [
          "In la moodo in jare xilligii dhigista uu isla markiiba qabasho keeno.",
          "In laga boodo barood ama lagu dhaqaaqo meel aan khad toos ah ku xirnayn.",
          "In la isku dayo qabasho labaad jare aan la jebin.",
          "In la illoobo in xannibaad keligood guul keeni waayaan.",
        ],
      },
      rules: {
        path: "/rules",
        title: "Xeerarka shaxda",
        description:
          "Xeerarka shaxda: dhigista, horraynta, ka saarista bilowga, dhaqdhaqaaqa, jare, irmaan, barbaro, iyo guul.",
        heading: "Xeerarka shaxda",
        intro:
          "Xeerarkani waxay raacayaan dukumentiga ciyaarta ee mashruuca. Boggan waa koobid cad oo ciyaaryahan cusub iyo mid khibrad leh labadaba akhrin karaan.",
        sections: [
          {
            title: "Qalabka",
            items: [
              "Laba ciyaaryahan ayaa ciyaara.",
              "Looxu wuxuu leeyahay 24 barood oo ku yaal saddex afar-gees oo isku xiran.",
              "Ciyaaryahan kasta wuxuu leeyahay 12 dhagax oo si cad looga garan karo kan kale.",
            ],
          },
          {
            title: "Dhigista iyo horraynta",
            items: [
              "Ciyaaryahannadu hal dhagax bay marba dhigiyaan ilaa dhammaan 24-ka barood la buuxiyo.",
              "Jare xilligii dhigista wuxuu go'aamiyaa horraynta oo keliya.",
              "Dhagax lama saaro xilligii dhigista, xitaa haddii jare la sameeyo.",
              "Haddii aan jare la samayn, ciyaaryahanka aan bilaabin ayaa helaya horraynta.",
            ],
          },
          {
            title: "Ka saarista bilowga",
            items: [
              "Marka looxu buuxsamo, ciyaaryahanka horraynta leh ayaa marka hore saara hal dhagax oo ka soo horjeeda.",
              "Ciyaaryahanka kale ayaa kadib saara hal dhagax oo ka soo horjeeda.",
              "Dhagax kasta oo ka soo horjeeda waa la saari karaa, xitaa haddii uu ku jiro jare.",
            ],
          },
          {
            title: "Dhaqdhaqaaqa",
            items: [
              "Ciyaaryahanka horraynta leh ayaa dhaqaaqa koowaad sameeya.",
              "Dhagax wuxuu u dhaqaaqi karaa oo keliya barta xigta ee ku xiran ee bannaan.",
              "Lama boodi karo, lama mari karo dhagax kale, lamana degi karo bar la haysto.",
              "Dhaqdhaqaaq dhinac u janjeera oo aan khad ku xirnayn ma aha sharci.",
            ],
          },
          {
            title: "Jare iyo qabasho",
            items: [
              "Jare waa saddex dhagax oo isku ciyaaryahan leeyahay oo ku jira sadar toosan oo isku xiran.",
              "Xilliga dhaqdhaqaaqa, jare cusub wuxuu oggolaanayaa hal qabasho oo keliya.",
              "Qabasho waxay dhici kartaa oo keliya marka dhaqdhaqaaqu sameeyo jare cusub oo aan horay u dhammeystirnayn.",
              "Haddii hal dhaqdhaqaaq sameeyo in ka badan hal jare, weli hal qabasho oo keliya ayaa la helaa.",
              "Dhagax kasta oo ka soo horjeeda waa la qaban karaa, xitaa mid ku jira jare.",
            ],
          },
          {
            title: "Jare soo noqnoqda iyo irmaan",
            items: [
              "Jare waa in la jebiyo kadibna dib loo sameeyo si qabasho kale looga helo.",
              "Jare taagan oo aan is beddelin ma bixin karo qabashooyin is daba joog ah.",
              "Irmaan waa jare soo noqon kara ama la ilaalin karo oo qofka ka soo horjeeda uusan si fudud u xannibi karin.",
            ],
          },
          {
            title: "Ciyaaryahan xanniban",
            items: [
              "Haddii ciyaaryahan uusan lahayn dhaqaaq sharci ah, xannibaaddu si toos ah guul uma aha.",
              "Ciyaaryahanka kale waa inuu sameeyo dhaqaaq bannaynaya ugu yaraan hal meel oo sharci ah.",
              "Dhaqaaqa bannaynta ma samayn karo jare cusub.",
            ],
          },
          {
            title: "Barbaro",
            items: [
              "Labada ciyaaryahan haddii ay wada xanniban yihiin, ciyaartu waa barbaro.",
              "Haddii dhaqaaqa keliya ee bannayn kara uu sameynayo jare cusub, ciyaartu waa barbaro.",
              "Haddii isla booska dhaqdhaqaaqa ahi saddex jeer soo noqdo iyadoo isla ciyaaryahanku dhaqaaqayo oo qabasho sugani jirin, ciyaartu waa barbaro.",
              "Haddii 80 dhaqaaq oo dhaqdhaqaaq ah la sameeyo iyadoo aan qabasho dhicin, ciyaartu waa barbaro.",
            ],
          },
          {
            title: "Guul",
            items: [
              "Ciyaaryahan wuu guuleystaa haddii qofka ka soo horjeeda uu ka haro wax ka yar 3 dhagax.",
              "Ciyaaryahan wuu guuleystaa haddii dhammaan dhagaxa qofka ka soo horjeeda la qabto.",
              "Ciyaaryahan wuu guuleystaa haddii qofka ka soo horjeeda is dhiibo.",
            ],
          },
        ],
        jareLinesTitle: "Dhammaan 16-ka sadar ee jare",
        jareLines: [
          "O1 - O2 - O3",
          "O3 - O4 - O5",
          "O5 - O6 - O7",
          "O7 - O8 - O1",
          "M1 - M2 - M3",
          "M3 - M4 - M5",
          "M5 - M6 - M7",
          "M7 - M8 - M1",
          "I1 - I2 - I3",
          "I3 - I4 - I5",
          "I5 - I6 - I7",
          "I7 - I8 - I1",
          "O2 - M2 - I2",
          "O4 - M4 - I4",
          "O6 - M6 - I6",
          "O8 - M8 - I8",
        ],
      },
      privacy: {
        path: "/privacy",
        title: "Asturnaanta",
        description:
          "Qoraal asturnaan oo qabyo ah oo sharxaya habka V1.0: akoon la'aan, marti, kayd qalab, iyo martigelin Cloudflare.",
        heading: "Asturnaanta",
        intro:
          "Boggan waa qoraal qabyo ah oo ku saabsan sida V1.0 loo qorsheeyay. Waa inuu maro dib u eegis mulkiile iyo sharci ka hor daahfurka.",
        sections: [
          {
            title: "Akoon la'aan",
            body: "V1.0 looma qorsheyn akoon, galitaan Google, magac joogto ah, taariikh ciyaareed joogto ah, ama miis darajo. Ciyaarta martida waxay isticmaashaa magac bandhig marti ah oo fudud.",
          },
          {
            title: "Kaydka qalabka",
            body: "Ciyaarta hal qalab, dookhyada yaryar, iyo aqoonsiga martida ee fudud waxaa loo qorsheeyay in lagu hayo localStorage ee qalabka isticmaalaha.",
          },
          {
            title: "Ciyaarta martida",
            body: "Ciyaarta martida ee V1.0 waxaa loo qorsheeyay inay noqoto mid aan darajo lahayn oo inta badan aan joogto loo kaydin. Xaaladda ciyaarta firfircoon waxay ku jirtaa qolka ciyaarta inta ciyaartu socoto.",
          },
          {
            title: "Martigelin",
            body: "Adeegga waxaa loo qorsheeyay in lagu martigeliyo Cloudflare Workers iyo faylal taagan. Diiwaanada iyo cabbirka hawlgalka waa in lagu koobaa waxa adeegga u baahan yahay.",
          },
          {
            title: "Lacag iyo xayeysiis",
            body: "V1.0 kuma jiro xayeysiis, lacag bixin, taageero ganacsi, xiriir iib, ama iib. Haddii siyaasaddan is beddesho mustaqbalka, qoraalkan waa in la cusboonaysiiyaa.",
          },
        ],
      },
      terms: {
        path: "/terms",
        title: "Shuruudaha",
        description:
          "Shuruudaha isticmaalka oo qabyo ah oo loogu talagalay Shaxda V1.0 iyo ciyaarta martida.",
        heading: "Shuruudaha",
        intro:
          "Boggan waa qoraal qabyo ah oo u baahan dib u eegis mulkiile iyo sharci ka hor daahfurka. Wuxuu sharxayaa isticmaalka guud ee Shaxda V1.0.",
        sections: [
          {
            title: "Isticmaalka adeegga",
            body: "Shaxda waxaa loogu talagalay barasho iyo ciyaar laba qof ah. Isticmaaluhu waa inuu si cadaalad ah u ciyaaro oo uusan isku dayin inuu dhaawaco adeegga ama ciyaaryahannada kale.",
          },
          {
            title: "Ciyaarta martida",
            body: "Magacyada bandhigga ee martida waa inay ahaadaan kuwo edeb leh. Qolalka martida waxaa loogu talagalay ciyaar fudud oo aan darajo lahayn.",
          },
          {
            title: "Xeerarka ciyaarta",
            body: "Xeerarka ciyaarta waxay raacayaan dukumentiga ciyaarta ee mashruuca. Haddii ciyaaryahanno dhaqameed ama tijaabooyin bulshada ahi caddeeyaan sixid, xeerarka iyo adeegga waa in si wadajir ah loo cusboonaysiiyaa.",
          },
          {
            title: "Helitaanka adeegga",
            body: "Adeeggu wuxuu ku jiraa dhisme V1.0 ah. Mararka qaar wuu istaagi karaa, wuu is beddeli karaa, ama qaybo ka mid ah lama heli karo inta horumarintu socoto.",
          },
          {
            title: "Waxyaabaha aan ku jirin V1.0",
            body: "V1.0 kuma jiro akoon, galitaanka Google, taariikh ciyaareed joogto ah, miis darajo, sheeko fariin ah, caqli macmal, tartan rasmi ah, xayeysiis, taageero ganacsi, ama lacag bixin.",
          },
        ],
      },
    },
  },
} as const;

export type Locale = (typeof locales)[number];
