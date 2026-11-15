export interface NormalizedRawMaterialSpec {
  key: string;
  name_ar: string;
  name_en: string;
  unit: string;
  min_level: number;
  cost: number;
}

export interface DefaultRecipeIngredientSpec {
  materialKey: string;
  weight: number;
  unit: string;
  optional?: boolean;
  waste_percent?: number;
  notes?: string;
}

export interface DefaultMenuRecipeSpec {
  menuItemNameAr: string;
  requires_oven: boolean;
  prep_instructions: string;
  allergens: string[];
  ingredients: DefaultRecipeIngredientSpec[];
}

export const NORMALIZED_RAW_MATERIALS: NormalizedRawMaterialSpec[] = [
  { key: "flour", name_ar: "دقيق بيتزا", name_en: "Pizza Flour", unit: "kg", min_level: 5, cost: 28 },
  { key: "mozzarella", name_ar: "جبنة موزاريلا", name_en: "Mozzarella Cheese", unit: "kg", min_level: 2, cost: 145 },
  { key: "cheddar", name_ar: "جبنة شيدر", name_en: "Cheddar Cheese", unit: "kg", min_level: 1, cost: 165 },
  { key: "tomato_sauce", name_ar: "صلصة طماطم بيتزا", name_en: "Pizza Tomato Sauce", unit: "kg", min_level: 2, cost: 40 },
  { key: "fresh_tomato", name_ar: "طماطم طازجة", name_en: "Fresh Tomato", unit: "kg", min_level: 3, cost: 18 },
  { key: "bell_pepper", name_ar: "فلفل رومي", name_en: "Bell Pepper", unit: "kg", min_level: 1, cost: 25 },
  { key: "onion", name_ar: "بصل طازج", name_en: "Fresh Onion", unit: "kg", min_level: 2, cost: 15 },
  { key: "olives", name_ar: "زيتون أسود شرائح", name_en: "Sliced Black Olives", unit: "kg", min_level: 1, cost: 90 },
  { key: "mushroom", name_ar: "مشروم طازج", name_en: "Fresh Mushroom", unit: "kg", min_level: 1, cost: 110 },
  { key: "pepperoni", name_ar: "بيبروني بقري", name_en: "Beef Pepperoni", unit: "kg", min_level: 1, cost: 260 },
  { key: "minced_beef", name_ar: "لحم مفروم", name_en: "Minced Beef", unit: "kg", min_level: 4, cost: 240 },
  { key: "chicken_breast", name_ar: "دجاج", name_en: "Chicken Breast", unit: "kg", min_level: 5, cost: 150 },
  { key: "burger_bun", name_ar: "خبز برجر", name_en: "Burger Bun", unit: "pcs", min_level: 20, cost: 4 },
  { key: "saj_bread", name_ar: "عيش صاج / شاورما", name_en: "Saj Flatbread", unit: "pcs", min_level: 20, cost: 3 },
  { key: "potatoes", name_ar: "بطاطس", name_en: "Potatoes", unit: "kg", min_level: 5, cost: 22 },
  { key: "lettuce", name_ar: "خس كابوتشا", name_en: "Iceberg Lettuce", unit: "kg", min_level: 1, cost: 25 },
  { key: "cucumber", name_ar: "خيار طازج", name_en: "Fresh Cucumber", unit: "kg", min_level: 1, cost: 20 },
  { key: "feta_cheese", name_ar: "جبنة فيتا", name_en: "Feta Cheese", unit: "kg", min_level: 1, cost: 130 },
  { key: "chickpeas", name_ar: "حمص مسلوق", name_en: "Boiled Chickpeas", unit: "kg", min_level: 2, cost: 55 },
  { key: "eggplant", name_ar: "باذنجان مشوي", name_en: "Roasted Eggplant", unit: "kg", min_level: 2, cost: 24 },
  { key: "tahini", name_ar: "طحينة سمسم", name_en: "Sesame Tahini", unit: "kg", min_level: 1, cost: 120 },
  { key: "olive_oil", name_ar: "زيت زيتون", name_en: "Olive Oil", unit: "l", min_level: 1, cost: 220 },
  { key: "frying_oil", name_ar: "زيت قلى نباتي", name_en: "Vegetable Frying Oil", unit: "l", min_level: 3, cost: 65 },
  { key: "caesar_dressing", name_ar: "صوص سيزر ومايونيز", name_en: "Caesar Dressing", unit: "kg", min_level: 1, cost: 95 },
  { key: "coca_cola", name_ar: "كوكاكولا", name_en: "Coca Cola Can", unit: "can", min_level: 12, cost: 10 },
  { key: "fresh_orange", name_ar: "برتقال للعصير", name_en: "Fresh Orange", unit: "kg", min_level: 3, cost: 20 },
  { key: "tea_leaves", name_ar: "شاي أسود فاخر", name_en: "Black Tea", unit: "kg", min_level: 0.5, cost: 240 },
  { key: "fresh_mint", name_ar: "نعناع طازج", name_en: "Fresh Mint", unit: "kg", min_level: 0.5, cost: 40 },
  { key: "turkish_coffee", name_ar: "بن قهوة تركي", name_en: "Turkish Coffee", unit: "kg", min_level: 0.5, cost: 380 },
  { key: "sugar", name_ar: "سكر أبيض", name_en: "White Sugar", unit: "kg", min_level: 2, cost: 32 },
  { key: "konafa_dough", name_ar: "عجينة كنافة", name_en: "Konafa Dough", unit: "kg", min_level: 2, cost: 50 },
  { key: "cream", name_ar: "قشطة بلدي", name_en: "Fresh Cream", unit: "kg", min_level: 1, cost: 140 },
  { key: "ghee", name_ar: "سمن طبيعي", name_en: "Pure Ghee", unit: "kg", min_level: 1, cost: 190 },
  { key: "milk", name_ar: "حليب طازج", name_en: "Fresh Milk", unit: "l", min_level: 3, cost: 35 },
  { key: "semolina", name_ar: "سميد بسبوسة", name_en: "Semolina", unit: "kg", min_level: 2, cost: 38 },
  { key: "puff_pastry", name_ar: "رقائق جلاش / ميل فاي", name_en: "Pastry Flakes", unit: "kg", min_level: 1, cost: 70 },
  { key: "syrup", name_ar: "شربات حلويات (قطر)", name_en: "Sugar Syrup", unit: "l", min_level: 2, cost: 30 },
  { key: "water_bottle", name_ar: "مياه معدنية صغيرة", name_en: "Bottled Water", unit: "bottle", min_level: 12, cost: 5 },
  { key: "ice", name_ar: "مكعبات ثلج نقي", name_en: "Ice Cubes", unit: "kg", min_level: 2, cost: 5 },
];

