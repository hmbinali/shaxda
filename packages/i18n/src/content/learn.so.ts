import type { ContentCallout, ContentCalloutVariant } from "./types";

export const learnSectionIds = [
  "bilowga",
  "wejiyada",
  "dhaqdhaqaaqa",
  "jare",
  "irmaan",
  "xannibaad",
  "dhammaadka",
  "talooyin",
  "koobid",
] as const;

export type LearnSectionId = (typeof learnSectionIds)[number];

export type LearnDiagramContentId =
  | "board-anatomy"
  | "legal-movement"
  | "jare-formed"
  | "jare-opened"
  | "jare-reformed"
  | "blocked-player"
  | "blocked-space-made";

export type LearnCalloutVariant = ContentCalloutVariant;

interface LearnSubsection {
  heading: string;
  paragraphs: readonly string[];
  rules: readonly string[];
}

interface LearnDiagramFrame {
  id: LearnDiagramContentId;
  title: string;
  caption: string;
  description: string;
}

interface LearnDiagramGroup {
  label: string;
  columns: 2 | 3;
  frames: readonly LearnDiagramFrame[];
}

interface LearnSummaryItem {
  term: string;
  detail: string;
}

export interface LearnSectionPhoto {
  src: "/images/learn/irmaan-example.jpg";
  alt: string;
  caption: string;
  width: 960;
  height: 1280;
}

interface LearnCta {
  href: "/local" | "/online";
  label: string;
  tone: "emerald" | "sky";
}

interface LearnSection {
  id: LearnSectionId;
  navLabel: string;
  heading: string;
  paragraphs: readonly string[];
  photo?: LearnSectionPhoto;
  subsections: readonly LearnSubsection[];
  rules: readonly string[];
  callouts: readonly ContentCallout[];
  diagramGroups: readonly LearnDiagramGroup[];
  summary: readonly LearnSummaryItem[];
  ctas: readonly LearnCta[];
}

export interface LearnPageContent {
  path: "/learn";
  title: string;
  description: string;
  hero: {
    eyebrow: string;
    heading: string;
    intro: string;
  };
  navigationLabel: string;
  sections: readonly LearnSection[];
}

