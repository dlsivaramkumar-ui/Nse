/**
 * Database of Known Unlisted Tech Companies, Pre-IPO Unicorns, and Special Equities.
 * Provides comprehensive market status reports, SEBI DRHP filing details,
 * Telugu explanations, and related listed NSE peers.
 */

export interface UnlistedCompany {
  id: string;
  name: string;
  nameTe: string;
  brandName: string;
  legalEntityName: string;
  category: 'UNLISTED_PRIVATE' | 'PRE_IPO' | 'DRHP_FILED';
  categoryLabelTe: string;
  categoryLabelEn: string;
  aliases: string[]; // Search keywords in English & Telugu
  statusSummaryTe: string;
  statusSummaryEn: string;
  detailedReportTe: string;
  detailedReportEn: string;
  sebiIpoStatus: string;
  relatedListedPeers: {
    symbol: string;
    name: string;
    nameTe?: string;
    sector: string;
    reasonTe: string;
  }[];
}

export const KNOWN_UNLISTED_COMPANIES: UnlistedCompany[] = [
  {
    id: 'PINELABS',
    name: 'Pine Labs',
    nameTe: 'పైన్ ల్యాబ్స్ (Pine Labs)',
    brandName: 'Pine Labs',
    legalEntityName: 'Pine Labs Limited',
    category: 'PRE_IPO',
    categoryLabelTe: 'ప్రీ-ఐపీవో / డొమిసైల్ రివర్స్-ఫ్లిప్ దశ (Pre-IPO Stage)',
    categoryLabelEn: 'Pre-IPO Tech Unicorn (Singapore to India Reverse Flip)',
    aliases: ['pinelabs', 'pine labs', 'పైన్ ల్యాబ్స్', 'పైన్‌ల్యాబ్స్'],
    statusSummaryTe:
      'Pine Labs మర్చంట్ కామర్స్ మరియు పాయింట్-ఆఫ్-సేల్ (PoS) ఫిన్‌టెక్ దిగ్గజం. ఇది భారతీయ ఎక్స్ఛేంజీలలో IPO కోసం సన్నాహాలు చేసుకుంటోంది.',
    statusSummaryEn:
      'Pine Labs is an omnichannel merchant commerce and payments leader preparing for a domestic Indian IPO.',
    detailedReportTe:
      'Pine Labs వ్యాపారులకు PoS యంత్రాలు, గిఫ్ట్ కార్డులు మరియు క్రెడిట్ సేవలను అందిస్తోంది. ఈ కంపెనీ సింగపూర్ నుండి భారత్‌కు రివర్స్-ఫ్లిప్ పూర్తి చేసుకుని స్థానిక IPO కోసం సిద్ధమవుతోంది. అన్‌లిస్టెడ్ మార్కెట్‌లో దీని షేర్లు ట్రేడ్ అవుతున్నప్పటికీ, NSE మెయిన్‌బోర్డులో పబ్లిక్ ట్రేడింగ్ త్వరలో ప్రారంభం కానుంది.',
    detailedReportEn:
      'Pine Labs is actively preparing for an Indian mainboard listing following its corporate restructuring.',
    sebiIpoStatus: 'ప్రీ-ఐపీవో కార్పొరేట్ రీస్ట్రక్చరింగ్ దశ (Upcoming IPO)',
    relatedListedPeers: [
      {
        symbol: 'PAYTM',
        name: 'One97 Communications Limited',
        nameTe: 'పేటీఎం',
        sector: 'మర్చంట్ పేమెంట్స్ & సౌండ్‌బాక్స్',
        reasonTe: 'PoS డివైజెస్ మరియు మర్చంట్ పేమెంట్లలో Pine Labs కు అత్యంత సమీప పోటీదారు.',
      },
      {
        symbol: 'MOBIKWIK',
        name: 'One MobiKwik Systems Limited',
        nameTe: 'మోబిక్విక్',
        sector: 'డిజిటల్ పేమెంట్స్ & వాలెట్',
        reasonTe: 'భారతీయ ఫిన్‌టెక్ మరియు డిజిటల్ క్రెడిట్ రంగంలో లిస్టెడ్ సంస్థ.',
      },
      {
        symbol: 'INFIBEAM',
        name: 'Infibeam Avenues Limited',
        nameTe: 'ఇన్ఫిబీమ్',
        sector: 'డిజిటల్ పేమెంట్ గేట్‌వే',
        reasonTe: 'డిజిటల్ లావాదేవీల రంగంలో యాక్టివ్ NSE ఈక్విటీ.',
      },
    ],
  },
  {
    id: 'ZEPTO',
    name: 'Zepto',
    nameTe: 'జెప్టో (Zepto Quick Commerce)',
    brandName: 'Zepto',
    legalEntityName: 'Kiranakart Technologies Private Limited',
    category: 'UNLISTED_PRIVATE',
    categoryLabelTe: 'అన్‌లిస్టెడ్ ప్రైవేట్ క్విక్-కామర్స్ స్టార్టప్',
    categoryLabelEn: 'Unlisted Private Quick-Commerce Unicorn',
    aliases: ['zepto', 'జెప్టో', 'kiranakart'],
    statusSummaryTe:
      'Zepto 10-నిమిషాల క్విక్ కామర్స్ డెలివరీ రంగంలో ప్రైవేట్ స్టార్టప్. ఇది ఇంకా NSE లేదా BSE లో లిస్ట్ కాలేదు.',
    statusSummaryEn:
      'Zepto is a private quick-commerce unicorn operating dark stores in India, not yet listed on NSE.',
    detailedReportTe:
      'Zepto (కిరణాకార్ట్ టెక్నాలజీస్) ప్రైవేట్ వెంచర్ క్యాపిటల్ ద్వారా నిధులు సమీకరించిన స్టార్టప్. ఈ రంగంలో పోటీపడుతున్న ఇతర లిస్టెడ్ స్టాక్స్ (Zomato/Blinkit, Swiggy) ను మన స్కానర్‌లో వెంటనే విశ్లేషించవచ్చు.',
    detailedReportEn:
      'Zepto is a private startup. For listed exposure to the Indian quick-commerce sector, analyze Eternal (Zomato/Blinkit) or Swiggy.',
    sebiIpoStatus: 'అన్‌లిస్టెడ్ ప్రైవేట్ స్టార్టప్ (Future IPO Roadmap)',
    relatedListedPeers: [
      {
        symbol: 'ETERNAL',
        name: 'Eternal Limited (Blinkit / Zomato)',
        nameTe: 'ఎటర్నల్ లిమిటెడ్',
        sector: 'క్విక్ కామర్స్ & ఫుడ్ డెలివరీ',
        reasonTe: 'Blinkit ద్వారా క్విక్ కామర్స్ మార్కెట్ లీడర్‌గా ఉన్న NSE లిస్టెడ్ దిగ్గజం.',
      },
      {
        symbol: 'SWIGGY',
        name: 'Swiggy Limited (Instamart)',
        nameTe: 'స్విగ్గీ లిమిటెడ్',
        sector: 'క్విక్ కామర్స్ & ఫుడ్ డెలివరీ',
        reasonTe: 'ఇన్‌స్టామార్ట్ నిర్వహిస్తున్న ప్రముఖ లిస్టెడ్ క్విక్ కామర్స్ ప్లాట్‌ఫారమ్.',
      },
    ],
  },
  {
    id: 'FLIPKART',
    name: 'Flipkart',
    nameTe: 'ఫ్లిప్‌కార్ట్ (Flipkart / Walmart)',
    brandName: 'Flipkart',
    legalEntityName: 'Flipkart Private Limited (Walmart Inc. Subsidiary)',
    category: 'UNLISTED_PRIVATE',
    categoryLabelTe: 'అన్‌లిస్టెడ్ ప్రైవేట్ ఇ-కామర్స్ కంపెనీ',
    categoryLabelEn: 'Unlisted Private E-Commerce Leader',
    aliases: ['flipkart', 'ఫ్లిప్‌కార్ట్', 'ఫ్లిప్ కార్ట్'],
    statusSummaryTe:
      'Flipkart వాల్‌మార్ట్ (Walmart) గ్రూప్‌కు చెందిన ప్రైవేట్ ఇ-కామర్స్ దిగ్గజం. భారతీయ ఎక్స్ఛేంజీలలో ఇంకా లిస్ట్ కాలేదు.',
    statusSummaryEn:
      'Flipkart is a private Walmart subsidiary and has not listed on Indian bourses.',
    detailedReportTe:
      'Flipkart భారతదేశంలో అతిపెద్ద ఇ-కామర్స్ మార్కెట్‌ప్లేస్‌లలో ఒకటి. ఇది సింగపూర్ పేరెంట్ కంపెనీ కింద వాల్‌మార్ట్ ఆధ్వర్యంలో నడుస్తోంది.',
    detailedReportEn:
      'Flipkart remains an unlisted entity owned primarily by Walmart Inc.',
    sebiIpoStatus: 'అన్‌లిస్టెడ్ ప్రైవేట్ కంపెనీ',
    relatedListedPeers: [
      {
        symbol: 'NYKAA',
        name: 'FSN E-Commerce Ventures (Nykaa)',
        nameTe: 'నైకా',
        sector: 'స్పెషాలిటీ ఇ-కామర్స్',
        reasonTe: 'భారతదేశంలో బ్యూటీ & ఫ్యాషన్ ఇ-కామర్స్ రంగంలో లిస్టెడ్ కంపెనీ.',
      },
      {
        symbol: 'TRENT',
        name: 'Trent Limited (Tata Group)',
        nameTe: 'ట్రెంట్ లిమిటెడ్',
        sector: 'రీటైల్ & ఫ్యాషన్',
        reasonTe: 'భారతీయ రీటైల్ మరియు ఆమ్నీ-ఛానల్ ఫ్యాషన్‌లో అగ్రగామి.',
      },
    ],
  },
  {
    id: 'PHONEPE',
    name: 'PhonePe',
    nameTe: 'ఫోన్‌పే (PhonePe Limited)',
    brandName: 'PhonePe',
    legalEntityName: 'PhonePe Private Limited (Walmart Group)',
    category: 'PRE_IPO',
    categoryLabelTe: 'ప్రీ-ఐపీవో UPI పేమెంట్స్ లీడర్ (NSE లో లిస్ట్ కాలేదు)',
    categoryLabelEn: 'Pre-IPO Payments Giant (Unlisted Entity)',
    aliases: ['phonepe', 'ఫోన్‌పే', 'ఫోన్ పే', 'ఫోన్పే'],
    statusSummaryTe:
      'PhonePe భారతదేశంలో నంబర్ 1 UPI డిజిటల్ పేమెంట్స్ ప్లాట్‌ఫారమ్. ఇది ఇంకా స్టాక్ ఎక్స్ఛేంజీలలో లిస్ట్ కాలేదు.',
    statusSummaryEn:
      'PhonePe is India’s largest UPI payments ecosystem, operating as an unlisted private firm.',
    detailedReportTe:
      'PhonePe భారతదేశంలో అత్యధిక UPI మార్కెట్ షేర్ కలిగి ఉన్న సంస్థ. తన IPO సన్నాహకాల్లో భాగంగా డొమిసైల్‌ను భారత్‌కు మార్చింది.',
    detailedReportEn:
      'PhonePe has completed its reverse flip to India in preparation for a future public listing.',
    sebiIpoStatus: 'ప్రీ-ఐపీవో దశ (Future IPO)',
    relatedListedPeers: [
      {
        symbol: 'PAYTM',
        name: 'One97 Communications Limited',
        nameTe: 'పేటీఎం',
        sector: 'డిజిటల్ పేమెంట్స్ & వాలెట్',
        reasonTe: 'భారతదేశంలో UPI మరియు మర్చంట్ పేమెంట్లలో లిస్టెడ్ మార్కెట్ ప్లేయర్.',
      },
      {
        symbol: 'MOBIKWIK',
        name: 'One MobiKwik Systems Limited',
        nameTe: 'మోబిక్విక్',
        sector: 'డిజిటల్ పేమెంట్స్ & క్రెడిట్',
        reasonTe: 'డిజిటల్ వాలెట్ మరియు BNPL రంగంలో NSE లిస్టెడ్ కంపెనీ.',
      },
    ],
  },
  {
    id: 'RAZORPAY',
    name: 'Razorpay',
    nameTe: 'రేజర్‌పే (Razorpay Software)',
    brandName: 'Razorpay',
    legalEntityName: 'Razorpay Software Private Limited',
    category: 'PRE_IPO',
    categoryLabelTe: 'ప్రీ-ఐపీవో పేమెంట్ గేట్‌వే యునికార్న్',
    categoryLabelEn: 'Pre-IPO Payment Gateway Unicorn',
    aliases: ['razorpay', 'రేజర్‌పే', 'రేజర్ పే', 'razor pay'],
    statusSummaryTe:
      'Razorpay భారతదేశపు ప్రముఖ డిజిటల్ పేమెంట్ గేట్‌వే మరియు నియో-బ్యాంకింగ్ స్టార్టప్. ఇంకా NSE లో లిస్ట్ కాలేదు.',
    statusSummaryEn:
      'Razorpay is India’s premier B2B payment gateway and business banking unicorn preparing for domestic listing.',
    detailedReportTe:
      'Razorpay ఆన్‌లైన్ పేమెంట్ కలెక్షన్స్, పేరోల్ మరియు కార్పొరేట్ క్రెడిట్ కార్డ్స్ అందిస్తుంది. కంపెనీ తన డొమిసైల్‌ను అమెరికా నుండి భారత్‌కు మార్చుకుని రాబోయే IPO కోసం సిద్ధమవుతోంది.',
    detailedReportEn:
      'Razorpay is actively executing its reverse-flip to India in preparation for a public market IPO on NSE.',
    sebiIpoStatus: 'ప్రీ-ఐపీవో రివర్స్-ఫ్లిప్ దశ (Upcoming IPO)',
    relatedListedPeers: [
      {
        symbol: 'INFIBEAM',
        name: 'Infibeam Avenues (CCAvenue)',
        nameTe: 'ఇన్ఫిబీమ్ అవెన్యూస్',
        sector: 'పేమెంట్ గేట్‌వే',
        reasonTe: 'భారతదేశంలో లిస్టెడ్ పేమెంట్ గేట్‌వే దిగ్గజం.',
      },
      {
        symbol: 'PAYTM',
        name: 'One97 Communications Limited',
        nameTe: 'పేటీఎం',
        sector: 'పేమెంట్ అగ్రిగేటర్',
        reasonTe: 'మర్చంట్ పేమెంట్ గేట్‌వే సేవలలో ప్రత్యక్ష పోటీదారు.',
      },
    ],
  },
  {
    id: 'LENSKART',
    name: 'Lenskart',
    nameTe: 'లెన్స్‌కార్ట్ (Lenskart Solutions)',
    brandName: 'Lenskart',
    legalEntityName: 'Lenskart Solutions Limited',
    category: 'PRE_IPO',
    categoryLabelTe: 'ప్రీ-ఐపీవో ఆమ్నీఛానల్ ఐవేర్ బ్రాండ్',
    categoryLabelEn: 'Pre-IPO Omnichannel Eyewear Unicorn',
    aliases: ['lenskart', 'లెన్స్‌కార్ట్', 'లెన్స్ కార్ట్', 'లెన్స్కార్ట్'],
    statusSummaryTe:
      'Lenskart భారతదేశపు అతిపెద్ద ఆమ్నీఛానల్ ఐవేర్ మరియు ఆప్టికల్ బ్రాండ్. IPO సన్నాహక దశలో ఉంది.',
    statusSummaryEn:
      'Lenskart is India’s leading eyewear tech unicorn actively preparing for its public market IPO.',
    detailedReportTe:
      'Lenskart భారతదేశం మరియు విదేశాలలో వేలాది రిటైల్ స్టోర్లతో పాటు ఆన్‌లైన్ ప్లాట్‌ఫారమ్‌ను నిర్వహిస్తోంది. కంపెనీ తన పబ్లిక్ ఇష్యూ కోసం ఇన్వెస్ట్‌మెంట్ బ్యాంకర్లతో సన్నాహాలు చేస్తోంది.',
    detailedReportEn:
      'Lenskart operates a massive optical retail network across India, Southeast Asia, and the Middle East, gearing for an IPO.',
    sebiIpoStatus: 'ప్రీ-ఐపీవో ఫైలింగ్ సన్నాహాలు',
    relatedListedPeers: [
      {
        symbol: 'TITAN',
        name: 'Titan Company Limited (Titan Eye+)',
        nameTe: 'టైటాన్ కంపెనీ',
        sector: 'కన్స్యూమర్ రిటైల్ & ఐవేర్',
        reasonTe: 'Titan Eyeplus ద్వారా ఐవేర్ మరియు లైఫ్‌స్టైల్ రంగంలో NSE లిస్టెడ్ లీడర్.',
      },
    ],
  },
  {
    id: 'ZERODHA',
    name: 'Zerodha Broking Limited',
    nameTe: 'జెరోధా బ్రోకింగ్ (డిస్కౌంట్ బ్రోకర్)',
    brandName: 'Zerodha',
    legalEntityName: 'Zerodha Broking Limited',
    category: 'UNLISTED_PRIVATE',
    categoryLabelTe: 'అన్‌లిస్టెడ్ ప్రైవేట్ డిజిటల్ బ్రోకరేజ్ సంస్థ',
    categoryLabelEn: 'Unlisted Private Discount Broking Leader',
    aliases: ['zerodha', 'జెరోధా', 'zerodha broking', 'నితిన్ కామత్', 'కైట్', 'kite'],
    statusSummaryTe:
      'Zerodha ప్రైవేట్ డిస్కౌంట్ బ్రోకర్. ఇది ఇంకా NSE/BSE లలో పబ్లిక్ లిస్టింగ్ కాలేదు (Groww మాత్రం Billionbrains గా NSE లో GROWW సింబల్‌తో ట్రేడ్ అవుతోంది).',
    statusSummaryEn:
      'Zerodha is privately held and not listed on stock exchanges (while Groww trades on NSE as GROWW).',
    detailedReportTe:
      'Zerodha పూర్తిగా బూట్‌స్ట్రాప్డ్ లాభదాయక సంస్థ. బ్రోకరేజ్ రంగంలో లిస్టెడ్ స్టాక్స్ (Groww, Angel One, 5Paisa, Motilal Oswal) ను మన స్కానర్‌లో విశ్లేషించవచ్చు.',
    detailedReportEn:
      'Zerodha remains unlisted. For listed Indian stock brokerage exposure, analyze Groww (GROWW), Angel One, 5Paisa, or Motilal Oswal.',
    sebiIpoStatus: 'అన్‌లిస్టెడ్ ప్రైవేట్ కంపెనీ',
    relatedListedPeers: [
      {
        symbol: 'GROWW',
        name: 'Billionbrains Garage Ventures (Groww)',
        nameTe: 'గ్రోవ్ (Groww)',
        sector: 'ఫిన్‌టెక్ బ్రోకింగ్',
        reasonTe: 'భారతదేశంలో NSE లిస్టెడ్ అగ్రగామి డిజిటల్ బ్రోకరేజ్ ప్లాట్‌ఫామ్.',
      },
      {
        symbol: 'ANGELONE',
        name: 'Angel One Limited',
        nameTe: 'ఏంజెల్ వన్ లిమిటెడ్',
        sector: 'డిజిటల్ స్టాక్ బ్రోకింగ్',
        reasonTe: 'భారతదేశంలో అత్యంత వేగంగా వృద్ధి చెందుతున్న NSE లిస్టెడ్ ఫిన్‌టెక్ బ్రోకరేజ్.',
      },
      {
        symbol: '5PAISA',
        name: '5Paisa Capital Limited',
        nameTe: '5పైసా క్యాపిటల్',
        sector: 'డిస్కౌంట్ బ్రోకరేజ్',
        reasonTe: 'ఆన్‌లైన్ డిస్కౌంట్ బ్రోకింగ్ రంగంలో ప్యూర్-ప్లే లిస్టెడ్ కంపెనీ.',
      },
      {
        symbol: 'MOTILALOFS',
        name: 'Motilal Oswal Financial Services',
        nameTe: 'మోతీలాల్ ఓస్వాల్',
        sector: 'ఫైనాన్షియల్ సర్వీసెస్ & వెల్త్ మేనేజ్‌మెంట్',
        reasonTe: 'పూర్తి స్థాయి క్యాపిటల్ మార్కెట్స్ మరియు బ్రోకరేజ్ దిగ్గజం.',
      },
    ],
  },
  {
    id: 'BOAT',
    name: 'boAt',
    nameTe: 'బోట్ (Imagine Marketing)',
    brandName: 'boAt Lifestyle',
    legalEntityName: 'Imagine Marketing Limited',
    category: 'PRE_IPO',
    categoryLabelTe: 'ప్రీ-ఐపీవో ఆడియో & వేరబుల్స్ బ్రాండ్',
    categoryLabelEn: 'Pre-IPO Audio & Wearables Brand',
    aliases: ['boat', 'బోట్', 'imagine marketing'],
    statusSummaryTe:
      'boAt ఇయర్ ఫోన్స్ మరియు స్మార్ట్ వాచెస్ బ్రాండ్ నిర్వహించే Imagine Marketing ఇంకా NSE లో లిస్ట్ కాలేదు.',
    statusSummaryEn:
      'Imagine Marketing (boAt) is a private consumer electronics unicorn not yet listed on NSE.',
    detailedReportTe:
      'Imagine Marketing Limited ఆడియో మరియు స్మార్ట్ వేరబుల్స్ రంగంలో దేశీయ మార్కెట్ లీడర్. కంపెనీ IPO కోసం సన్నాహాలు చేస్తోంది.',
    detailedReportEn:
      'boAt parent Imagine Marketing has deferred its IPO plans and remains an unlisted company.',
    sebiIpoStatus: 'ప్రీ-ఐపీవో సన్నాహక దశ',
    relatedListedPeers: [
      {
        symbol: 'DIXON',
        name: 'Dixon Technologies (India) Limited',
        nameTe: 'డిక్సన్ టెక్నాలజీస్',
        sector: 'ఎలక్ట్రానిక్స్ తయారీ (EMS)',
        reasonTe: 'boAt ఉత్పత్తులను దేశీయంగా తయారుచేసే అతిపెద్ద లిస్టెడ్ ఎలక్ట్రానిక్స్ దిగ్గజం.',
      },
    ],
  },
];

// Helper to look up an unlisted company by query string (case-insensitive & Telugu compatible)
export function findUnlistedCompany(query: string): UnlistedCompany | null {
  if (!query || query.trim().length < 2) return null;
  const clean = query.trim().toLowerCase();
  
  for (const comp of KNOWN_UNLISTED_COMPANIES) {
    if (
      comp.id.toLowerCase() === clean ||
      comp.name.toLowerCase() === clean ||
      comp.brandName.toLowerCase().includes(clean) ||
      comp.legalEntityName.toLowerCase().includes(clean) ||
      comp.nameTe.toLowerCase().includes(clean)
    ) {
      return comp;
    }
    const match = comp.aliases.some((a) => {
      const aliasLower = a.toLowerCase();
      return (
        aliasLower === clean ||
        clean.includes(aliasLower) ||
        aliasLower.includes(clean)
      );
    });
    if (match) return comp;
  }
  return null;
}
