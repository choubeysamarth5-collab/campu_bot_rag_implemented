// =============================================
// translations.js
// All UI text in 5 languages
// =============================================

const TRANSLATIONS = {
  en: {
    name: "English",
    welcome: "👋 Hello! I'm **CampusBot**, your 24/7 college assistant. How can I help you today?",
    placeholder: "Ask me anything about your college…",
    topics: ["💰 Fees", "🎓 Admissions", "📅 Exams", "🏠 Hostel", "📚 Library", "💼 Placements", "🏆 Scholarships", "🗓 Timetable"],
    chips: ["Fee deadline?", "Scholarship info", "Exam schedule", "Library timings", "Hostel rules"],
    fallback: "I'm sorry, I didn't quite understand that. Could you rephrase? Or contact us at helpdesk@college.edu",
    typing: "CampusBot is typing",
    contact: "For more help, contact: helpdesk@college.edu | +91 12345 67890",
  },
  hi: {
    name: "हिंदी",
    welcome: "👋 नमस्ते! मैं **CampusBot** हूँ, आपका 24/7 कॉलेज सहायक। आज मैं आपकी कैसे मदद कर सकता हूँ?",
    placeholder: "अपना प्रश्न यहाँ लिखें…",
    topics: ["💰 फीस", "🎓 प्रवेश", "📅 परीक्षा", "🏠 हॉस्टल", "📚 पुस्तकालय", "💼 प्लेसमेंट", "🏆 छात्रवृत्ति", "🗓 टाइमटेबल"],
    chips: ["फीस की तारीख?", "छात्रवृत्ति जानकारी", "परीक्षा समय सारणी", "पुस्तकालय समय", "हॉस्टल नियम"],
    fallback: "मुझे खेद है, मैं यह नहीं समझ पाया। कृपया दोबारा पूछें या helpdesk@college.edu पर संपर्क करें।",
    typing: "CampusBot टाइप कर रहा है",
    contact: "अधिक सहायता के लिए: helpdesk@college.edu | +91 12345 67890",
  },
  mr: {
    name: "मराठी",
    welcome: "👋 नमस्कार! मी **CampusBot** आहे, तुमचा 24/7 महाविद्यालय सहाय्यक. आज मी तुम्हाला कशी मदत करू?",
    placeholder: "आपला प्रश्न येथे टाइप करा…",
    topics: ["💰 फी", "🎓 प्रवेश", "📅 परीक्षा", "🏠 वसतिगृह", "📚 ग्रंथालय", "💼 प्लेसमेंट", "🏆 शिष्यवृत्ती", "🗓 वेळापत्रक"],
    chips: ["फी तारीख?", "शिष्यवृत्ती माहिती", "परीक्षा वेळापत्रक", "ग्रंथालय वेळ", "वसतिगृह नियम"],
    fallback: "मला माफ करा, मला ते समजले नाही. कृपया पुन्हा विचारा किंवा helpdesk@college.edu वर संपर्क करा.",
    typing: "CampusBot टाइप करत आहे",
    contact: "अधिक मदतीसाठी: helpdesk@college.edu | +91 12345 67890",
  },
  ta: {
    name: "தமிழ்",
    welcome: "👋 வணக்கம்! நான் **CampusBot**, உங்கள் 24/7 கல்லூரி உதவியாளர். இன்று நான் எப்படி உதவலாம்?",
    placeholder: "உங்கள் கேள்வியை இங்கே தட்டச்சு செய்யுங்கள்…",
    topics: ["💰 கட்டணம்", "🎓 சேர்க்கை", "📅 தேர்வு", "🏠 விடுதி", "📚 நூலகம்", "💼 வேலைவாய்ப்பு", "🏆 உதவித்தொகை", "🗓 நேர அட்டவணை"],
    chips: ["கட்டண காலக்கெடு?", "உதவித்தொகை தகவல்", "தேர்வு அட்டவணை", "நூலக நேரங்கள்", "விடுதி விதிகள்"],
    fallback: "மன்னிக்கவும், அது புரியவில்லை. மீண்டும் கேட்கவும் அல்லது helpdesk@college.edu-ல் தொடர்பு கொள்ளவும்.",
    typing: "CampusBot தட்டச்சு செய்கிறது",
    contact: "மேலும் உதவிக்கு: helpdesk@college.edu | +91 12345 67890",
  },
  te: {
    name: "తెలుగు",
    welcome: "👋 నమస్కారం! నేను **CampusBot**, మీ 24/7 కళాశాల సహాయకుడు. ఈరోజు నేను మీకు ఎలా సహాయపడగలను?",
    placeholder: "మీ ప్రశ్నను ఇక్కడ టైప్ చేయండి…",
    topics: ["💰 ఫీజు", "🎓 అడ్మిషన్", "📅 పరీక్ష", "🏠 హాస్టల్", "📚 లైబ్రరీ", "💼 ప్లేస్‌మెంట్", "🏆 స్కాలర్‌షిప్", "🗓 టైమ్‌టేబుల్"],
    chips: ["ఫీజు గడువు?", "స్కాలర్‌షిప్ సమాచారం", "పరీక్ష షెడ్యూల్", "లైబ్రరీ సమయాలు", "హాస్టల్ నిబంధనలు"],
    fallback: "క్షమించండి, నాకు అర్థం కాలేదు. దయచేసి మళ్ళీ అడగండి లేదా helpdesk@college.edu కి సంప్రదించండి.",
    typing: "CampusBot టైప్ చేస్తోంది",
    contact: "మరింత సహాయానికి: helpdesk@college.edu | +91 12345 67890",
  }
};

