export const legalSectionIds = [
  "guudmar",
  "xogta",
  "kaydka-qalabka",
  "akoonka",
  "ciyaarta-martida",
  "cabbiraadda",
  "ilaalinta",
  "adeegyada",
  "carruurta",
  "xuquuqda",
  "shuruudaha",
  "isticmaal-fiican",
  "milkiyadda",
  "dammaanad",
  "isbeddel",
  "xiriirka",
] as const;

export type LegalSectionId = (typeof legalSectionIds)[number];

interface LegalDetail {
  term: string;
  detail: string;
}

interface LegalSection {
  id: LegalSectionId;
  heading: string;
  paragraphs: readonly string[];
  bullets: readonly string[];
  details: readonly LegalDetail[];
  notes: readonly string[];
}

export interface LegalPageContent {
  path: "/legal";
  title: string;
  description: string;
  hero: {
    eyebrow: string;
    heading: string;
    intro: string;
  };
  lastUpdatedLabel: string;
  lastUpdated: string;
  draftNotice: string;
  sections: readonly LegalSection[];
}

// TODO(translation-review): The account, D1, and online-seat copy added for
// V1.1-A/A2 (sections guudmar, xogta, kaydka-qalabka, akoonka,
// ciyaarta-martida, adeegyada, carruurta, xuquuqda, shuruudaha, and
// isticmaal-fiican) must be verified by a native/fluent Somali reviewer before
// release. It describes only what is live; it must not promise later features.
// TODO(translation-review): Verify the H1 and X1a storage and retention disclosures.
export const legalContentSo = {
  path: "/legal",
  title: "Sharciga iyo asturnaanta",
  description:
    "Akhri sida Shaxda u kaydiso una isticmaasho xogta, iyo shuruudaha lagu isticmaalo bogga, akoonka, iyo ciyaarta.",
  hero: {
    eyebrow: "Asturnaanta iyo shuruudaha isticmaalka",
    heading: "Sharciga iyo asturnaanta",
    intro:
      "Boggan wuxuu hal meel ku sharxayaa xogta Shaxda qabato, sababta loo qabto, muddada la hayo, iyo shuruudaha isticmaalka adeegga.",
  },
  lastUpdatedLabel: "Cusboonaysiin ugu dambeeyay",
  lastUpdated: "[TAARIIKHDA CUSBOONAYSIINTA]",
  draftNotice:
    "Qoraalkani weli waa qabyo. Waa in mulkiiluhu buuxiyo meelaha calaamadeysan, qof Soomaali si hufan u yaqaanna hubiyo luqadda, khabiir sharci ahna ansixiyo ka hor daahfurka.",
  sections: [
    {
      id: "guudmar",
      heading: "Waxa boggani daboolayo",
      paragraphs: [
        "Shaxda waa adeeg bilaash ah oo lagu barto laguna ciyaaro ciyaarta dhaqameed ee shaxda. [MAGACA MULKIILAHA] ayaa maamula bogga, akoonka Shaxda, iyo adeegga ciyaarta khadka.",
        "Qaybaha asturnaantu waxay sharxayaan xogta ku jirta qalabkaaga, xogta akoonka haddii aad Google ku gasho, xogta loo diro adeegga marka aad khadka ku ciyaarto, iyo adeegyada Cloudflare iyo Google ee boggu adeegsado. Qaybaha shuruuduhu waxay qeexayaan sida adeegga loo isticmaali karo.",
      ],
      bullets: [],
      details: [],
      notes: [
        "Ha u qaadan qoraalkan talo sharci. Xuquuqda aad sharciga ku leedahay waxay ku xirnaan kartaa meesha aad joogto.",
      ],
    },
    {
      id: "xogta",
      heading: "Xogta Shaxda isticmaasho",
      paragraphs: [
        "Akoonku waa ikhtiyaari. Waxaad ku ciyaari kartaa marti ahaan adigoon akoon samaysan: martidu waxay doorataa magac bandhig, qalabkuna wuxuu samaystaa aqoonsi marti oo aan kala sooc lahayn. Haddii aad Google ku gasho, waxaad yeelanaysaa akoon leh magac dadweyne oo joogto ah iyo bog dadweyne.",
        "Xogta akoonka waxaa lagu kaydiyaa Cloudflare D1, oo ah kayd xogeed. Marka ciyaar khadka ahi bilaabato oo dhammaato iyadoo labada ciyaaryahanba akoon ku galeen, Shaxda waxay kaydisaa natiijada, sababta ay ku dhammaatay, tirada dhagaxa iyo qabashooyinka, waqtiyada, tallaabooyinka ciyaarta, koodhka qolka, iyo aqoonsiga gudaha ee labada akoon. Magacyo laguma kaydiyo ciyaarta. Magaca dadweynaha iyo sawirka akoonka ee hadda ayaa la muujiyaa. Ciyaaraha uu marti ka qayb qaatay lama kaydiyo.",
        // TODO(translation-review)
        'Ciyaarta Saaxiibtinimada waxaa bogga ku arki kara labada ciyaaryahan oo keliya. Haddii labada ciyaaryahan oggolaadaan Tartan kahor bilowga, qof walba wuu arki karaa natiijada iyo magacyada dadweynaha ee ciyaarta. Ciyaaraha la kaydiyay way sii jiraan haddii akoon la tirtiro. Magaca akoonkaas waxaa lagu beddelaa "Xubin la tirtiray".',
        // TODO(translation-review)
        "Maamulka Shaxda wuxuu kaydin karaa qoraallo gudaha ah oo ku saabsan dib-u-eegista ciyaaraha Tartanka iyo akoonnada; qoraalladaas lama soo bandhigo.",
      ],
      bullets: [
        "Xogta qalabka: ciyaarta maxalliga ah, aqoonsiga martida, magaca bandhigga, dookha codka, iyo xusuusta diidmada rakibidda.",
        "Xogta akoonka: iimaylka Google ee la xaqiijiyay, aqoonsiga Google iyo xogta gelitaanka ee Google soo diro, magaca dadweynaha iyo magacyadii hore, dookha sawirka, iyo diiwaanka fadhiyada gelitaanka.",
        "Xogta qolka: aqoonsiyada martida ama akoonka, magacyada bandhigga ama magacyada dadweynaha, koodhka qolka, xaaladda ciyaarta, iyo waqtiyada hawsha.",
        "Xogta ilaalinta: cinwaanka IP-ga, waqtiyada isku dayga qol-samaynta, iyo calaamadaha biraawsarka ama qalabka ee Turnstile.",
        "Xogta tirakoobka: summad magac-beddel ah oo maalinle ah (90 maalmood) iyo tirooyin maalinle ah oo la isku geeyey.",
        "Xogta cabbirka: jidka bogga, halka booqashadu ka timid, waddanka, biraawsarka, nidaamka qalabka, iyo nooca qalabka.",
      ],
      details: [],
      notes: [],
    },
    {
      id: "kaydka-qalabka",
      heading: "Waxa ku kaydsan qalabkaaga",
      paragraphs: [
        "Shaxda waxay isticmaashaa localStorage si ay qalabkaaga ugu xafiddo ciyaarta maxalliga ah iyo dookhyo kooban. Nuqulladan qalabka ku jira si toos ah looguma raro kayd xogeed dhexe. Haddii aad Google ku gasho, biraawsarku wuxuu sidoo kale kaydiyaa cookie fadhi oo lagama maarmaan ah; qaybta akoonka ayaa sharxaysa.",
        "Service worker-ku wuxuu qalabka ku sii diyaariyaa faylasha bogga, sawirrada, codadka, iyo boggaga horay loo dhisay si ciyaarta maxalliga ahi u shaqayn karto marka khadku maqan yahay. Kaydkan waxaa laga saari karaa dejimaha biraawsarka ama marka barnaamijka laga tirtiro qalabka. Shaxda ma isticmaasho IndexedDB.",
      ],
      bullets: [],
      details: [
        {
          term: "shaxda:local-game:v1",
          detail:
            "Xaaladda ciyaarta maxalliga ah; waxay ku jirtaa qalabkaaga oo keliya.",
        },
        {
          term: "shaxda:guest-id:v1",
          detail:
            "Aqoonsi uu qalabku ku sameeyo crypto.randomUUID(); waxaa loo diraa server-ka marka aad qol marti ah gasho ama biraawsarku diro calaamadda firfircoonida.",
        },
        {
          term: "shaxda:analytics-active:v1",
          detail:
            "Taariikhda (UTC) ee biraawsarku ugu dambeysay u sheegay server-ka inuu firfircoon yahay, loo kala saaray marti iyo magaca dadweynaha akoon kasta. Waxaa la hayaa taariikhihii ugu dambeeyey ee maalinta la diiwaangeliyey.",
        },
        {
          term: "shaxda:guest-name:v1",
          detail:
            "Magaca bandhigga; wuxuu ku sii jiraa qalabkaaga, waxaana loo diraa server-ka marka aad qol marti ah gasho.",
        },
        {
          term: "shaxda:sound-enabled:v1",
          detail:
            "Dookha ah in codadka ciyaartu shidan yihiin ama dansan yihiin.",
        },
        {
          term: "shaxda:pwa-install-dismissed:v1",
          detail: "Xusuusta ah inaad hadda diidday soo-jeedinta rakibidda.",
        },
      ],
      notes: [],
    },
    {
      id: "akoonka",
      heading: "Akoonka Google iyo bogga dadweynaha",
      paragraphs: [
        "Marka aad Google ku gasho, Google wuxuu Shaxda u soo diraa aqoonsigaaga Google, iimaylkaaga la xaqiijiyay, magacaaga, xiriiriyaha sawirkaaga, iyo calaamadaha gelitaanka. Magacaaga Google looma isticmaalo magac ahaan, meelna lagama muujiyo Shaxda. Shaxda uma adeegsato gelitaanka Google inay adeegyada kale ee Google wax ka akhrido.",
        "Kadib waxaad doorataa magac dadweyne iyo sawirka bogga. Magaca dadweynaha iyo sawirka aad doorato ayaa ka muuqda bogga dadweynaha ee /u/<magaca> iyo qolalka ciyaarta khadka. Iimaylka, aqoonsiga Google, iyo aqoonsiga gudaha ee akoonku waa gaar; lama tuso ciyaartoyda kale ama booqdayaasha.",
      ],
      bullets: [],
      details: [
        {
          term: "Iimaylka Google",
          detail:
            "Waa gaar. Waxaa loo isticmaalaa in akoonka Google lagu xiro akoonka Shaxda, waxaadna ku aragtaa bogga akoonkaaga oo keliya.",
        },
        {
          term: "Magaca dadweynaha",
          detail:
            "Waa dadweyne. Waxaa la beddeli karaa 30 maalmood kasta. Magacyadii hore way xafidan yihiin oo qof kale ma qaadan karo, xiriiriyaha bogga ee magac hore wuxuu u gudbaa magacaaga hadda.",
        },
        {
          term: "Sawirka bogga",
          detail:
            "Caadi ahaan waa xarafka magacaaga. Xiriiriyaha sawirka Google waa la kaydiyaa, laakiin ma muuqdo ilaa aad doorato. Haddii aad doorato sawirka Google, biraawsarka booqdaha wuxuu sawirka ka codsanayaa Google.",
        },
        {
          term: "Fadhiga gelitaanka",
          detail:
            "Cookie lagama maarmaan ah ayaa biraawsarkaaga kugu haya adigoo galsan. D1 wuxuu kaydiyaa fadhiga, waqtiyadiisa, cinwaanka IP-ga, iyo macluumaadka biraawsarka (user agent) si akoonka loo ilaaliyo. Fadhigu wuxuu dhacaa 7 maalmood oo aan la isticmaalin kadib, ama marka aad akoonka ka baxdo.",
        },
        {
          term: "Habka gelitaanka Google",
          detail:
            "Inta gelitaanku socdo, cookie gaaban oo ugu badnaan 5 daqiiqo ah iyo diiwaan D1 ah oo ugu badnaan 10 daqiiqo ah ayaa hubiya in jawaabta Google ay adiga kuu socoto.",
        },
      ],
      notes: [
        'Waxaad tirtiridda ka codsan kartaa bogga akoonkaaga. Isla markiiba boggaaga dadweynaha waa la qariyaa, gelitaannada waa la xiraa, ciyaar akoon oo cusubna ma bilaabi kartid. Toddoba maalmood gudahood Google ku gal si aad uga noqoto codsiga. Markay muddadu dhammaato, xogta aqoonsiga waa la tirtiraa. Ciyaaraha la kaydiyay iyo darajooyinkooda way sii jiraan iyagoo ku tusaya "Xubin la tirtiray".',
        "Magacyada dadweynaha waxaa la hayaa 30 maalmood tirtiridda ka dib. Summadaha tirakoobka si caadi ah ayay u dhacaan 90 maalmood gudahood. Soo celinta kaydka xogtu dib uma soo celiso akoon la tirtiray.",
      ],
    },
    {
      id: "ciyaarta-martida",
      heading: "Xogta qolalka ciyaarta khadka",
      paragraphs: [
        "Marka aad samayso ama gasho qol marti ah, aqoonsiga martida iyo magaca bandhigga waxaa loo diraa Worker-ka Shaxda. Waxaa lagu hayaa Durable Object-ka qolka si labada ciyaaryahan loo kala garto, xaaladda ciyaartana loo waafajiyo.",
        "Haddii aad akoonkaaga ku ciyaarto, Worker-ka bogga wuxuu bixiyaa tigidh saxiixan oo 90 ilbiriqsi ah. Tigidhku wuxuu sidaa aqoonsiga gudaha ee akoonka, magaca dadweynaha, iyo sawirka la doortay. Qolku wuxuu aqoonsiga gudaha u hayaa si gaar ah si kursigu akoonkaaga ugu xirnaado; ciyaaryahanka kale wuxuu arkaa magaca dadweynaha iyo sawirka oo keliya. Iimaylka iyo cookie-ga gelitaanka looma diro Worker-ka ciyaarta.",
        "Xaaladda qolka waxaa ka mid ah boosaska ciyaartoyda, magacyada bandhigga, looxa, wareegga, iyo waqtiyada xiriirka. Server-ku wuxuu hubiyaa tallaabo kasta oo ciyaarta khadka ah. Qof haysta koodhka ama xiriiriyaha qolka ayaa isku dayi kara inuu qolka galo.",
      ],
      bullets: [],
      details: [
        {
          term: "Aqoonsiga martida",
          detail:
            "Waxaa lagu sameeyaa qalabkaaga, laakiin waxaa loo diraa server-ka oo qolka lagu hayaa inta fadhigu socdo.",
        },
        {
          term: "Xaaladda ciyaarta",
          detail:
            "Durable Object-ku wuxuu tirtiraa xaaladda qolka 60 daqiiqo oo firfircoonaan la'aan ah kadib. Haddii natiijo akoon weli sugayso in la kaydiyo, qolka waa la hayaa ilaa kaydintu guulaysato ama hawlwadeenku xalliyo.",
        },
      ],
      notes: [
        "La wadaag xiriiriyaha qolka qofka aad rabto inaad la ciyaarto oo keliya, hana u adeegsan magaca bandhigga xog gaar ah oo xasaasi ah.",
      ],
    },
    {
      id: "cabbiraadda",
      heading: "Tirakoobka isticmaalka",
      paragraphs: [
        "Shaxda waxay maalin kasta tirisaa inta biraawsar iyo akoon ee adeegga isticmaala. Maalintii hal mar, biraawsarkaagu wuxuu server-ka u diraa calaamad muujinaysa inuu firfircoon yahay.",
        "Server-ku wuxuu isticmaalaa aqoonsiga martida ee biraawsarka; haddii aad gashay akoonkaaga, wuxuu sidoo kale isticmaalaa aqoonsiga gudaha ee akoonka. Aqoon kasta wuxuu u beddelaa summad lagu sameeyey fure sir ah, kadibna wuxuu kaydiyaa summadda, taariikhda (UTC), iyo in ay tahay biraawsar ama akoon; labada summadood lama isku xiro. Aqoonsiga ceeriin, cinwaanka IP-ga, iyo magaca dadweynaha laguma kaydiyo tirakoobkan.",
        "Summaddu waa magac-beddel: ma muujiso magacaaga, laakiin maalin kasta way isku mid tahay, sidaas darteed maalmaha isticmaalka waa la isku xiri karaa. Safafka summadaha waxaa la tirtiraa 90 maalmood kadib; tirooyinka maalinlaha ah ee la isku geeyey waa la sii hayaa.",
        "Waxaa kale oo la tiriyaa ciyaaraha maxalliga ah ee la bilaabay iyo kuwa la dhammeeyey. Tirooyinkan maalinlaha ah aqoonsi ma xambaaraan, lamana diro marka qalabku khadka ka maqan yahay.",
        "Server-ka ciyaarta khadka wuxuu tiriyaa qolalka la sameeyey ama la galay iyo ciyaaraha la bilaabay ama la dhammeeyey. Wuxuu kaydiyaa tirooyin maalinle ah oo keliya, aqoonsi, koodh qol, ama magac la'aan.",
        "Haddii calaamadda PUBLIC_CF_BEACON_TOKEN la dejiyo, boggu wuxuu shidaa Cloudflare Web Analytics. Beacon-kan ma isticmaalo cookie ama localStorage, laakiin wuxuu diraa cabbirro la isku geeyey oo ku saabsan booqashada.",
        "Cabbirrada waxaa ka mid noqon kara jidka bogga, bogga ama goobta booqashada laga yimid, waddanka, biraawsarka, nidaamka qalabka, iyo haddii qalabku yahay kombiyuutar, moobil, ama tablet. Cloudflare waxay sheegaysaa inay xogta beacon-ka ee aan la yarayn hayso 7 maalmood, dabadeedna u soo koobto qiyaastii boqolkiiba 10; xogta la isku geeyey waxaa laga heli karaa 6dii bilood ee u dambeeyey.",
      ],
      bullets: [],
      details: [],
      notes: [
        "Web Analytics wuxuu shaqeeyaa oo keliya marka calaamaddiisa dadweynaha lagu daro dhismaha bogga.",
      ],
    },
    {
      id: "ilaalinta",
      heading: "Xaddidaadda codsiyada iyo Turnstile",
      paragraphs: [
        "Si loo yareeyo samaynta qolal badan iyo isticmaalka otomaatiga ah, isku-duwaha qolalku wuxuu kaydiyaa cinwaanka IP-ga oo aan la qarin iyo waqtiyada isku dayga. Hal IP wuxuu samayn karaa ugu badnaan 10 isku day 60 ilbiriqsi gudahood.",
        "Marka qol la samaynayo, cinwaanka IP-ga iyo jawaabta Turnstile waxaa loo diraa Cloudflare. Turnstile wuxuu sidoo kale ururiyaa calaamado biraawsar iyo qalab si uu u kala saaro qof iyo aalad otomaatig ah.",
      ],
      bullets: [],
      details: [
        {
          term: "Isku dayga qol-samaynta",
          detail:
            "Waqtiyada isku dayga ee IP kasta waxay ku jiraan daaqad wareegaysa oo 60 ilbiriqsi ah; ugu badnaan 10 ayaa la hayaa.",
        },
        {
          term: "Diiwaanka qolka firfircoon",
          detail:
            "Cinwaanka IP-ga ceeriin wuxuu caadi ahaan ku jiraa diiwaanka qolka ugu badnaan 70 daqiiqo laga bilaabo samaynta. Haddii natiijo akoon ay sugayso kaydin, diiwaanka waxaa la hayn karaa ilaa kaydintu guulaysato ama hawlwadeenku xalliyo.",
        },
        {
          term: "Xaaladda qolka ciyaarta",
          detail:
            "Muddada 60 daqiiqo ee xaaladda qolka waxay ka bilaabataa hawshii ugu dambeysay ee qolka. Qol leh natiijo sugaysa kaydin waa la sii hayaa.",
        },
      ],
      notes: [
        "Turnstile caadi ahaan wuxuu soo saaraa calaamad hal mar la isticmaalo. Haddii pre-clearance laga shido Cloudflare, wuxuu sidoo kale dhigi karaa cookie la yiraahdo cf_clearance; dejintaas weli waa in laga xaqiijiyaa dashboard-ka Cloudflare.",
      ],
    },
    {
      id: "adeegyada",
      heading: "Cloudflare iyo diiwaannada hawlgalka",
      paragraphs: [
        "Cloudflare waa adeeg bixiye martigeliya bogga oo socodsiiya Workers-ka, Durable Objects-ka, kaydka D1, Turnstile, iyo Web Analytics marka la shido. Sidaas darteed xogta codsiyada, qolalka, iyo akoonka waxay dhex martaa nidaamyada Cloudflare. Google wuxuu bixiyaa gelitaanka akoonka.",
        "Diiwaannada Workers-ka iyo la-socodka hawlgalka waa shidan yihiin. Diiwaannadani waxay ka koobnaan karaan macluumaad codsi, khaladaad, iyo xog farsamo oo lagu baaro cilladaha. Muddadu waxay ku xiran tahay qorshaha Cloudflare: 3 maalmood qorshaha bilaashka ah ama 7 maalmood qorshaha lacagta leh, sidaas darteed ugu badnaan toddobaad.",
      ],
      bullets: [
        "Cloudflare waxay xogta uga shaqayn kartaa dalal kala duwan iyadoo raacaysa heshiisyadeeda iyo sharciyada khuseeya.",
        "Shaxda ma iibiso xogta martida ama akoonka, mana isticmaasho xayeysiis, lacag bixin, taageero ganacsi, ama xiriir iib.",
        "Kaydka D1 wuxuu hayaa xogta akoonka, ciyaaraha la kaydiyay ee u dhexeeya laba akoon, summadaha tirakoobka (90 maalmood), iyo tirooyin maalinle ah. Aqoonsiga martida ee ceeriin laguma hayo.",
      ],
      details: [],
      notes: [],
    },
    {
      id: "carruurta",
      heading: "Carruurta iyo xogta gaarka ah",
      paragraphs: [
        "Shaxda waa ciyaar dhaqameed ay qoysasku wada ciyaari karaan, laakiin adeeggu si gaar ah uguma talagelin ururinta xogta carruurta. Ha gelin magaca bandhigga ama magaca dadweynaha magaca buuxa, cinwaan, dugsi, ama xog kale oo lagu garan karo ilmo.",
        "Haddii waalid ama masuul u maleeyo in ilmo soo diray xog gaar ah oo aan loo baahnayn, wuxuu kala xiriiri karaa [EMAIL XIRIIRKA]. Haddii xogtu ku jirto akoon, sheeg magaca dadweynaha ee akoonkaas. Ciyaarta martida akoon ma leh, sidaas darteed aqoonsashada codsigu waxay ku xirnaan kartaa xogta la heli karo iyo qolka weli jira.",
      ],
      bullets: [],
      details: [],
      notes: [],
    },
    {
      id: "xuquuqda",
      heading: "Doorashooyinkaaga iyo codsiyada xogta",
      paragraphs: [
        "Waxaad localStorage-ka iyo kaydka service worker-ka ka tirtiri kartaa dejimaha biraawsarka, ama waxaad ka saari kartaa barnaamijka la rakibay. Tani waxay tirtiri kartaa ciyaarta maxalliga ah, aqoonsiga martida, magaca bandhigga, iyo dookhyada ku jira qalabkaas.",
        "Xogta qolalka si otomaatig ah ayay u baaba'daa marka muddada firfircoonaan la'aantu dhammaato. Magaca dadweynaha iyo sawirka bogga waxaad ka beddeli kartaa bogga akoonkaaga. Halkaas ayaad sidoo kale ka codsan kartaa tirtiridda akoonka. Si aad u weydiisato helitaan, sixid ama xog dheeraad ah oo sharcigaagu kuu oggol yahay, la xiriir [EMAIL XIRIIRKA]. Ciyaarta martida akoon ma leh, sidaas darteed mararka qaar xog gaar ah laguma nisbayn karo adiga.",
      ],
      bullets: [],
      details: [],
      notes: [],
    },
    {
      id: "shuruudaha",
      heading: "Adeegga aad isticmaalayso",
      paragraphs: [
        "Markaad isticmaasho Shaxda, waxaad oggolaanaysaa shuruudahan inta sharcigu oggol yahay. Haddii aadan oggolayn, ha isticmaalin ciyaarta, akoonka, ama qaybaha kale ee adeegga.",
        "Adeeggu wuxuu bixiyaa bog waxbarasho, ciyaar laba qof oo hal qalab ah, qolal khadka ah oo laba qof ku ciyaaraan, iyo akoon ikhtiyaari ah oo Google lagu galo oo leh magac dadweyne iyo bog dadweyne. Ciyaaraha martida ma kaydiyo, mana bixiyo ballanqaad ah in qol ama ciyaar aan dhammaan dib loo soo celin karo.",
      ],
      bullets: [],
      details: [],
      notes: [],
    },
    {
      id: "isticmaal-fiican",
      heading: "Ciyaar caddaalad ah iyo ilaalinta adeegga",
      paragraphs: [
        "Isticmaal Shaxda si sharci ah, si caddaalad ah, oo ixtiraam leh. Adiga ayaa masuul ka ah magaca bandhigga ama magaca dadweynaha aad doorato, sawirka bogga aad doorato, iyo cidda aad la wadaagto xiriiriyaha qolka.",
      ],
      bullets: [
        "Ha dooran magac bandhig ama magac dadweyne oo aflagaado, handadaad, nacayb, ama qof kale iska dhigaya.",
        "Ha isku dayin inaad hareer marto Turnstile, xaddidaadaha codsiga, ama hubinta tallaabooyinka ciyaarta.",
        "Ha carqaladayn adeegga, ha gelin koodh waxyeello leh, hana isku dayin inaad gasho qol ama nidaam aadan fasax u haysan.",
        "Ha u isticmaalin adeegga fal sharci-darro ah ama waxyeello u geysanaya qof kale.",
      ],
      details: [],
      notes: [
        "Helitaanka adeegga waa la xaddidi karaa ama waa laga joojin karaa codsi, qalab, ama akoon si xun u isticmaala ama khatar geliya adeegga.",
      ],
    },
    {
      id: "milkiyadda",
      heading: "Dhaqanka, koodhka, iyo astaamaha",
      paragraphs: [
        "Shaxda iyo xeerarkeeda dhaqameed waa dhaxal dhaqameed Soomaaliyeed; boggani ma sheeganayo inuu leeyahay ciyaarta dhaqanka lafteeda. Sharaxaadda, koodhka, naqshadda, sawirrada, codadka, iyo astaamaha mashruuca waxaa laga yaabaa inay leeyihiin xuquuq gaar ah.",
        "Ruqsadda hadda lagu isticmaali karo astaamaha iyo hantida mashruuca waa [RUQSADDA ASTAAMAHA]. Ilaa taas la caddeeyo, ha nuqulan hana qaybin hantida mashruuca adigoon fasax helin, marka laga reebo waxa sharcigu si cad kuu oggol yahay.",
      ],
      bullets: [],
      details: [],
      notes: [],
    },
    {
      id: "dammaanad",
      heading: "Helitaanka iyo xaddidaadda masuuliyadda",
      paragraphs: [
        "Shaxda waxaa lagu bixiyaa sida ay hadda tahay iyo inta la heli karo. Lama ballanqaadayo in adeeggu mar walba shaqaynayo, khalad la'aan yahay, amnigiisu dhammaystiran yahay, ama xogta qolka dib loo soo celin karo.",
        "Inta sharcigu oggol yahay, [MAGACA MULKIILAHA] masuul kama aha khasaaro dadban, xog lunta, ciyaar go'da, ama waxyeello ka dhalata isticmaalka ama awood la'aanta isticmaalka adeegga. Qodobkani ma xaddidayo masuuliyad aanu sharcigu oggolayn in la xaddido.",
      ],
      bullets: [],
      details: [],
      notes: [],
    },
    {
      id: "isbeddel",
      heading: "Isbeddellada boggan iyo adeegga",
      paragraphs: [
        "Boggan waa la cusboonaysiin karaa marka adeeggu is beddelo, adeeg bixiye cusub la isticmaalo, ama sharci khuseeya is beddelo. Taariikhda kore ayaa la beddeli doonaa marka nuqul cusub la daabaco.",
        "Haddii isbeddelku muhiim yahay, ogeysiis muuqda ayaa lagu dari karaa bogga. Sii wadidda isticmaalka kadib isbeddelku waxay ku xirnaan doontaa waxa sharciga khuseeya oggol yahay.",
      ],
      bullets: [],
      details: [],
      notes: [],
    },
    {
      id: "xiriirka",
      heading: "Cidda lala xiriirayo iyo sharciga khuseeya",
      paragraphs: [
        "Mulkiilaha ama maamulaha adeegga: [MAGACA MULKIILAHA]. Su'aalaha asturnaanta, codsiyada xogta, ama arrimaha shuruudahan u dir [EMAIL XIRIIRKA].",
        "Shuruudahan waxaa lagu fasirayaa sharciga [WADDANKA SHARCIGA], iyadoo aan meesha laga saarayn xuquuq kasta oo khasab ah oo sharciga meesha aad joogto ku siinayo.",
      ],
      bullets: [],
      details: [],
      notes: [
        "Magaca mulkiilaha, email-ka xiriirka, waddanka sharciga, taariikhda cusboonaysiinta, iyo ruqsadda astaamaha waa in la buuxiyaa ka hor daahfurka.",
      ],
    },
  ],
} as const satisfies LegalPageContent;