export const DEFAULT_MENU_RECIPES: DefaultMenuRecipeSpec[] = [
  {
    menuItemNameAr: "بيتزا سوبر سوبريم",
    requires_oven: true,
    prep_instructions:
      "تفرد كرة العجين 220 جم، تُدهن بصلصة الطماطم، ثم تضاف شرائح البيبروني واللحم والفلفل والزيتون والمشروم وتغطى بالموزاريلا. تُخبز في الفرن على حرارة 280°م لمدة 7-9 دقائق.",
    allergens: ["غلوتين (قمح)", "ألبان"],
    ingredients: [
      { materialKey: "flour", weight: 220, unit: "g" },
      { materialKey: "tomato_sauce", weight: 80, unit: "g" },
      { materialKey: "mozzarella", weight: 140, unit: "g" },
      { materialKey: "minced_beef", weight: 60, unit: "g" },
      { materialKey: "pepperoni", weight: 40, unit: "g" },
      { materialKey: "bell_pepper", weight: 35, unit: "g", optional: true },
      { materialKey: "onion", weight: 25, unit: "g", optional: true },
      { materialKey: "olives", weight: 25, unit: "g", optional: true },
      { materialKey: "mushroom", weight: 30, unit: "g", optional: true },
    ],
  },
  {
    menuItemNameAr: "بيتزا مارجريتا",
    requires_oven: true,
    prep_instructions:
      "تفرد كرة العجين 220 جم، تُغطى بصلصة الطماطم الإيطالية وجبنة الموزاريلا وزيت الزيتون وتُخبز في الفرن لمدة 6-8 دقائق حتى يذوب الجبن وتحمر الأطراف.",
    allergens: ["غلوتين (قمح)", "ألبان"],
    ingredients: [
      { materialKey: "flour", weight: 220, unit: "g" },
      { materialKey: "tomato_sauce", weight: 90, unit: "g" },
      { materialKey: "mozzarella", weight: 150, unit: "g" },
      { materialKey: "olive_oil", weight: 10, unit: "ml" },
    ],
  },
  {
    menuItemNameAr: "بيتزا بيبروني",
    requires_oven: true,
    prep_instructions:
      "تفرد كرة العجين 220 جم، تضاف صلصة الطماطم وجبنة الموزاريلا وتُوزع شرائح البيبروني البقري بانتظام ثم تُخبز بالفرن لمدة 7-8 دقائق.",
    allergens: ["غلوتين (قمح)", "ألبان"],
    ingredients: [
      { materialKey: "flour", weight: 220, unit: "g" },
      { materialKey: "tomato_sauce", weight: 80, unit: "g" },
      { materialKey: "mozzarella", weight: 140, unit: "g" },
      { materialKey: "pepperoni", weight: 70, unit: "g" },
    ],
  },
  {
    menuItemNameAr: "برجر لحم فاخر",
    requires_oven: false,
    prep_instructions:
      "تُشوى قطعة اللحم (180 جم) على الجريل 4 دقائق لكل وجه مع شريحة الشيدر، ويُحمص الخبز ويُرص الخس والطماطم والبصل والصوص حسب رغبة العميل.",
    allergens: ["غلوتين (قمح)", "ألبان", "سمسم"],
    ingredients: [
      { materialKey: "minced_beef", weight: 180, unit: "g" },
      { materialKey: "burger_bun", weight: 1, unit: "pcs" },
      { materialKey: "cheddar", weight: 30, unit: "g" },
      { materialKey: "lettuce", weight: 25, unit: "g", optional: true },
      { materialKey: "fresh_tomato", weight: 30, unit: "g", optional: true },
      { materialKey: "onion", weight: 20, unit: "g", optional: true },
    ],
  },
  {
    menuItemNameAr: "برجر دجاج مقرمش",
    requires_oven: false,
    prep_instructions:
      "تُقلى شريحة الدجاج المتبلة حتى النضج الذهبي وتوضع في خبز البرجر المحمص مع الجبنة الشيدر والخس والمايونيز.",
    allergens: ["غلوتين (قمح)", "ألبان", "بيض"],
    ingredients: [
      { materialKey: "chicken_breast", weight: 160, unit: "g" },
      { materialKey: "burger_bun", weight: 1, unit: "pcs" },
      { materialKey: "cheddar", weight: 25, unit: "g" },
      { materialKey: "lettuce", weight: 25, unit: "g", optional: true },
      { materialKey: "frying_oil", weight: 25, unit: "ml" },
      { materialKey: "caesar_dressing", weight: 25, unit: "g" },
    ],
  },
  {
    menuItemNameAr: "ساندويتش شاورما",
    requires_oven: false,
    prep_instructions:
      "يُقطع الدجاج المشوي شرائح رفيعة ويُلف في خبز الصاج مع الطحينة والخس والطماطم والبصل ثم يُكبس على التوستر حتى يتحمص.",
    allergens: ["غلوتين (قمح)", "سمسم"],
    ingredients: [
      { materialKey: "chicken_breast", weight: 150, unit: "g" },
      { materialKey: "saj_bread", weight: 1, unit: "pcs" },
      { materialKey: "tahini", weight: 25, unit: "g" },
      { materialKey: "fresh_tomato", weight: 30, unit: "g", optional: true },
      { materialKey: "onion", weight: 20, unit: "g", optional: true },
    ],
  },
  {
    menuItemNameAr: "مشاوي مشكل",
    requires_oven: true,
    prep_instructions:
      "تُشوى أسياخ الكباب وقطع الدجاج على الفحم لمدة 12-15 دقيقة وتُقدم فوق خبز مشوي مع البصل والطماطم المشوية.",
    allergens: ["غلوتين (تقديم مع خبز)", "سمسم (طحينة جانبية)"],
    ingredients: [
      { materialKey: "minced_beef", weight: 200, unit: "g" },
      { materialKey: "chicken_breast", weight: 180, unit: "g" },
      { materialKey: "fresh_tomato", weight: 60, unit: "g" },
      { materialKey: "onion", weight: 50, unit: "g" },
      { materialKey: "saj_bread", weight: 1, unit: "pcs" },
    ],
  },
  {
    menuItemNameAr: "كباب لحم",
    requires_oven: true,
    prep_instructions:
      "تُتبل الكفتة والكباب بالبصل وتُشوى على الفحم الساخن مع التقليب المستمر لمدة 10-12 دقيقة حتى تنضج مع احتفاظها بالعصارة.",
    allergens: ["غلوتين (خبز التقديم)"],
    ingredients: [
      { materialKey: "minced_beef", weight: 250, unit: "g" },
      { materialKey: "onion", weight: 40, unit: "g" },
      { materialKey: "fresh_tomato", weight: 50, unit: "g" },
      { materialKey: "saj_bread", weight: 1, unit: "pcs" },
    ],
  },
  {
    menuItemNameAr: "فراخ مشوية",
    requires_oven: true,
    prep_instructions:
      "تُشوى صدور/أنصاف الدجاج المتبلة في الفرن أو الفحم لمدة 18-22 دقيقة مع التحمير النهائي للجلد.",
    allergens: [],
    ingredients: [
      { materialKey: "chicken_breast", weight: 300, unit: "g" },
      { materialKey: "fresh_tomato", weight: 40, unit: "g" },
      { materialKey: "onion", weight: 35, unit: "g" },
      { materialKey: "olive_oil", weight: 10, unit: "ml" },
    ],
  },
  {
    menuItemNameAr: "سلطة سيزر بالدجاج",
    requires_oven: false,
    prep_instructions:
      "يُقطع الخس الطازج ويُخلط مع صوص السيزر ثم يُزين بشرائح الدجاج المشوي الساخن والخبز المحمص.",
    allergens: ["بيض", "ألبان", "غلوتين"],
    ingredients: [
      { materialKey: "lettuce", weight: 120, unit: "g" },
      { materialKey: "chicken_breast", weight: 100, unit: "g" },
      { materialKey: "caesar_dressing", weight: 40, unit: "g" },
      { materialKey: "saj_bread", weight: 0.5, unit: "pcs", optional: true },
    ],
  },
  {
    menuItemNameAr: "سلطة يونانية",
    requires_oven: false,
    prep_instructions:
      "تُقطع مكعبات الخيار والطماطم والفلفل وتُضاف حلقات الزيتون والبصل وجبنة الفيتا وزيت الزيتون البكر.",
    allergens: ["ألبان (جبنة فيتا)"],
    ingredients: [
      { materialKey: "fresh_tomato", weight: 80, unit: "g" },
      { materialKey: "cucumber", weight: 80, unit: "g" },
      { materialKey: "bell_pepper", weight: 40, unit: "g" },
      { materialKey: "onion", weight: 20, unit: "g", optional: true },
      { materialKey: "olives", weight: 30, unit: "g" },
      { materialKey: "feta_cheese", weight: 50, unit: "g" },
      { materialKey: "olive_oil", weight: 15, unit: "ml" },
    ],
  },
  {
    menuItemNameAr: "حمص بالطحينة",
    requires_oven: false,
    prep_instructions:
      "يُهرس الحمص المسلوق ناعماً مع الطحينة وزيت الزيتون ويُفرد في طبق التقديم.",
    allergens: ["سمسم"],
    ingredients: [
      { materialKey: "chickpeas", weight: 140, unit: "g" },
      { materialKey: "tahini", weight: 40, unit: "g" },
      { materialKey: "olive_oil", weight: 15, unit: "ml" },
    ],
  },
  {
    menuItemNameAr: "بابا غنوج",
    requires_oven: false,
    prep_instructions:
      "يُخلط الباذنجان المشوي المصفى مع الطحينة وزيت الزيتون والطماطم المفرومة ناعماً.",
    allergens: ["سمسم"],
    ingredients: [
      { materialKey: "eggplant", weight: 150, unit: "g" },
      { materialKey: "tahini", weight: 35, unit: "g" },
      { materialKey: "olive_oil", weight: 15, unit: "ml" },
      { materialKey: "fresh_tomato", weight: 25, unit: "g" },
    ],
  },
  {
    menuItemNameAr: "بطاطس مقلية",
    requires_oven: false,
    prep_instructions:
      "تُقلى أصابع البطاطس في زيت ساخن بدرجة 175°م لمدة 4 دقائق حتى تصبح مقرمشة وذهبية.",
    allergens: [],
    ingredients: [
      { materialKey: "potatoes", weight: 220, unit: "g" },
      { materialKey: "frying_oil", weight: 25, unit: "ml" },
    ],
  },
  {
    menuItemNameAr: "كوكاكولا",
    requires_oven: false,
    prep_instructions: "تُقدم مبردة من الثلاجة (4°م) مع كوب وثلج حسب اختيار العميل.",
    allergens: [],
    ingredients: [{ materialKey: "coca_cola", weight: 1, unit: "can" }],
  },
  {
    menuItemNameAr: "عصير برتقال طازج",
    requires_oven: false,
    prep_instructions: "يُعصر البرتقال الطازج فوراً ويُصفى ويُقدم بارداً مع ثلج اختياري.",
    allergens: [],
    ingredients: [
      { materialKey: "fresh_orange", weight: 350, unit: "g" },
      { materialKey: "sugar", weight: 15, unit: "g", optional: true },
    ],
  },
  {
    menuItemNameAr: "شاي بالنعناع",
    requires_oven: false,
    prep_instructions: "يُغلى الماء وتُضاف أوراق الشاي والنعناع الطازج ويُقدم مع السكر حسب الطلب.",
    allergens: [],
    ingredients: [
      { materialKey: "tea_leaves", weight: 4, unit: "g" },
      { materialKey: "fresh_mint", weight: 6, unit: "g" },
      { materialKey: "sugar", weight: 15, unit: "g", optional: true },
    ],
  },
  {
    menuItemNameAr: "قهوة تركي",
    requires_oven: false,
    prep_instructions: "تُعد في الكنكة على نار هادئة حتى تكوّن الوش مع مقدار السكر المختار (سادة/مضبوط/زيادة).",
    allergens: [],
    ingredients: [
      { materialKey: "turkish_coffee", weight: 12, unit: "g" },
      { materialKey: "sugar", weight: 10, unit: "g", optional: true },
    ],
  },
  {
    menuItemNameAr: "كنافة بالقشطة",
    requires_oven: true,
    prep_instructions:
      "تُحشى الكنافة بالقشطة الطازجة وتُسقى بالسمن وتُخبز في الفرن حتى الاحمرار ثم يُصب الشربات الدافئ.",
    allergens: ["غلوتين (قمح)", "ألبان"],
    ingredients: [
      { materialKey: "konafa_dough", weight: 120, unit: "g" },
      { materialKey: "cream", weight: 80, unit: "g" },
      { materialKey: "ghee", weight: 25, unit: "g" },
      { materialKey: "syrup", weight: 40, unit: "ml" },
    ],
  },
  {
    menuItemNameAr: "أم علي",
    requires_oven: true,
    prep_instructions:
      "تُوضع الرقائق في الطاجن ويُضاف الحليب المغلي والقشطة وتُدخل الفرن تحت الشواية لمدة 8 دقائق للتحمير.",
    allergens: ["غلوتين (قمح)", "ألبان"],
    ingredients: [
      { materialKey: "puff_pastry", weight: 90, unit: "g" },
      { materialKey: "milk", weight: 200, unit: "ml" },
      { materialKey: "cream", weight: 50, unit: "g" },
      { materialKey: "sugar", weight: 25, unit: "g" },
    ],
  },
  {
    menuItemNameAr: "بسبوسة",
    requires_oven: true,
    prep_instructions:
      "تُخبز صينية السميد بالسمن حتى تكتسب لوناً ذهبياً ثم تُسقى بالشربات الساخن وتُقطع.",
    allergens: ["غلوتين (قمح)", "ألبان"],
    ingredients: [
      { materialKey: "semolina", weight: 110, unit: "g" },
      { materialKey: "ghee", weight: 25, unit: "g" },
      { materialKey: "milk", weight: 40, unit: "ml" },
      { materialKey: "sugar", weight: 20, unit: "g" },
      { materialKey: "syrup", weight: 40, unit: "ml" },
    ],
  },
  {
    menuItemNameAr: "مياه معدنية",
    requires_oven: false,
    prep_instructions: "تُقدم زجاجة المياه حسب درجة الحرارة المطلوبة (باردة / درجة الغرفة / ساخنة) ومع كوب أو ثلج حسب الطلب.",
    allergens: [],
    ingredients: [{ materialKey: "water_bottle", weight: 1, unit: "bottle" }],
  },
];

