import type { LyricLine, LyricWord } from "@/lib/types";

// ============================================================================
// Lyrical Lexicon (High-frequency Hindi & Urdu words in music & poetry)
// Maps Devanagari and Perso-Arabic Urdu to natural conversational Roman/Hinglish.
// ============================================================================
const LEXICON: Record<string, string> = {
  // --- Pronouns & Demonstratives ---
  "मैं": "main",
  "मुझे": "mujhe",
  "मुझको": "mujhko",
  "मुझसे": "mujhse",
  "मेरा": "mera",
  "मेरी": "meri",
  "मेरे": "mere",
  "तू": "tu",
  "तुझे": "tujhe",
  "तुझको": "tujhko",
  "तुझसे": "tujhse",
  "तेरा": "tera",
  "तेरी": "teri",
  "तेरे": "tere",
  "तुम": "tum",
  "तुम्हें": "tumhein",
  "तुमको": "tumko",
  "तुमसे": "tumse",
  "तुम्हारा": "tumhara",
  "तुम्हारी": "tumhari",
  "तुम्हारे": "tumhare",
  "हम": "hum",
  "हमें": "humein",
  "हमको": "humko",
  "हमसे": "humse",
  "हमारा": "hamara",
  "हमारी": "hamari",
  "हमारे": "hamare",
  "वो": "woh",
  "वोही": "wohi",
  "उसे": "use",
  "उसको": "usko",
  "उससे": "usse",
  "उसका": "uska",
  "उसकी": "uski",
  "उसके": "uske",
  "ये": "yeh",
  "यही": "yahi",
  "इसे": "ise",
  "इसको": "isko",
  "इससे": "isse",
  "इसका": "iska",
  "इसकी": "iski",
  "इसके": "iske",
  "इन": "in",
  "उन": "un",
  "कौन": "kaun",
  "कोई": "koi",
  "क्या": "kya",
  "क्यों": "kyun",
  "क्यूं": "kyun",
  "क्योंकि": "kyunki",
  "कुछ": "kuch",
  "सब": "sab",
  "सबको": "sabko",
  "सभी": "sabhi",
  "अपना": "apna",
  "अपनी": "apni",
  "अपने": "apne",

  // --- Connectors, Prepositions & Adverbs ---
  "और": "aur",
  "भी": "bhi",
  "ही": "hi",
  "तो": "toh",
  "पे": "pe",
  "पर": "par",
  "में": "mein",
  "से": "se",
  "को": "ko",
  "का": "ka",
  "की": "ki",
  "के": "ke",
  "ने": "ne",
  "ना": "na",
  "नहीं": "nahi",
  "मत": "mat",
  "बिना": "bina",
  "साथ": "saath",
  "पास": "paas",
  "दूर": "door",
  "दूरी": "doori",
  "यहाँ": "yahaan",
  "वहाँ": "wahaan",
  "कहाँ": "kahaan",
  "जहाँ": "jahaan",
  "अब": "ab",
  "जब": "jab",
  "तब": "tab",
  "कब": "kab",
  "कभी": "kabhi",
  "हर": "har",
  "जैसे": "jaise",
  "वैसा": "waisa",
  "वैसी": "waisi",
  "वैसे": "waise",
  "कैसा": "kaisa",
  "कैसी": "kaisi",
  "कैसे": "kaise",
  "इतना": "itna",
  "इतनी": "itni",
  "इतने": "itne",
  "उतना": "utna",
  "कितना": "kitna",
  "कितनी": "kitni",
  "कितने": "kitne",
  "जितना": "jitna",
  "कल": "kal",
  "आज": "aaj",

  // --- Common Verbs & Auxiliaries ---
  "है": "hai",
  "हैं": "hain",
  "हूँ": "hoon",
  "हो": "ho",
  "था": "tha",
  "थी": "thi",
  "थे": "the",
  "होता": "hota",
  "होती": "hoti",
  "होते": "hote",
  "होना": "hona",
  "होने": "hone",
  "हुआ": "hua",
  "हुई": "hui",
  "हुए": "hue",
  "कर": "kar",
  "करता": "karta",
  "करती": "karti",
  "करते": "karte",
  "करना": "karna",
  "करने": "karne",
  "किया": "kiya",
  "किए": "kiye",
  "कीजिए": "kijiye",
  "रहता": "rahta",
  "रहती": "rahti",
  "रहते": "rahte",
  "रहना": "rahna",
  "रहा": "raha",
  "रही": "rahi",
  "रहे": "rahe",
  "सकता": "sakta",
  "सकती": "sakti",
  "सकते": "sakte",
  "सकना": "sakna",
  "जाना": "jaana",
  "जाता": "jaata",
  "जाती": "jaati",
  "जाते": "jaate",
  "गया": "gaya",
  "गयी": "gayi",
  "गए": "gaye",
  "गई": "gayi",
  "आना": "aana",
  "आता": "aata",
  "आती": "aati",
  "आते": "aate",
  "आया": "aaya",
  "आई": "aayi",
  "आए": "aaye",
  "पाना": "paana",
  "पाया": "paaya",
  "खोना": "khona",
  "खोया": "khoya",
  "देख": "dekh",
  "देखा": "dekha",
  "देखी": "dekhi",
  "देखे": "dekhe",
  "देखना": "dekhna",
  "देखकर": "dekhkar",
  "सुन": "sun",
  "सुना": "suna",
  "सुनी": "suni",
  "सुने": "sune",
  "सुनना": "sunna",
  "कह": "kah",
  "कहा": "kaha",
  "कहना": "kahna",
  "कहते": "kahte",
  "बता": "bata",
  "बताया": "bataya",
  "बताए": "bataye",
  "बताओ": "batao",
  "बताना": "batana",
  "बना": "bana",
  "बनाया": "banaya",
  "बनाने": "banane",
  "लगा": "laga",
  "लगी": "lagi",
  "लगे": "lage",
  "लगाए": "lagaye",
  "लगाना": "lagana",
  "लगाने": "lagane",
  "डर": "dar",
  "डरा": "dara",
  "डरते": "darte",
  "डरता": "darta",
  "डरती": "darti",
  "डरना": "darna",
  "पता": "pata",
  "चल": "chal",
  "चला": "chala",
  "चली": "chali",
  "चले": "chale",
  "चलना": "chalna",
  "बदल": "badal",
  "बदला": "badla",
  "बदली": "badli",
  "बदले": "badle",
  "बदलना": "badalna",
  "मिल": "mil",
  "मिला": "mila",
  "मिली": "mili",
  "मिले": "mile",
  "मिलना": "milna",
  "चाह": "chaah",
  "चाहा": "chaha",
  "चाहता": "chahta",
  "चाहती": "chahti",
  "चाहते": "chahte",
  "चाहिए": "chahiye",
  "जीना": "jeena",
  "मरना": "marna",
  "रुक": "ruk",
  "रुका": "ruka",
  "रुकना": "rukna",
  "छू": "chhoo",
  "छुआ": "chhua",
  "छूना": "chhoona",

  // --- Core Music & Romantic Poetry Vocabulary ---
  "दिल": "dil",
  "दिलों": "dilon",
  "प्यार": "pyaar",
  "इश्क": "ishq",
  "इश्क़": "ishq",
  "मोहब्बत": "mohabbat",
  "सनम": "sanam",
  "ज़िंदगी": "zindagi",
  "जिंदगी": "zindagi",
  "जान": "jaan",
  "जाने": "jaane",
  "धड़कन": "dhadkan",
  "धड़कने": "dhadkane",
  "सांस": "saans",
  "सांसें": "saansein",
  "आँख": "aankh",
  "आँखें": "aankhein",
  "आंखें": "aankhein",
  "आँखों": "aankhon",
  "आंखों": "aankhon",
  "नज़र": "nazar",
  "नजर": "nazar",
  "नज़रों": "nazron",
  "निगाह": "nigaah",
  "निगाहें": "nigahein",
  "निगाहों": "nigahon",
  "चेहरा": "chehra",
  "चेहरे": "chehre",
  "रुख": "rukh",
  "जुल्फ": "zulf",
  "जुल्फें": "zulfein",
  "ज़ुल्फ़ें": "zulfein",
  "बात": "baat",
  "बातें": "baatein",
  "बातों": "baaton",
  "रात": "raat",
  "रातें": "raatein",
  "रातों": "raaton",
  "दिन": "din",
  "शाम": "shaam",
  "सुबह": "subah",
  "सवेरा": "savera",
  "चाँद": "chaand",
  "चांदनी": "chandni",
  "तारा": "taara",
  "तारे": "taare",
  "सितारे": "sitaare",
  "आसमां": "aasmaan",
  "आसमान": "aasmaan",
  "जमीन": "zameen",
  "ज़मीन": "zameen",
  "हवा": "hawa",
  "हवाएं": "hawayein",
  "मौसम": "mausam",
  "बारिश": "baarish",
  "बादल": "baadal",
  "गुल": "gul",
  "गुलाब": "gulaab",
  "खुशबू": "khushboo",
  "महक": "mahak",
  "सफर": "safar",
  "रास्ता": "raasta",
  "रास्ते": "raaste",
  "मंजिल": "manzil",
  "मंज़िल": "manzil",
  "हमसफर": "hamsafar",
  "हमदम": "hamdam",
  "यार": "yaar",
  "यारा": "yaara",
  "दोस्त": "dost",
  "दोस्ती": "dosti",
  "दुनिया": "duniya",
  "खुदा": "khuda",
  "रब्बा": "rabba",
  "मौली": "maula",
  "मौला": "Maula",
  "अल्लाह": "Allah",
  "दुआ": "dua",
  "दुआएं": "duayein",
  "नसीब": "naseeb",
  "किस्मत": "qismat",
  "क़िस्मत": "qismat",
  "ख्वाब": "khwaab",
  "ख़्वाब": "khwaab",
  "सपना": "sapna",
  "सपने": "sapne",
  "दीवाना": "deewana",
  "दीवानी": "deewani",
  "दीवाने": "deewane",
  "मस्ताना": "mastaana",
  "परवाना": "parwana",
  "आशिक": "aashiq",
  "आशिक़": "aashiq",
  "आज़ाद": "aazaad",
  "आज़ाद": "aazaad",
  "खास": "khaas",
  "ख़ास": "khaas",
  "मजबूर": "majboor",
  "बे": "be",
  "फ़िज़ूल": "fizool",
  "फिज़ूल": "fizool",
  "फिजूल": "fizool",
  "बे-फ़िज़ूल": "be-fizool",
  "बेफ़िज़ूल": "be-fizool",
  "बेखुदी": "bekhudi",
  "बेवफा": "bewafa",
  "वफा": "wafa",
  "दर्द": "dard",
  "तन्हा": "tanha",
  "तन्हाई": "tanhai",
  "आंसू": "aansoo",
  "रोना": "rona",
  "हंसना": "hasna",
  "मुस्कान": "muskaan",
  "मुस्कुराना": "muskurana",
  "केसरिया": "Kesariya",
  "हुस्न": "husn",
  "खाली": "khaali",
  "ख़ाली": "khaali",
  "तिजोरी": "tijori",
  "तिजोरियां": "tijoriyan",
  "तिजोरियाँ": "tijoriyan",

  // ==========================================================================
  // Urdu (Perso-Arabic Script)
  // ==========================================================================
  "کل": "kal",
  "آج": "aaj",
  "سب": "sab",
  "تھا": "tha",
  "تھی": "thi",
  "تھے": "the",
  "تو": "toh",
  "وہ": "woh",
  "یہ": "yeh",
  "بھی": "bhi",
  "ہی": "hi",
  "سے": "se",
  "میں": "mein",
  "پہ": "pe",
  "پر": "par",
  "کو": "ko",
  "کا": "ka",
  "کی": "ki",
  "کے": "ke",
  "نے": "ne",
  "نہ": "na",
  "نہیں": "nahi",
  "ہے": "hai",
  "ہیں": "hain",
  "ہوں": "hoon",
  "ہو": "ho",
  "ہم": "hum",
  "تم": "tum",
  "تجھے": "tujhe",
  "اسے": "use",
  "میرا": "mera",
  "مری": "meri",
  "میری": "meri",
  "میرے": "mere",
  "تیرا": "tera",
  "تیری": "teri",
  "تیرے": "tere",
  "دل": "dil",
  "پیار": "pyaar",
  "عشق": "ishq",
  "محبت": "mohabbat",
  "صنم": "sanam",
  "زندگی": "zindagi",
  "آزاد": "aazaad",
  "خاص": "khaas",
  "مجبور": "majboor",
  "کیوں": "kyun",
  "فضول": "fizool",
  "بے": "be",
  "بے-فضول": "be-fizool",
  "بےفضول": "be-fizool",
  "جیسے": "jaise",
  "لگانے": "lagane",
  "لگانا": "lagana",
  "لگا": "laga",
  "لگی": "lagi",
  "لگے": "lage",
  "ڈرتے": "darte",
  "ڈرتا": "darta",
  "ڈرتی": "darti",
  "ڈر": "dar",
  "پتا": "pata",
  "چلا": "chala",
  "چلے": "chale",
  "چلی": "chali",
  "بدل": "badal",
  "بدلا": "badla",
  "بدلے": "badle",
  "بدلی": "badli",
  "گئے": "gaye",
  "گئی": "gayi",
  "گیا": "gaya",
  "ہوئے": "hue",
  "ہوئی": "hui",
  "ہوا": "hua",
  "لئے": "liye",
  "لیے": "liye",
  "قسمت": "Qismat",
  "چین": "chain",
  "جینا": "jeena",
  "لکھ": "likh",
  "دے": "de",
  "ڈوبے": "doobe",
  "کبھی": "kabhi",
  "سفینہ": "safeena",
  "جنت": "jannat",
  "گوارا": "gawara",
  "مگر": "magar",
  "ایسا": "aisa",
  "ایسی": "aisi",
  "ایسے": "aise",
  "دیکھا": "dekha",
  "خوبصورت": "khoobsurat",
  "کوئی": "koi",
  "جسم": "jism",
  "اجنتا": "ajanta",
  "مورت": "moorat",
  "نگاہوں": "nigahon",
  "نگاہ": "nigaah",
  "جادو": "jaadu",
  "تاجدار": "Tajdar",
  "حرم": "Haram",
  "شاہ": "Shah",
  "عالم": "Aalam",
  "سلام": "salam",
  "نغمہ": "naghma",
  "خوشبو": "khushboo",
  "مہکتی": "mehekti",
  "چاندنی": "chandni",
  "مچلتی": "machalti",
  "راگنی": "raagni",
  "صراحی": "surahi",
  "بکھری": "bikhri",
  "زلفیں": "zulfein",
  "گھٹا": "ghata",
  "مخمور": "makhmoor",
  "پلکیں": "palkein",
};