export const learnContentSo = {
  path: "/learn",
  title: "Sida loo ciyaaro shaxda",
  description:
    "Bar sida loo ciyaaro shaxda: dhigista, horraynta, ka saarista bilowga, dhaqdhaqaaqa, jare, irmaan, xannibaad, guul iyo barbaro.",
  hero: {
    eyebrow: "Xeerarka rasmiga ah ee bilaashka ah",
    heading: "Baro shaxda",
    intro:
      "Shaxdu waa ciyaar dhaqameed Soomaaliyeed oo laba qof ku tartamaan qorshe, difaac, iyo weerar. Mid kastaa wuxuu adeegsadaa 12 dhagax oo uu jare ugu sameeyo qabashada dhagaxa qofka kale. Hagahan wuxuu qof cusub ka bilaabayaa looxa iyo dhigista, kadibna wuxuu tallaabo tallaabo u sharxayaa dhaqdhaqaaqa, jare, irmaan, xannibaad, guul iyo barbaro. Markaad dhamayso, waxaad diyaar u tahay ciyaartaada koowaad.",
  },
  navigationLabel: "Qaybaha hagaha",
  sections: [
    {
      id: "bilowga",
      navLabel: "Bilowga",
      heading: "Looxa iyo ujeeddada",
      paragraphs: [
        "Shaxda waxaa ciyaara 2 qof. Ciyaaryahan kasta wuxuu leeyahay 12 dhagax oo si cad uga duwan 12-ka qofka kale; sidaas darteed waxaa jira 24 dhagax. Looxu isna wuxuu leeyahay 24 barood oo ku yaal 3 afar-gees oo isku xiran: 8 dibadda ah, 8 dhexe ah, iyo 8 gudaha ah.",
        "Dhagax waxaa la dhigaa oo keliya bar, wuxuuna marka dambe u dhaqaaqaa khadka isku xira baraha. Ujeeddadu waa in la sameeyo jare cusub si dhagaxa qofka kale loo qabto. Qofku wuxuu u baahan yahay ugu yaraan 3 dhagax si uu jare u samayn karo.",
      ],
      subsections: [],
      rules: [],
      callouts: [],
      diagramGroups: [
        {
          label: "Qaabka looxa shaxda",
          columns: 2,
          frames: [
            {
              id: "board-anatomy",
              title: "Saddex afar-gees, 24 barood",
              caption:
                "Afar-gees kasta wuxuu leeyahay 8 barood; khadadka dhexe ayaa saddexda qaybood isku xira.",
              description:
                "Loox madhan oo muujinaya afar-geeska dibadda, kan dhexe, iyo kan gudaha. Mid kasta wuxuu leeyahay 4 gees iyo 4 barood oo bartamaha dhinacyada ah.",
            },
          ],
        },
      ],
      summary: [],
      ctas: [],
    },
    {
      id: "wejiyada",
      navLabel: "Wejiyada",
      heading: "Saddexda marxaladood",
      paragraphs: [
        "Ciyaartu mar walba waxay u socotaa 3 marxaladood: dhigista, ka saarista bilowga, iyo dhaqdhaqaaqa. Horrayntu waxay isku xirtaa marxaladahaas, sababtoo ah qofka hela ayaa marka hore wax saara, kadibna marka hore dhaqaaqa.",
      ],
      subsections: [
        {
          heading: "1. Dhigista",
          paragraphs: [
            "Ka hor bilowga, labada ciyaaryahan waxay ku heshiiyaan qofka dhagaxa koowaad dhigaya. Midba mar ayuu hal dhagax dhigaa ilaa 24-ka barood oo dhan la buuxiyo. Dhagax lama dhaqaajiyo inta dhigistu socoto.",
          ],
          rules: [
            "Jare la sameeyo xilliga dhigista qabasho ama ka saarid ma keeno.",
            "Haddii hal dhigis ay mar keliya dhammaystirto dhowr sadar oo jare ah, weli waa hal dhacdo oo horrayn ah.",
          ],
        },
        {
          heading: "2. Horraynta iyo ka saarista bilowga",
          paragraphs: [
            "Horrayn waa xaqa in marka hore hal dhagax la saaro, kadibna dhaqaaqa koowaad la sameeyo. Qofka sameeya jare-kii ugu horreeyay ee dhigista ayaa horraynta hela. Haddii aan cidina jare samayn, qofkii aan bilaabin dhigista ayaa hela, maadaama uu si guul leh u difaacay.",
            "Marka looxu buuxsamo, qofka horraynta leh wuxuu saaraa hal dhagax oo qofka kale leeyahay. Kadib qofka kale isna hal dhagax ayuu saaraa. Dhagax kasta waa la saari karaa: mid jare ku jira, mid difaac haya, ama mid caadi ah. Xannibaad kama jirto doorashada. Labaduba markaas waxay looxa ku leeyihiin 11 dhagax.",
          ],
          rules: [],
        },
        {
          heading: "3. Dhaqdhaqaaqa",
          paragraphs: [
            "Qofka horraynta leh ayaa sameeya dhaqaaqa koowaad. Kadib labada qof midba mar ayuu dhaqaaqaa ilaa guul, barbaro, ama is dhiibid ay ciyaarta dhammeeyaan.",
          ],
          rules: [],
        },
      ],
      rules: [],
      callouts: [
        {
          variant: "xeer",
          body: "Dhigista iyo ka saarista bilowga waa laba marxaladood oo kala duwan. Xilliga dhigista dhagax lama saaro, xitaa marka jare la sameeyo.",
        },
      ],
      diagramGroups: [],
      summary: [],
      ctas: [],
    },
    {
      id: "dhaqdhaqaaqa",
      navLabel: "Dhaqdhaqaaq",
      heading: "Dhaqdhaqaaq sharci ah",
      paragraphs: [
        "Wareeggaaga waxaad dhaqaajinaysaa hal dhagax oo adiga kuu gaar ah. Dhagaxu wuxuu geli karaa oo keliya barta xigta ee bannaan ee khadku si toos ah ugu xiro barta uu joogo. Meesha loo socdo waa inay bannaan tahay.",
      ],
      subsections: [],
      rules: [
        "Lama boodi karo bar ama dhagax kale, lamana dhex mari karo dhagax.",
        "Looma dhaqaaqi karo dhinac janjeera ama bar aan khad ku xirnayn.",
        "Dhagax laguma dejin karo bar uu dhagax kale haysto.",
      ],
      callouts: [],
      diagramGroups: [
        {
          label: "Tusaalaha dhaqdhaqaaqa sharci ah iyo kan aan sharciga ahayn",
          columns: 2,
          frames: [
            {
              id: "legal-movement",
              title: "Barta xigta oo bannaan",
              caption:
                "Dhagaxa la doortay wuxuu geli karaa labada barood ee ku xiga; labada waddo ee la calaamadeeyay sharci ma aha.",
              description:
                "Laba fallaadh oo sax ah waxay raacaan khadadka gaagaaban ee ku xiga. Hal waddo waxay ka boodaysaa bar, waddada kalena ma laha khad toos ah oo isku xira bilowga iyo dhammaadka.",
            },
          ],
        },
      ],
      summary: [],
      ctas: [],
    },
    {
      id: "jare",
      navLabel: "Jare",
      heading: "Jare, qabasho, iyo soo noqnoqosho",
      paragraphs: [
        "Jare waa 3 dhagax oo hal ciyaaryahan leeyahay, kuna wada jira sadar toosan oo isku xiran. Looxu wuxuu leeyahay 16 sadar oo jare ah: 4 dhinac oo afar-geeska dibadda ah, 4 kan dhexe ah, 4 kan gudaha ah, iyo 4 khad oo bartamaha dhinacyada saddexda afar-gees isku xira. Khad janjeera ma tirinayo.",
        "Xilliga dhaqdhaqaaqa, qabasho waxaa la helaa oo keliya marka dhaqaaqu dhammaystiro ugu yaraan hal jare oo aan dhamaystirnayn ka hor dhaqaaqaas. Jare horay u taagnaa oo aan is beddelin qabasho kale ma bixiyo.",
      ],
      subsections: [
        {
          heading: "Hal dhaqaaq, hal qabasho",
          paragraphs: [
            "Jare cusub wuxuu kuu oggolaanayaa inaad qabato hal dhagax oo qofka kale leeyahay. Xitaa haddii hal dhaqaaq uu sameeyo dhowr jare, waxaa la helaa hal qabasho oo keliya. Waxaad qabsan kartaa dhagax kasta oo ka soo horjeeda, xitaa mid jare ku jira ama difaac muhiim ah haya. Markaad hal dhagax qabato, wareeggaagu wuu dhammaadaa.",
          ],
          rules: [],
        },
        {
          heading: "Jare soo noqnoqda",
          paragraphs: [
            "Si jare isku mid ah qabasho kale looga helo, waa inaad jebisaa adigoo hal dhagax ka saaraya sadarka. Kadib wareegga qofka kale, dhagaxaas dib ugu celi oo jare-ka dib u samee. Jebinta iyo dib u samaynta saxda ahi waxay abuuraan jare cusub iyo hal qabasho cusub.",
          ],
          rules: [],
        },
      ],
      rules: [],
      callouts: [
        {
          variant: "digniin",
          body: "Jare taagan lagama qabsan karo marar badan. Waa inuu furmaa, qofka kale wareeggiisa ciyaaraa, kadibna dib loo sameeyaa.",
        },
      ],
      diagramGroups: [
        {
          label: "Sida jare loo sameeyo, loo furo, dibna loogu sameeyo",
          columns: 3,
          frames: [
            {
              id: "jare-formed",
              title: "1. Jare cusub",
              caption:
                "Dhagaxa dhinaca midig ayaa xira sadarka; hal qabasho ayaa hadda la sugayaa.",
              description:
                "Saddex dhagax oo isku dhinac ah ayaa saf toosan noqday. Dhammaan dhagaxa qofka kale waxaa loo muujiyay inay yihiin doorashooyin qabasho oo bannaan.",
            },
            {
              id: "jare-opened",
              title: "2. Jare waa la furay",
              caption:
                "Dhagaxa dhexe ayaa ka baxay sadarka, bartiisiina way bannaanaatay.",
              description:
                "Sadarkii hadda wuu furan yahay. Barta muhiimka ah waa la calaamadeeyay, qofka kalena kama geli karo meelaha ku xeeran oo ay haystaan dhagaxa jare samaynaya.",
            },
            {
              id: "jare-reformed",
              title: "3. Jare waa soo noqday",
              caption:
                "Dhagaxii ayaa barta muhiimka ah ku soo laabtay; hal qabasho oo cusub ayaa la helay.",
              description:
                "Sadarkii toosnaa ayaa mar kale xirmay kadib markii labada qofba wareeg ciyaareen. Tani waa jare cusub, sidaas darteed qabasho kale ayaa sharci ah.",
            },
          ],
        },
      ],
      summary: [],
      ctas: [],
    },
    {
      id: "irmaan",
      navLabel: "Irmaan",
      heading: "Irmaan",
      paragraphs: [
        "Irmaan waa jare soo noqnoqda ama la ilaaliyay oo qofka ka soo horjeeda uusan xannibi karin. Ciyaaryahanku wuxuu jare-ka furaa, dabadeed wuxuu awoodaa inuu dib u sameeyo. Barta muhiimka ah ee lagu xirayo sadarka ma laha waddo bannaan oo qofka kale ku geli karo.",
        "Haddii qofka kale uu bartaas geli karo oo jare-ka joojin karo, xaaladdu irmaan dhab ah ma aha. Tusaalaha 3-da tallaabo ee kore, barta la calaamadeeyay waxaa ku wareegsan dhagaxa qofka jare samaynaya, sidaas darteed ka soo horjeedku ma qabsan karo meeshaas.",
      ],
      photo: {
        src: "/images/learn/irmaan-example.jpg",
        alt: "Loox shaxda oo dhab ah oo dhagaxyo iyo qoryo lagu muujiyay xaalad irmaan ah.",
        caption:
          "Tusaale loox dhab ah: qoryuhu waxay hayaan irmaan, waayo jare-ka way furi karaan dabadeedna dib ayay u samayn karaan.",
        width: 960,
        height: 1280,
      },
      subsections: [],
      rules: [],
      callouts: [
        {
          variant: "xeer",
          body: "Irmaan keligeed guul toos ah ma aha. Ciyaartu waxay dhammaanaysaa oo keliya marka xaalad guul, barbaro, ama is dhiibid dhacdo.",
        },
      ],
      diagramGroups: [],
      summary: [],
      ctas: [],
    },
    {
      id: "xannibaad",
      navLabel: "Xannibaad",
      heading: "Ciyaaryahan xanniban",
      paragraphs: [
        "Ciyaaryahan waa xanniban yahay marka uusan lahayn dhaqaaq sharci ah. Xannibaaddu guul ma aha. Qofka kale waa inuu sameeyaa dhaqaaq bannayn ah oo abuura ugu yaraan hal meel uu qofka xanniban u dhaqaaqi karo. Dhaqaaqa bannayntu ma samayn karo jare cusub, mana keeni karo qabasho.",
        "Haddii qofku weli xanniban yahay, qofka kale wuxuu sii samaynayaa dhaqaaqyo bannayn ah ilaa waddo sharci ahi furanto. Markaas qofkii xannibnaa ayaa dhaqaaqa, ciyaartuna si caadi ah ayay u sii socotaa.",
      ],
      subsections: [],
      rules: [],
      callouts: [
        {
          variant: "digniin",
          body: "Haddii labada qof wada xanniban yihiin, ciyaartu waa barbaro. Sidoo kale waa barbaro haddii dhaqaaqa keliya ee meel bannayn kara uu qasab ku samaynayo jare cusub.",
        },
      ],
      diagramGroups: [
        {
          label: "Sida meel loogu banneeyo ciyaaryahan xanniban",
          columns: 2,
          frames: [
            {
              id: "blocked-player",
              title: "1. Dhaqaaq ma jiro",
              caption:
                "Ciyaaryahanka xanniban ma hayo bar bannaan oo ku xigta; qofka kale ayaa bannaynaya.",
              description:
                "Dhagaxa qofka xanniban waxaa hareereeyay dhagaxa qofka kale. Fallaadha koowaad waxay muujinaysaa dhaqaaq aan jare samayn oo hal bar furaya.",
            },
            {
              id: "blocked-space-made",
              title: "2. Waddo ayaa furantay",
              caption:
                "Dhaqaaqa bannaynta kadib, ciyaaryahankii xannibnaa wuxuu helay bar ku xigta oo bannaan.",
              description:
                "Dhagaxii xannibnaa hadda wuxuu raaci karaa fallaadha labaad oo geli karaa barta la furay. Wareegga caadiga ahi halkaas ayuu ka sii socdaa.",
            },
          ],
        },
      ],
      summary: [],
      ctas: [],
    },
    {
      id: "dhammaadka",
      navLabel: "Dhammaad",
      heading: "Guul iyo barbaro",
      paragraphs: [
        "Ciyaaryahan wuu guuleystaa marka qofka ka soo horjeeda uu ka haro wax ka yar 3 dhagax, marka dhammaan dhagaxiisa la qabto, ama marka uu is dhiibo. Xannibaad keliya laguma guuleysto.",
      ],
      subsections: [
        {
          heading: "Afarta xaaladood ee barbaraha",
          paragraphs: [],
          rules: [
            "Labada ciyaaryahanba way xanniban yihiin.",
            "Dhaqaaqa keliya ee meel bannayn kara wuxuu samayn lahaa jare cusub.",
            "Isla booska dhaqdhaqaaqa ayaa 3 jeer soo noqda, iyadoo isla qofku dhaqaaqayo oo aan qabasho sugayn. Boosku wuxuu ka kooban yahay dhagaxa yaal baraha, qofka dhaqaaqaya, marxaladda, iyo qabasho sugaysa iyo in kale.",
            "80 wareeg oo dhaqdhaqaaq oo isku xiga ayaa dhammaada qabasho la'aan.",
          ],
        },
      ],
      rules: [
        "Boosaska dhigista iyo ka saarista bilowga laguma tiriyo soo noqnoqoshada.",
        "Tirinta 80-ka waxay bilaabataa marka dhaqdhaqaaqu bilowdo; wareeg aan qabasho lahayn ayaa kordhiya, qabashaduna eber ayay ku celisaa.",
      ],
      callouts: [],
      diagramGroups: [],
      summary: [],
      ctas: [],
    },
    {
      id: "talooyin",
      navLabel: "Talooyin",
      heading: "Talooyin bilow ah",
      paragraphs: [],
      subsections: [
        {
          heading: "Waxa fiican inaad eegto",
          paragraphs: [],
          rules: [
            "Inta dhigistu socoto, eeg jare aad samayn karto iyo jare qofka kale diyaarinayo.",
            "Ka saarista bilowga, waxaa fiican inaad doorato dhagax jare ama difaac muhiim ah haya.",
            "Ka hor dhaqaaq, eeg in meesha aad banaynayso ay qofka kale fursad siinayso.",
            "Haddii jare soo noqnoqda muuqdo, waxaa fiican inaad xannibto barta lagu soo celinayo.",
          ],
        },
        {
          heading: "Khaladaadka caanka ah",
          paragraphs: [],
          rules: [
            "Ha qabsan dhagax xilliga dhigista, hana ka boodin barood.",
            "Ha dalban qabasho kale jare aan la jebin, hana u qaadan xannibaad inay guul tahay.",
          ],
        },
      ],
      rules: [],
      callouts: [
        {
          variant: "talo",
          body: "Qaybtani waa talo lagu xoojiyo ciyaartaada; ma beddelayso xeerarka ku qoran qaybaha kore.",
        },
      ],
      diagramGroups: [],
      summary: [],
      ctas: [],
    },
    {
      id: "koobid",
      navLabel: "Koobid",
      heading: "Xeerarka oo kooban",
      paragraphs: [
        "Marka ugu horreysa, xasuuso 8-dan qodob. Faahfaahinta kore ayaa go'aamisa xaalad kasta oo adag.",
      ],
      subsections: [],
      rules: [],
      callouts: [],
      diagramGroups: [],
      summary: [
        {
          term: "Diyaari",
          detail: "2 ciyaaryahan, 12 dhagax qofkiiba, iyo loox 24 barood leh.",
        },
        {
          term: "Dhig",
          detail:
            "Midba mar hal dhagax dhig ilaa looxu buuxsamo; weli wax ha qaban.",
        },
        {
          term: "Horrayn",
          detail:
            "Jare-ka ugu horreeya ayaa hela; haddii uusan jirin, qofkii aan bilaabin ayaa hela.",
        },
        {
          term: "Ka saar",
          detail:
            "Midkiiba hal dhagax oo qofka kale ah ayuu si xor ah u saaraa.",
        },
        {
          term: "Dhaqaaq",
          detail: "Hal dhagax geli barta xigta ee khad ku xiran oo bannaan.",
        },
        {
          term: "Samee jare",
          detail:
            "Jare cusub oo dhaqdhaqaaq lagu sameeyo wuxuu bixiyaa hal qabasho.",
        },
        {
          term: "Ku celi",
          detail: "Jare jebso oo dib u samee si qabasho kale loo helo.",
        },
        {
          term: "Dhammee",
          detail: "Raac xaaladaha guusha, barbaraha, ama is dhiibidda.",
        },
      ],
      ctas: [
        {
          href: "/local",
          label: "Ku ciyaar qalabkan",
          tone: "emerald",
        },
        {
          href: "/online",
          label: "Samee ciyaar marti ah",
          tone: "sky",
        },
      ],
    },
  ],
} as const satisfies LearnPageContent;