// Fallback matchers for local default menu items (e.g. item-1..item-8)
const NAME_ALIASES: Array<[RegExp, string]> = [
  [/مارجريتا|margherita/i, "بيتزا مارجريتا"],
  [/سوبر|سوبريم|supreme/i, "بيتزا سوبر سوبريم"],
  [/بيبروني|pepperoni/i, "بيتزا بيبروني"],
  [/برجر.*لحم|beef.*burger|تشيز برجر|كلاسيك/i, "برجر لحم فاخر"],
  [/برجر.*دجاج|chicken.*burger|مقرمش/i, "برجر دجاج مقرمش"],
  [/شاورما|shawarma/i, "ساندويتش شاورما"],
  [/مشاوي مشكل|mixed.*grill/i, "مشاوي مشكل"],
  [/كباب|kebab/i, "كباب لحم"],
  [/فراخ مشوية|دجاج مشوي|grilled.*chicken/i, "فراخ مشوية"],
  [/سيزر|caesar/i, "سلطة سيزر بالدجاج"],
  [/يونانية|greek/i, "سلطة يونانية"],
  [/حمص|hummus/i, "حمص بالطحينة"],
  [/بابا غنوج|baba/i, "بابا غنوج"],
  [/بطاطس|fries/i, "بطاطس مقلية"],
  [/كولا|كوكاكولا|بيبسي|cola|pepsi/i, "كوكاكولا"],
  [/برتقال|عصير|orange|juice/i, "عصير برتقال طازج"],
  [/شاي|نعناع|tea/i, "شاي بالنعناع"],
  [/قهوة|كابتشينو|اسبريسو|coffee/i, "قهوة تركي"],
  [/كنافة|konafa/i, "كنافة بالقشطة"],
  [/أم علي|ام علي|om ali/i, "أم علي"],
  [/بسبوسة|basbousa/i, "بسبوسة"],
  [/ماء|مياه|water/i, "مياه معدنية"],
];

export function getDefaultRecipeSpecByName(nameAr?: string | null): DefaultMenuRecipeSpec | null {
  const clean = String(nameAr || "").trim();
  if (!clean) return null;

  const exact = DEFAULT_MENU_RECIPES.find((r) => r.menuItemNameAr === clean);
  if (exact) return exact;

  for (const [pattern, targetName] of NAME_ALIASES) {
    if (pattern.test(clean)) {
      return DEFAULT_MENU_RECIPES.find((r) => r.menuItemNameAr === targetName) || null;
    }
  }
  return null;
}

export function getRawMaterialSpec(key: string): NormalizedRawMaterialSpec | undefined {
  return NORMALIZED_RAW_MATERIALS.find((m) => m.key === key);
}