// ============================================================================
// Devanagari Tables & Phonology
// ============================================================================
const INDEPENDENT_VOWELS: Record<string, string> = {
  "अ": "a",
  "आ": "aa",
  "इ": "i",
  "ई": "ee",
  "उ": "u",
  "ऊ": "oo",
  "ऋ": "ri",
  "ए": "e",
  "ऐ": "ai",
  "ओ": "o",
  "औ": "au",
  "अं": "an",
  "अः": "ah",
  "ऑ": "o",
  "ॲ": "e",
};

const MATRAS: Record<string, string> = {
  "\u093E": "aa", // ा
  "\u093F": "i", // ि
  "\u0940": "ee", // ी
  "\u0941": "u", // ु
  "\u0942": "oo", // ू
  "\u0943": "ri", // ृ
  "\u0947": "e", // े
  "\u0948": "ai", // ै
  "\u094B": "o", // ो
  "\u094C": "au", // ौ
  "\u0949": "o", // ॉ
  "\u0945": "e", // ॅ
};

const CONSONANTS: Record<string, string> = {
  "क": "k",
  "ख": "kh",
  "ग": "g",
  "घ": "gh",
  "ङ": "ng",
  "च": "ch",
  "छ": "chh",
  "ज": "j",
  "झ": "jh",
  "ञ": "n",
  "ट": "t",
  "ठ": "th",
  "ड": "d",
  "ढ": "dh",
  "ण": "n",
  "त": "t",
  "थ": "th",
  "द": "d",
  "ध": "dh",
  "न": "n",
  "प": "p",
  "फ": "ph",
  "ब": "b",
  "भ": "bh",
  "म": "m",
  "य": "y",
  "र": "r",
  "ल": "l",
  "व": "v",
  "श": "sh",
  "ष": "sh",
  "स": "s",
  "ह": "h",
  // Precomposed & canonical nuktas
  "क़": "q",
  "ख़": "kh",
  "ग़": "gh",
  "ज़": "z",
  "ड़": "r",
  "ढ़": "rh",
  "फ़": "f",
  "क़": "q",
  "ख़": "kh",
  "ग़": "gh",
  "ज़": "z",
  "ड़": "r",
  "ढ़": "rh",
  "फ़": "f",
};

