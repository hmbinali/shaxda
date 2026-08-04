export const legalSectionIds = [
  "guudmar",
  "xogta",
  "kaydka-qalabka",
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

export const legalContentSo = {
  path: "/legal",
  title: "Sharciga iyo asturnaanta",
  description:
    "Akhri sida Shaxda u kaydiso una isticmaasho xogta, iyo shuruudaha lagu isticmaalo bogga iyo ciyaarta martida.",
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
        "Shaxda waa adeeg bilaash ah oo lagu barto laguna ciyaaro ciyaarta dhaqameed ee shaxda. [MAGACA MULKIILAHA] ayaa maamula bogga iyo adeegga ciyaarta martida.",
        "Qaybaha asturnaantu waxay sharxayaan xogta ku jirta qalabkaaga, xogta loo diro adeegga marka aad khadka ku ciyaarto, iyo adeegyada Cloudflare ee boggu adeegsado. Qaybaha shuruuduhu waxay qeexayaan sida adeegga loo isticmaali karo.",
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
        "Shaxda ma laha akoon, galitaan Google, magac joogto ah, taariikh ciyaareed joogto ah, ama miis darajo. Martidu waxay doorataa magac bandhig, qalabkuna wuxuu samaystaa aqoonsi marti oo aan kala sooc lahayn.",
        "Ma jiro kayd D1 ah oo ku xiran adeegga. Ciyaaraha martida wax joogto ah laguma qoro kayd xogeed marka ay dhammaadaan.",
      ],
      bullets: [
        "Xogta qalabka: ciyaarta maxalliga ah, aqoonsiga martida, magaca bandhigga, dookha codka, iyo xusuusta diidmada rakibidda.",
        "Xogta qolka: aqoonsiyada martida, magacyada bandhigga, koodhka qolka, xaaladda ciyaarta, iyo waqtiyada hawsha.",
        "Xogta ilaalinta: cinwaanka IP-ga, waqtiyada isku dayga qol-samaynta, iyo calaamadaha biraawsarka ama qalabka ee Turnstile.",
        "Xogta cabbirka: jidka bogga, halka booqashadu ka timid, waddanka, biraawsarka, nidaamka qalabka, iyo nooca qalabka.",
      ],
      details: [],
      notes: [],
    },
    {
      id: "kaydka-qalabka",
      heading: "Waxa ku kaydsan qalabkaaga",
      paragraphs: [
        "Shaxda waxay isticmaashaa localStorage si ay qalabkaaga ugu xafiddo ciyaarta maxalliga ah iyo dookhyo kooban. Nuqulladan qalabka ku jira si toos ah looguma raro kayd xogeed dhexe.",
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
            "Aqoonsi uu qalabku ku sameeyo crypto.randomUUID(); waxaa loo diraa server-ka marka aad qol marti ah gasho.",
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
      id: "ciyaarta-martida",
      heading: "Xogta qolka ciyaarta martida",
      paragraphs: [
        "Marka aad samayso ama gasho qol marti ah, aqoonsiga martida iyo magaca bandhigga waxaa loo diraa Worker-ka Shaxda. Waxaa lagu hayaa Durable Object-ka qolka si labada ciyaaryahan loo kala garto, xaaladda ciyaartana loo waafajiyo.",
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
            "Durable Object-ku wuxuu tirtiraa dhammaan xaaladda qolka 60 daqiiqo oo firfircoonaan la'aan ah kadib.",
        },
      ],
      notes: [
        "La wadaag xiriiriyaha qolka qofka aad rabto inaad la ciyaarto oo keliya, hana u adeegsan magaca bandhigga xog gaar ah oo xasaasi ah.",
      ],
    },
    {
      id: "cabbiraadda",
      heading: "Cloudflare Web Analytics",
      paragraphs: [
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
            "Cinwaanka IP-ga ceeriin wuxuu ku jiri karaa diiwaanka qolka ilaa 70 daqiiqo laga bilaabo samaynta, dabadeed alarm ayaa ka saara.",
        },
        {
          term: "Xaaladda qolka ciyaarta",
          detail:
            "Tani waa muddo kale: qolka waxaa la tirtiraa 60 daqiiqo oo firfircoonaan la'aan ah kadib, ee ma aha 60 daqiiqo laga bilaabo samaynta.",
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
        "Cloudflare waa adeeg bixiye martigeliya bogga oo socodsiiya Workers-ka, Durable Objects-ka, Turnstile, iyo Web Analytics marka la shido. Sidaas darteed xogta codsiyada iyo qolalka waxay dhex martaa nidaamyada Cloudflare.",
        "Diiwaannada Workers-ka iyo la-socodka hawlgalka waa shidan yihiin. Diiwaannadani waxay ka koobnaan karaan macluumaad codsi, khaladaad, iyo xog farsamo oo lagu baaro cilladaha. Muddadu waxay ku xiran tahay qorshaha Cloudflare: 3 maalmood qorshaha bilaashka ah ama 7 maalmood qorshaha lacagta leh, sidaas darteed ugu badnaan toddobaad.",
      ],
      bullets: [
        "Cloudflare waxay xogta uga shaqayn kartaa dalal kala duwan iyadoo raacaysa heshiisyadeeda iyo sharciyada khuseeya.",
        "Shaxda ma iibiso xogta martida, mana isticmaasho xayeysiis, lacag bixin, taageero ganacsi, ama xiriir iib.",
        "Adeegga hadda kuma xirna kayd D1 ah oo ciyaaraha ama xogta martida lagu sii hayo.",
      ],
      details: [],
      notes: [],
    },
    {
      id: "carruurta",
      heading: "Carruurta iyo xogta gaarka ah",
      paragraphs: [
        "Shaxda waa ciyaar dhaqameed ay qoysasku wada ciyaari karaan, laakiin adeeggu si gaar ah uguma talagelin ururinta xogta carruurta. Ha gelin magaca bandhigga magaca buuxa, cinwaan, dugsi, ama xog kale oo lagu garan karo ilmo.",
        "Haddii waalid ama masuul u maleeyo in ilmo soo diray xog gaar ah oo aan loo baahnayn, wuxuu kala xiriiri karaa [EMAIL XIRIIRKA]. Maadaama uusan jirin akoon, aqoonsashada codsiga waxay ku xirnaan kartaa xogta la heli karo iyo qolka weli jira.",
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
        "Xogta qolka martida si otomaatig ah ayay u baaba'daa marka muddada firfircoonaan la'aantu dhammaato. Si aad u weydiisato helitaan, sixid, tirtirid, ama xog dheeraad ah oo sharcigaagu kuu oggol yahay, la xiriir [EMAIL XIRIIRKA]. Aqoonsi la'aanta adeegga waxay mararka qaar ka dhigi kartaa in xog gaar ah aan laguu nisbayn karin.",
      ],
      bullets: [],
      details: [],
      notes: [],
    },
    {
      id: "shuruudaha",
      heading: "Adeegga aad isticmaalayso",
      paragraphs: [
        "Markaad isticmaasho Shaxda, waxaad oggolaanaysaa shuruudahan inta sharcigu oggol yahay. Haddii aadan oggolayn, ha isticmaalin ciyaarta martida ama qaybaha kale ee adeegga.",
        "Adeeggu wuxuu bixiyaa bog waxbarasho, ciyaar laba qof oo hal qalab ah, iyo qolal marti oo laba qof ku ciyaaraan. Ma bixiyo kayd joogto ah oo natiijooyinka ah, dib-u-ciyaar, ama ballanqaad ah in qol ama ciyaar dib loo soo celin karo.",
      ],
      bullets: [],
      details: [],
      notes: [],
    },
    {
      id: "isticmaal-fiican",
      heading: "Ciyaar caddaalad ah iyo ilaalinta adeegga",
      paragraphs: [
        "Isticmaal Shaxda si sharci ah, si caddaalad ah, oo ixtiraam leh. Adiga ayaa masuul ka ah magaca bandhigga aad doorato iyo cidda aad la wadaagto xiriiriyaha qolka.",
      ],
      bullets: [
        "Ha dooran magac aflagaado, handadaad, nacayb, ama qof kale iska dhigaya.",
        "Ha isku dayin inaad hareer marto Turnstile, xaddidaadaha codsiga, ama hubinta tallaabooyinka ciyaarta.",
        "Ha carqaladayn adeegga, ha gelin koodh waxyeello leh, hana isku dayin inaad gasho qol ama nidaam aadan fasax u haysan.",
        "Ha u isticmaalin adeegga fal sharci-darro ah ama waxyeello u geysanaya qof kale.",
      ],
      details: [],
      notes: [
        "Helitaanka adeegga waa la xaddidi karaa ama waa laga joojin karaa codsi ama qalab si xun u isticmaala ama khatar geliya adeegga.",
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