// ── FAQ Knowledge Base (English – translated at runtime) ──
// Each FAQ has: keywords[], intent, answer, category
const FAQ_DB = [
  // ── FEES ──
  {
    keywords: ["fee", "fees", "payment", "deadline", "due date", "last date", "pay", "फीस", "फी", "கட்டணம்", "ఫీజు"],
    intent: "fee_deadline",
    category: "fees",
    answers: {
      en: "📅 **Fee Payment Deadlines:**\n• **Semester 1:** July 31 | **Semester 2:** January 31\n• Late fee: ₹500 after deadline\n• Payment modes: Net Banking, UPI, DD\n• Portal: fees.college.edu\n\nNeed an extension? Contact the accounts office: accounts@college.edu",
      hi: "📅 **शुल्क भुगतान की अंतिम तिथि:**\n• **सेमेस्टर 1:** 31 जुलाई | **सेमेस्टर 2:** 31 जनवरी\n• विलंब शुल्क: अंतिम तिथि के बाद ₹500\n• भुगतान विधि: नेट बैंकिंग, UPI, DD\n• पोर्टल: fees.college.edu",
      mr: "📅 **शुल्क भरण्याची अंतिम तारीख:**\n• **सेमेस्टर 1:** 31 जुलै | **सेमेस्टर 2:** 31 जानेवारी\n• उशिरा शुल्क: ₹500\n• पोर्टल: fees.college.edu",
      ta: "📅 **கட்டண கடைசி தேதி:**\n• **செமஸ்டர் 1:** ஜூலை 31 | **செமஸ்டர் 2:** ஜனவரி 31\n• தாமத கட்டணம்: ₹500\n• போர்டல்: fees.college.edu",
      te: "📅 **ఫీజు చెల్లింపు గడువు తేదీలు:**\n• **సెమిస్టర్ 1:** జూలై 31 | **సెమిస్టర్ 2:** జనవరి 31\n• ఆలస్యం ఫీజు: ₹500\n• పోర్టల్: fees.college.edu",
    }
  },
  // ── SCHOLARSHIP ──
  {
    keywords: ["scholarship", "scholarships", "merit", "financial aid", "stipend", "छात्रवृत्ति", "शिष्यवृत्ती", "உதவித்தொகை", "స్కాలర్‌షిప్"],
    intent: "scholarship",
    category: "scholarships",
    answers: {
      en: "🏆 **Available Scholarships:**\n\n**1. Merit Scholarship** – 75%+ marks → ₹15,000/year\n**2. Government SC/ST/OBC** – Apply at NSP portal (nationalssp.nic.in)\n**3. Minority Scholarship** – Maulana Azad Foundation\n**4. Sports Quota** – State/National level achievers\n**5. College Need-Based** – Family income < ₹3 LPA\n\n📋 Deadline: 30 September | Contact: scholarship@college.edu",
      hi: "🏆 **उपलब्ध छात्रवृत्तियाँ:**\n\n**1. मेरिट छात्रवृत्ति** – 75%+ अंक → ₹15,000/वर्ष\n**2. सरकारी SC/ST/OBC** – NSP पोर्टल पर आवेदन करें\n**3. अल्पसंख्यक छात्रवृत्ति** – मौलाना आज़ाद फाउंडेशन\n**4. कॉलेज जरूरत-आधारित** – पारिवारिक आय < ₹3 LPA\n\n📋 अंतिम तिथि: 30 सितंबर | संपर्क: scholarship@college.edu",
      mr: "🏆 **उपलब्ध शिष्यवृत्त्या:**\n\n**1. गुणवत्ता शिष्यवृत्ती** – 75%+ गुण → ₹15,000/वर्ष\n**2. सरकारी SC/ST/OBC** – NSP पोर्टलवर अर्ज करा\n**3. महाविद्यालय गरज-आधारित** – कौटुंबिक उत्पन्न < ₹3 LPA\n\n📋 अंतिम तारीख: 30 सप्टेंबर",
      ta: "🏆 **கிடைக்கும் உதவித்தொகைகள்:**\n\n**1. மெரிட் உதவித்தொகை** – 75%+ மதிப்பெண் → ₹15,000/ஆண்டு\n**2. அரசு SC/ST/OBC** – NSP போர்டல் மூலம் விண்ணப்பிக்கவும்\n**3. கல்லூரி தேவை-அடிப்படையிலான** – குடும்ப வருமானம் < ₹3 LPA\n\n📋 கடைசி தேதி: செப்டம்பர் 30",
      te: "🏆 **అందుబాటులో ఉన్న స్కాలర్‌షిప్‌లు:**\n\n**1. మెరిట్ స్కాలర్‌షిప్** – 75%+ మార్కులు → ₹15,000/సంవత్సరం\n**2. ప్రభుత్వ SC/ST/OBC** – NSP పోర్టల్‌లో దరఖాస్తు చేయండి\n**3. కళాశాల అవసరం-ఆధారిత** – కుటుంబ ఆదాయం < ₹3 LPA\n\n📋 గడువు: సెప్టెంబర్ 30",
    }
  },
  // ── ADMISSION ──
  {
    keywords: ["admission", "apply", "application", "enroll", "joining", "प्रवेश", "प्रवेश", "சேர்க்கை", "అడ్మిషన్"],
    intent: "admission",
    category: "admissions",
    answers: {
      en: "🎓 **Admission Process:**\n\n**Step 1:** Fill online form at admissions.college.edu\n**Step 2:** Upload: 10th/12th marksheets, ID proof, passport photo\n**Step 3:** Pay application fee ₹500 online\n**Step 4:** Entrance test / Merit list\n**Step 5:** Document verification & fee payment\n\n📅 **Dates:** Forms open: May 1 | Last date: June 30\n📞 Helpline: 1800-XXX-XXXX (Toll Free)",
      hi: "🎓 **प्रवेश प्रक्रिया:**\n\n**चरण 1:** admissions.college.edu पर ऑनलाइन फॉर्म भरें\n**चरण 2:** 10वीं/12वीं मार्कशीट, ID प्रमाण अपलोड करें\n**चरण 3:** ₹500 आवेदन शुल्क का भुगतान करें\n**चरण 4:** प्रवेश परीक्षा / मेरिट सूची\n**चरण 5:** दस्तावेज़ सत्यापन और शुल्क भुगतान\n\n📅 फॉर्म: 1 मई से | अंतिम तिथि: 30 जून",
      mr: "🎓 **प्रवेश प्रक्रिया:**\n\n**पाऊल 1:** admissions.college.edu वर ऑनलाइन फॉर्म भरा\n**पाऊल 2:** मार्कशीट अपलोड करा\n**पाऊल 3:** ₹500 अर्ज शुल्क भरा\n\n📅 फॉर्म: 1 मे | अंतिम तारीख: 30 जून",
      ta: "🎓 **சேர்க்கை செயல்முறை:**\n\n**படி 1:** admissions.college.edu-ல் ஆன்லைன் படிவம் நிரப்பவும்\n**படி 2:** மார்க்‌ஷீட்கள் பதிவேற்றவும்\n**படி 3:** ₹500 விண்ணப்பக் கட்டணம் செலுத்தவும்\n\n📅 படிவங்கள்: மே 1 | கடைசி தேதி: ஜூன் 30",
      te: "🎓 **అడ్మిషన్ ప్రక్రియ:**\n\n**దశ 1:** admissions.college.edu వద్ద ఆన్‌లైన్ ఫారమ్ నింపండి\n**దశ 2:** మార్క్‌షీట్లు అప్‌లోడ్ చేయండి\n**దశ 3:** ₹500 దరఖాస్తు రుసుము చెల్లించండి\n\n📅 ఫారమ్‌లు: మే 1 | చివరి తేదీ: జూన్ 30",
    }
  },
  // ── EXAM ──
  {
    keywords: ["exam", "exams", "examination", "schedule", "timetable", "test", "paper", "परीक्षा", "தேர்வு", "పరీక్ష"],
    intent: "exam_schedule",
    category: "exams",
    answers: {
      en: "📅 **Exam Schedule:**\n\n**Mid-Semester Exams:** September 15–25\n**End-Semester Exams:** November 20 – December 10\n\n📋 Admit cards available 7 days before exams\n🚫 No electronic devices allowed in exam hall\n📍 Hall tickets: exams.college.edu\n\nDetailed timetable is posted on the college notice board and website.",
      hi: "📅 **परीक्षा समय सारणी:**\n\n**मध्य सत्र परीक्षा:** 15-25 सितंबर\n**अंत सत्र परीक्षा:** 20 नवंबर – 10 दिसंबर\n\n📋 प्रवेश पत्र परीक्षा से 7 दिन पहले\n📍 हॉल टिकट: exams.college.edu",
      mr: "📅 **परीक्षा वेळापत्रक:**\n\n**मध्य सत्र:** 15-25 सप्टेंबर\n**अंतिम सत्र:** 20 नोव्हेंबर – 10 डिसेंबर\n\n📋 प्रवेश पत्र 7 दिवस आधी\n📍 exams.college.edu",
      ta: "📅 **தேர்வு அட்டவணை:**\n\n**இடைத் தேர்வு:** செப்டம்பர் 15-25\n**இறுதித் தேர்வு:** நவம்பர் 20 – டிசம்பர் 10\n\n📋 ஹால் டிக்கெட்: exams.college.edu",
      te: "📅 **పరీక్ష షెడ్యూల్:**\n\n**మిడ్-సెమిస్టర్:** సెప్టెంబర్ 15-25\n**ఎండ్-సెమిస్టర్:** నవంబర్ 20 – డిసెంబర్ 10\n\n📋 హాల్ టికెట్లు: exams.college.edu",
    }
  },
  // ── HOSTEL ──
  {
    keywords: ["hostel", "dormitory", "accommodation", "room", "mess", "warden", "हॉस्टल", "वसतिगृह", "விடுதி", "హాస్టల్"],
    intent: "hostel",
    category: "hostel",
    answers: {
      en: "🏠 **Hostel Information:**\n\n• **Boys Hostel:** Block A & B (capacity: 400)\n• **Girls Hostel:** Block C (capacity: 200)\n• **Mess Timings:** Breakfast 7-9am | Lunch 12-2pm | Dinner 7-9pm\n• **Monthly Charges:** ₹4,500 (room) + ₹3,200 (mess)\n• **Curfew:** 10:00 PM\n• **Warden Contact:** warden@college.edu\n\nFor allotment: Apply at hostel.college.edu during admission",
      hi: "🏠 **हॉस्टल जानकारी:**\n\n• **बॉयज हॉस्टल:** ब्लॉक A & B (400 सीटें)\n• **गर्ल्स हॉस्टल:** ब्लॉक C (200 सीटें)\n• **मेस टाइमिंग:** नाश्ता 7-9 | दोपहर 12-2 | रात 7-9\n• **मासिक शुल्क:** ₹4,500 (कमरा) + ₹3,200 (मेस)\n• **कर्फ्यू:** रात 10 बजे",
      mr: "🏠 **वसतिगृह माहिती:**\n\n• **मुलांचे वसतिगृह:** Block A & B\n• **मुलींचे वसतिगृह:** Block C\n• **मासिक शुल्क:** ₹4,500 + ₹3,200 (जेवण)\n• **कर्फ्यू:** रात्री 10",
      ta: "🏠 **விடுதி தகவல்:**\n\n• **ஆண்கள் விடுதி:** Block A & B\n• **பெண்கள் விடுதி:** Block C\n• **மாதாந்திர கட்டணம்:** ₹4,500 + ₹3,200 (மெஸ்)\n• **ஊரடங்கு:** இரவு 10 மணி",
      te: "🏠 **హాస్టల్ సమాచారం:**\n\n• **అబ్బాయిల హాస్టల్:** Block A & B\n• **అమ్మాయిల హాస్టల్:** Block C\n• **నెలవారీ రుసుము:** ₹4,500 + ₹3,200 (మెస్)\n• **కర్ఫ్యూ:** రాత్రి 10",
    }
  },
  // ── LIBRARY ──
  {
    keywords: ["library", "book", "books", "reading", "borrow", "return", "पुस्तकालय", "ग्रंथालय", "நூலகம்", "లైబ్రరీ"],
    intent: "library",
    category: "library",
    answers: {
      en: "📚 **Library Information:**\n\n• **Timings:** Mon–Sat: 8 AM – 9 PM | Sunday: 10 AM – 5 PM\n• **Books per student:** 3 books / 14 days\n• **Fine:** ₹2 per day after due date\n• **E-Library:** elibrary.college.edu (24/7 access)\n• **Reference section:** No borrowing, reading room only\n• **Librarian:** library@college.edu\n\nNew arrivals updated every Monday!",
      hi: "📚 **पुस्तकालय जानकारी:**\n\n• **समय:** सोम-शनि: 8 AM – 9 PM | रवि: 10 AM – 5 PM\n• **पुस्तकें:** 3 पुस्तकें / 14 दिन\n• **जुर्माना:** ₹2/दिन\n• **ई-लाइब्रेरी:** elibrary.college.edu",
      mr: "📚 **ग्रंथालय माहिती:**\n\n• **वेळ:** सोम-शनि: 8 AM – 9 PM | रवि: 10 AM – 5 PM\n• **पुस्तके:** 3 पुस्तके / 14 दिवस\n• **दंड:** ₹2/दिवस",
      ta: "📚 **நூலக தகவல்:**\n\n• **நேரங்கள்:** திங்கள்-சனி: 8 AM – 9 PM | ஞாயிறு: 10 AM – 5 PM\n• **புத்தகங்கள்:** 3 புத்தகங்கள் / 14 நாட்கள்\n• **அபராதம்:** ₹2/நாள்",
      te: "📚 **లైబ్రరీ సమాచారం:**\n\n• **సమయాలు:** సోమ-శని: 8 AM – 9 PM | ఆదివారం: 10 AM – 5 PM\n• **పుస్తకాలు:** 3 పుస్తకాలు / 14 రోజులు\n• **జరిమానా:** ₹2/రోజు",
    }
  },
  // ── PLACEMENT ──
  {
    keywords: ["placement", "job", "career", "internship", "campus drive", "recruit", "company", "प्लेसमेंट", "வேலைவாய்ப்பு", "ప్లేస్‌మెంట్"],
    intent: "placement",
    category: "placements",
    answers: {
      en: "💼 **Placement Cell:**\n\n• **Avg Package (2024):** ₹6.5 LPA\n• **Highest Package:** ₹28 LPA (TCS, Infosys, Google)\n• **Placement Rate:** 87% (BTech 2024 batch)\n• **Registration:** placement.college.edu\n• **Coordinator:** placement@college.edu | +91 98765 43210\n\n📅 **Campus drives:** Oct–March every year\n💡 Tip: Maintain 6.5 CGPA minimum for eligibility",
      hi: "💼 **प्लेसमेंट सेल:**\n\n• **औसत पैकेज:** ₹6.5 LPA\n• **सर्वोच्च पैकेज:** ₹28 LPA\n• **प्लेसमेंट दर:** 87%\n• **पंजीकरण:** placement.college.edu",
      mr: "💼 **प्लेसमेंट सेल:**\n\n• **सरासरी पॅकेज:** ₹6.5 LPA\n• **सर्वोच्च पॅकेज:** ₹28 LPA\n• **प्लेसमेंट दर:** 87%",
      ta: "💼 **வேலைவாய்ப்பு செல்:**\n\n• **சராசரி தொகுப்பு:** ₹6.5 LPA\n• **அதிகபட்ச தொகுப்பு:** ₹28 LPA\n• **வேலைவாய்ப்பு விகிதம்:** 87%",
      te: "💼 **ప్లేస్‌మెంట్ సెల్:**\n\n• **సగటు ప్యాకేజీ:** ₹6.5 LPA\n• **అత్యధిక ప్యాకేజీ:** ₹28 LPA\n• **ప్లేస్‌మెంట్ రేటు:** 87%",
    }
  },
  // ── TIMETABLE ──
  {
    keywords: ["timetable", "time table", "class", "classes", "schedule", "lecture", "टाइमटेबल", "वेळापत्रक", "நேர அட்டவணை", "టైమ్‌టేబుల్"],
    intent: "timetable",
    category: "timetable",
    answers: {
      en: "🗓 **Class Timetable:**\n\n• **College Hours:** 8:00 AM – 5:00 PM\n• **Each Period:** 55 minutes\n• **Lunch Break:** 12:30 PM – 1:15 PM\n• **Timetable Portal:** timetable.college.edu\n\n📱 You can also download the **CampusApp** for live timetable updates.\n\nFor department-specific timetable, contact your department coordinator.",
      hi: "🗓 **कक्षा समय सारणी:**\n\n• **कॉलेज समय:** सुबह 8 बजे – शाम 5 बजे\n• **प्रत्येक पीरियड:** 55 मिनट\n• **लंच ब्रेक:** 12:30 – 1:15 PM\n• **पोर्टल:** timetable.college.edu",
      mr: "🗓 **वर्ग वेळापत्रक:**\n\n• **महाविद्यालय वेळ:** सकाळी 8 – संध्याकाळी 5\n• **प्रत्येक तास:** 55 मिनिटे\n• **पोर्टल:** timetable.college.edu",
      ta: "🗓 **வகுப்பு நேர அட்டவணை:**\n\n• **கல்லூரி நேரம்:** காலை 8 – மாலை 5\n• **ஒவ்வொரு பாடமும்:** 55 நிமிடங்கள்\n• **போர்டல்:** timetable.college.edu",
      te: "🗓 **క్లాస్ టైమ్‌టేబుల్:**\n\n• **కళాశాల సమయాలు:** ఉదయం 8 – సాయంత్రం 5\n• **ప్రతి పీరియడ్:** 55 నిమిషాలు\n• **పోర్టల్:** timetable.college.edu",
    }
  },
];

// Export for use in app.js
if (typeof module !== 'undefined') module.exports = { TRANSLATIONS, FAQ_DB };