const NUKTA_CONSONANTS: Record<string, string> = {
  "क": "q",
  "ख": "kh",
  "ग": "gh",
  "ज": "z",
  "ड": "r",
  "ढ": "rh",
  "फ": "f",
};

const VIRAMA = "\u094D"; // ्
const ANUSVARA = "\u0902"; // ं
const CHANDRABINDU = "\u0901"; // ँ
const NUKTA = "\u093C"; // ़

type Aksara =
  | { type: "vowel"; text: string }
  | {
      type: "consonant";
      cluster: string;
      hasMatra: boolean;
      matraText: string;
      isHalant: boolean;
      isNasal: boolean;
    }
  | { type: "other"; text: string };

/**
 * Transliterates a Devanagari word into natural conversational Hinglish
 * using the Choudhury et al. schwa deletion phonological algorithm.
 */
function transliterateDevanagariWord(rawWord: string): string {
  // Check Lexicon first
  if (LEXICON[rawWord]) return LEXICON[rawWord];
  const clean = rawWord.normalize("NFC");
  if (LEXICON[clean]) return LEXICON[clean];

  // Parse into aksaras (syllabic units)
  const aksaras: Aksara[] = [];
  let i = 0;
  while (i < clean.length) {
    const ch = clean[i];
    if (INDEPENDENT_VOWELS[ch]) {
      let v = INDEPENDENT_VOWELS[ch];
      i++;
      if (i < clean.length && (clean[i] === ANUSVARA || clean[i] === CHANDRABINDU)) {
        v += "n";
        i++;
      }
      aksaras.push({ type: "vowel", text: v });
    } else if (CONSONANTS[ch]) {
      let cluster = "";
      let hasMatra = false;
      let matraText = "";
      let isHalant = false;
      let isNasal = false;

      while (i < clean.length) {
        const c = clean[i];
        if (CONSONANTS[c]) {
          let sound = CONSONANTS[c];
          // Check if followed by nukta \u093C
          if (i + 1 < clean.length && clean[i + 1] === NUKTA) {
            sound = NUKTA_CONSONANTS[c] || CONSONANTS[c];
            i++; // advance over nukta
          }

          if (i + 1 < clean.length && clean[i + 1] === VIRAMA && i + 2 < clean.length && CONSONANTS[clean[i + 2]]) {
            cluster += sound;
            i += 2;
          } else {
            cluster += sound;
            i++;
            break;
          }
        } else {
          break;
        }
      }

      // Consume any lingering nukta mark
      if (i < clean.length && clean[i] === NUKTA) i++;

      if (i < clean.length && MATRAS[clean[i]]) {
        hasMatra = true;
        matraText = MATRAS[clean[i]];
        i++;
      } else if (i < clean.length && clean[i] === VIRAMA) {
        isHalant = true;
        i++;
      }

      if (i < clean.length && (clean[i] === ANUSVARA || clean[i] === CHANDRABINDU)) {
        isNasal = true;
        i++;
      }

      aksaras.push({
        type: "consonant",
        cluster,
        hasMatra,
        matraText,
        isHalant,
        isNasal,
      });
    } else if (ch === NUKTA) {
      // Stray nukta: skip it so it never forms a dotted circle
      i++;
    } else {
      aksaras.push({ type: "other", text: ch });
      i++;
    }
  }

  const numSyllables = aksaras.filter((a) => a.type === "consonant" || a.type === "vowel").length;
  let syllableIndex = 0;
  let result = "";

  for (let idx = 0; idx < aksaras.length; idx++) {
    const a = aksaras[idx];
    if (a.type === "other") {
      result += a.text;
      continue;
    }
    if (a.type === "vowel") {
      result += a.text;
      syllableIndex++;
      continue;
    }

    let vowel = "a";
    if (a.isHalant) {
      vowel = "";
    } else if (a.hasMatra) {
      vowel = a.matraText;
    } else {
      const isLast = syllableIndex === numSyllables - 1;
      if (isLast) {
        // Final schwa deletion (sanam, dil, husn)
        vowel = numSyllables > 1 ? "" : "a";
      } else {
        // Medial schwa check (Choudhury et al.)
        const nextAksara = aksaras.slice(idx + 1).find((x) => x.type === "consonant" || x.type === "vowel");
        const prevAksara = aksaras.slice(0, idx).reverse().find((x) => x.type === "consonant" || x.type === "vowel");
        if (nextAksara && prevAksara) {
          const nextIsSuffix =
            nextAksara.type === "consonant" &&
            (nextAksara.hasMatra || ["n", "t", "r", "k", "l", "m"].includes(nextAksara.cluster));
          if (nextIsSuffix && (prevAksara.type === "vowel" || (prevAksara.type === "consonant" && prevAksara.hasMatra) || numSyllables >= 3)) {
            if (idx === 1 && numSyllables >= 3) {
              vowel = ""; // e.g. dhad-kan, safal-ta
            } else if (idx === aksaras.length - 2 && nextAksara.type === "consonant" && nextAksara.hasMatra) {
              vowel = ""; // e.g. kar-na, lad-ki
            }
          }
        }
      }
    }

    let syl = a.cluster + vowel;
    if (a.isNasal) {
      if (vowel === "ee") syl = a.cluster + "i";
      syl += "n";
    }

    result += syl;
    syllableIndex++;
  }

  return matchCase(rawWord, result);
}

// ============================================================================
// Urdu Perso-Arabic Transliteration Engine
// ============================================================================
const URDU_LETTERS: Record<string, string> = {
  "ا": "a",
  "آ": "aa",
  "ب": "b",
  "پ": "p",
  "ت": "t",
  "ٹ": "t",
  "ث": "s",
  "ج": "j",
  "چ": "ch",
  "ح": "h",
  "خ": "kh",
  "د": "d",
  "ڈ": "d",
  "ذ": "z",
  "ر": "r",
  "ڑ": "r",
  "ز": "z",
  "ژ": "zh",
  "س": "s",
  "ش": "sh",
  "ص": "s",
  "ض": "z",
  "ط": "t",
  "ظ": "z",
  "ع": "a",
  "غ": "gh",
  "ف": "f",
  "ق": "q",
  "ک": "k",
  "گ": "g",
  "ل": "l",
  "م": "m",
  "ن": "n",
  "ں": "n",
  "و": "o",
  "ہ": "h",
  "ھ": "h",
  "ء": "",
  "ی": "i",
  "ے": "e",
  "ئ": "e",
};

const URDU_PUNCTUATION: Record<string, string> = {
  "،": ",",
  "؟": "?",
  "؛": ";",
  "۔": ".",
};

function transliterateUrduWord(word: string): string {
  // Check for Urdu Izafat (e.g. تاجدارِ -> Tajdar-e)
  const hasIzafat = /[\u0650]/.test(word);
  const clean = word.replace(/[\u0640\u064B-\u065F\u0670]/g, "");

  if (LEXICON[clean]) {
    return LEXICON[clean] + (hasIzafat ? "-e" : "");
  }

  // Common Urdu prefixes: e.g. بے-something -> be-something
  if (clean.startsWith("بے") && clean.length > 2) {
    const rest = clean.slice(2);
    return "be-" + transliterateUrduWord(rest);
  }

  // Character transliteration with natural short vowel insertion between consonant clusters
  let res = "";
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const letter = URDU_LETTERS[ch] !== undefined ? URDU_LETTERS[ch] : ch;
    res += letter;

    // Vowel heuristic: If consonant followed by consonant (and neither is a long vowel)
    const isVowel = (c: string) => ["ا", "آ", "و", "ی", "ے", "ئ"].includes(c);
    const nextCh = clean[i + 1];
    if (nextCh && !isVowel(ch) && !isVowel(nextCh) && i === 0 && clean.length <= 4) {
      // Insert short 'a' (e.g. bdl -> badal, chla -> chala, pta -> pata, drte -> darte)
      res += "a";
    }
  }

  if (hasIzafat) res += "-e";
  return matchCase(word, res);
}

function matchCase(source: string, target: string): string {
  if (!target) return "";
  return target;
}

// ============================================================================
// Public Exports
// ============================================================================

/** Detects if the string contains Indic (Devanagari/Gurmukhi) or Urdu/Arabic script */
export function hasNonLatin(text: string): boolean {
  return /[\u0900-\u097F\u0600-\u06FF\u0A00-\u0A7F]/.test(text);
}

/**
 * Detects if any lyric lines contain non-Latin scripts (Indic, Urdu, CJK, etc.)
 * that can be transliterated or romanized.
 */
export function canTransliterateLyrics(lines: LyricLine[]): boolean {
  const NON_LATIN_REGEX = /[\u0600-\u06FF\u0750-\u077F\u0900-\u097F\u0A00-\u0A7F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/;
  return lines.some((l) => NON_LATIN_REGEX.test(l.text) || l.words.some((w) => NON_LATIN_REGEX.test(w.text)));
}

/** Transliterates a single token/word */
export function transliterateWord(token: string): string {
  // Handle hyphenated words (e.g. बे-फ़िज़ूल, कभी-कभी, dil-e-jaan)
  if (token.includes("-")) {
    return token.split("-").map(transliterateWord).join("-");
  }

  const match = token.match(/^([^\p{L}\p{M}]*)([\p{L}\p{M}]+)([^\p{L}\p{M}]*)$/u);
  if (!match) return token;

  const [, rawLeading, word, rawTrailing] = match;
  // Convert Arabic punctuation in leading/trailing
  const leading = rawLeading.replace(/[،؟؛۔]/g, (p) => URDU_PUNCTUATION[p] || p);
  const trailing = rawTrailing.replace(/[،؟؛۔]/g, (p) => URDU_PUNCTUATION[p] || p);

  let converted = word;

  if (/[\u0900-\u097F]/.test(word)) {
    converted = transliterateDevanagariWord(word);
  } else if (/[\u0600-\u06FF]/.test(word)) {
    converted = transliterateUrduWord(word);
  }

  return leading + converted + trailing;
}

/** Transliterates a full line of text */
export function transliterateText(text: string): string {
  if (!hasNonLatin(text)) return text;
  // Convert Arabic punctuation
  const cleanPunct = text.replace(/[،؟؛۔]/g, (p) => URDU_PUNCTUATION[p] || p);
  return cleanPunct.replace(/[\p{L}\p{M}-]+|[^\p{L}\p{M}\s-]+|\s+/gu, (token) => {
    if (/^\s+$/.test(token) || /^[^\p{L}\p{M}]+$/u.test(token)) return token;
    return transliterateWord(token);
  });
}

/**
 * Transliterates an entire LyricLine into Hinglish/Roman Urdu, preserving
 * 100% of word timing stamps, emphasis, and backing vocal tags.
 */
export function transliterateLine(line: LyricLine): LyricLine {
  if (!hasNonLatin(line.text) && !line.words.some((w) => hasNonLatin(w.text))) {
    return line;
  }

  const words: LyricWord[] = line.words.map((w) => ({
    ...w,
    text: transliterateWord(w.text),
  }));

  return {
    ...line,
    text: transliterateText(line.text),
    words,
    lang: line.lang === "hi" || line.lang === "other" ? "en" : line.lang,
    sub: line.sub ? transliterateText(line.sub) : undefined,
  };
}

/**
 * Checks if the song contains scripts that benefit from contextual AI romanization:
 * - Perso-Arabic Urdu (\u0600-\u06FF)
 * - Chinese Hanzi / Japanese Kanji (\u4E00-\u9FFF)
 * - Japanese Kana (\u3040-\u30FF)
 * - Korean Hangul (\uAC00-\uD7AF)
 */
export function needsAIRomanization(lines: LyricLine[]): boolean {
  const COMPLEX_REGEX = /[\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;
  return lines.some((l) => COMPLEX_REGEX.test(l.text) || l.words.some((w) => COMPLEX_REGEX.test(w.text)));
}

/**
 * Aligns AI-romanized text back with original line timing stamps.
 */
export function applyAIRomanization(lines: LyricLine[], aiLines: string[]): LyricLine[] {
  if (!aiLines || aiLines.length !== lines.length) {
    return lines.map(transliterateLine);
  }
  return lines.map((line, idx) => {
    const aiText = aiLines[idx];
    if (!aiText || !aiText.trim()) return transliterateLine(line);

    const aiTokens = aiText.trim().split(/\s+/).filter(Boolean);
    const origWords = line.words;

    let words: LyricWord[];
    if (aiTokens.length === origWords.length) {
      // 1:1 match: keep exact timestamps!
      words = origWords.map((w, wIdx) => ({
        ...w,
        text: aiTokens[wIdx],
      }));
    } else if (origWords.length > 0) {
      // Proportionally interpolate timestamps across the line's span
      const start = origWords[0].start;
      const end = origWords[origWords.length - 1].end;
      const span = Math.max(0.4, end - start);
      const step = span / aiTokens.length;

      words = aiTokens.map((text, wIdx) => ({
        text,
        start: start + wIdx * step,
        end: start + (wIdx + 1) * step,
      }));
    } else {
      words = [];
    }

    return {
      ...line,
      text: aiText,
      words,
      lang: "en",
    };
  });
}
