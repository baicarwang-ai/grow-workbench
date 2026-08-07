/* =========================================================================
 * 个人成长工作台 · 数据层
 * 更新日期：2026-08-07（首次搭建）
 * 说明：营养数值为估算值（每份/每人份），实际以称量为准；视频链接均指向公开平台。
 * ========================================================================= */

const DATA_VERSION = "1.0.0";
const DATA_UPDATED = "2026-08-07";

/* ---------------- 个人档案（初始值，可在应用内修改） ---------------- */
const DEFAULT_PROFILE = {
  name: "我",
  heightCm: 178,
  weightKg: 95,          // 190 斤
  bodyFat: 30,           // 30%
  targetWeightKg: 85,    // 170 斤
  waterTargetMl: 2500,
  exerciseDaysPerWeek: 5,
};

/* ---------------- 科学依据（数据来源） ---------------- */
const SCIENCE = [
  {
    title: "热量缺口 300–500 kcal/天，每周减重约 0.5–1 kg",
    detail: "持续、温和的热量缺口最有利于保留肌肉并长期坚持；缺口过大反而导致代谢下降、反弹。",
    source: "无锡市第九人民医院科普；山西中西医结合医院《体重管理原则》",
    url: "http://www.wuxi9h.com/MZFW/kepuwenzhang/17227.html",
  },
  {
    title: "减脂期蛋白质：每公斤体重 1.2–2.0 g",
    detail: "北京协和医院建议减重期每公斤体重摄入 1.2–1.5 g 蛋白质（占总能量 20–30%）；Examine 与 ISSN 研究表明减脂期 1.6–2.4 g/kg 更利于保留瘦体重。你的体重 95 kg → 建议每日约 115–150 g 蛋白质。",
    source: "北京协和医院《肥胖症患者怎么吃》；Examine.com；Women's Health/ISSN",
    url: "https://www.pumch.cn/detail/40864.html",
  },
  {
    title: "中国居民膳食指南（2022）平衡膳食八准则",
    detail: "食物多样、合理搭配；吃动平衡；多吃蔬果奶类全谷大豆；适量吃鱼禽蛋瘦肉；少盐少油控糖限酒；规律进餐、足量饮水；会烹会选、会看标签；公筷分餐、杜绝浪费。",
    source: "中国营养学会《中国居民膳食指南（2022）》",
    url: "http://dg.cnsoc.org/article/04/J4-AsD_DR3OLQMnHG0-jZA.html",
  },
  {
    title: "饮水：健康成人每日约需 2500 ml（含食物水约 1000 ml）",
    detail: "WHO 建议成人每日约 2000–2500 ml；中国居民膳食指南建议每日饮水 1500–1700 ml（不含食物水），运动/减脂期需额外补充。你设定的 2500 ml 适合训练日，按 250 ml/杯 ≈ 10 杯。",
    source: "WHO（转引自沈阳市疾控中心）；山西省卫健委；中国居民膳食指南",
    url: "http://www.syscdc.org.cn/news/detail/1369",
  },
  {
    title: "睡眠 7–9 小时：睡不够会胖",
    detail: "睡眠医学会推荐成人每晚 7–9 小时；睡少于 6 小时肥胖风险高约 30%。热量限制下睡眠 5.5h 组比 8.5h 组减脂更少、肌肉流失更多。",
    source: "美国睡眠医学会（转引自大众健康报）；临床营养研究",
    url: "http://paper.dzjkb.org.cn/article/36314/25095.html",
  },
  {
    title: "ACSM：每周 ≥150 分钟中等强度有氧 + 每周 ≥2 次力量训练",
    detail: "美国运动医学会指南：成人每周 150–300 分钟中等强度活动（或 75–150 分钟高强度），外加每周至少 2 次覆盖主要肌群的力量训练。",
    source: "美国运动医学会 ACSM Physical Activity Guidelines",
    url: "https://acsm.org/education-resources/trending-topics-resources/physical-activity-guidelines/",
  },
  {
    title: "新手力量训练：渐进超负荷 + 2–3 RIR（保留 2–3 次余力）",
    detail: "新手以动作标准为先，RPE 5–6 / 保留 2–3 次余力，以周为单位逐步增加重量或次数；避免每次练到力竭。",
    source: "Yahoo奇摩运动/RM·RPE·RIR 指南；Gymbeginner 增肌训练概念",
    url: "https://tw.sports.yahoo.com/news/%E4%BB%80%E9%BA%BC%E6%98%AFrm%E3%80%81rpe%E3%80%81rir%EF%BC%9F%E6%96%B0%E6%89%8B%E8%A9%B2%E6%80%8E%E9%BA%BC%E5%BE%9E%E9%80%99%E4%BA%9B%E6%95%B8%E5%80%BC%E6%89%BE%E5%88%B0%E9%81%A9%E5%90%88%E8%87%AA%E5%B7%B1%E7%9A%84%E9%87%8D%E9%87%8F%EF%BC%9F-125909276.html",
  },
  {
    title: "谭成义健身教程（B 站）",
    detail: "B 站健身教学博主，以「保姆级私教视角」讲解肩、背等部位动作细节与发力要点，适合新手。本工作台已单独建「谭成义教程库」。",
    source: "哔哩哔哩 · 谭成义个人空间",
    url: "https://m.bilibili.com/space/521903482",
  },
];

/* ---------------- 菜谱库 ----------------
 * category: breakfast / lunch / dinner / snack
 * nutrition 为估算值（每人份）
 * image 为空时应用内使用 emoji 占位图
 */
const RECIPES = [
  /* ===== 早餐 ===== */
  {
    id: "b01", name: "香蕉燕麦牛奶杯", category: "breakfast", emoji: "🥣",
    image: "img/recipes/b01.svg", time: "8分钟", difficulty: "简单", servings: 1,
    tags: ["高纤维", "快手", "无油"], season: ["全年"],
    ingredients: ["即食燕麦 40g", "牛奶 250ml", "香蕉 1根", "混合坚果 10g", "奇亚籽 5g"],
    steps: ["燕麦加牛奶小火煮 3 分钟（或微波 2 分钟）成糊", "香蕉切片，一半拌入粥中", "装碗后铺上剩余香蕉、坚果与奇亚籽"],
    nutrition: { kcal: 480, protein: 16, carbs: 68, fat: 16, fiber: 9 },
    source: "自研，依据膳食指南搭配",
  },
  {
    id: "b02", name: "全麦鸡蛋三明治+牛奶", category: "breakfast", emoji: "🥪",
    image: "img/recipes/b02.svg", time: "10分钟", difficulty: "简单", servings: 1,
    tags: ["高蛋白", "快手"], season: ["全年"],
    ingredients: ["全麦面包 2片", "鸡蛋 2个", "生菜 2片", "西红柿 半个", "低脂牛奶 250ml"],
    steps: ["鸡蛋打散，少油煎成厚蛋饼", "面包稍微烘烤", "依次夹入生菜、番茄片、蛋饼", "配一杯牛奶"],
    nutrition: { kcal: 430, protein: 28, carbs: 44, fat: 15, fiber: 7 },
    source: "自研",
  },
  {
    id: "b03", name: "紫薯鸡蛋酸奶碗", category: "breakfast", emoji: "🍠",
    image: "img/recipes/b03.svg", time: "15分钟", difficulty: "简单", servings: 1,
    tags: ["高纤", "饱腹"], season: ["秋冬"],
    ingredients: ["紫薯 150g", "无糖希腊酸奶 150g", "水煮蛋 1个", "蓝莓/草莓 60g", "南瓜籽 8g"],
    steps: ["紫薯蒸熟压成泥铺底", "倒入希腊酸奶", "摆上切半的水煮蛋与莓果", "撒南瓜籽"],
    nutrition: { kcal: 410, protein: 24, carbs: 58, fat: 9, fiber: 10 },
    source: "自研",
  },
  {
    id: "b04", name: "菠菜鸡蛋全麦卷饼", category: "breakfast", emoji: "🌯",
    image: "img/recipes/b04.svg", time: "12分钟", difficulty: "简单", servings: 1,
    tags: ["高蛋白", "快手"], season: ["全年"],
    ingredients: ["全麦卷饼 1张", "鸡蛋 2个", "菠菜 80g", "低脂芝士片 1片", "黑胡椒/盐 少许"],
    steps: ["鸡蛋打散，菠菜焯水切碎拌入蛋液", "少油摊成蛋饼", "卷饼放平，铺蛋饼和芝士，卷起", "平底锅无油两面烘 1 分钟定型"],
    nutrition: { kcal: 390, protein: 26, carbs: 40, fat: 14, fiber: 6 },
    source: "自研",
  },
  {
    id: "b05", name: "中式能量早餐组合", category: "breakfast", emoji: "🥟",
    image: "img/recipes/b05.svg", time: "12分钟", difficulty: "简单", servings: 1,
    tags: ["中式", "快手"], season: ["全年"],
    ingredients: ["无糖豆浆 300ml", "玉米 1根", "水煮蛋 1个", "小番茄 6颗", "核桃 2个"],
    steps: ["玉米蒸/煮 10 分钟", "鸡蛋煮熟", "搭配豆浆、小番茄与核桃即可"],
    nutrition: { kcal: 420, protein: 22, carbs: 52, fat: 14, fiber: 8 },
    source: "自研",
  },
  {
    id: "b06", name: "隔夜燕麦酸奶杯", category: "breakfast", emoji: "🫙",
    image: "img/recipes/b06.svg", time: "5分钟+冷藏", difficulty: "简单", servings: 1,
    tags: ["免煮", "高纤"], season: ["夏季"],
    ingredients: ["即食燕麦 40g", "无糖酸奶 200g", "牛奶 80ml", "蓝莓 50g", "亚麻籽粉 5g"],
    steps: ["燕麦+酸奶+牛奶拌匀装罐", "冷藏过夜（至少 4 小时）", "早晨取出，铺蓝莓与亚麻籽粉"],
    nutrition: { kcal: 380, protein: 18, carbs: 55, fat: 9, fiber: 8 },
    source: "自研",
  },
  {
    id: "b07", name: "蔬菜鸡蛋饼", category: "breakfast", emoji: "🍳",
    image: "img/recipes/b07.svg", time: "10分钟", difficulty: "简单", servings: 1,
    tags: ["高蛋白", "快手"], season: ["全年"],
    ingredients: ["鸡蛋 2个", "西葫芦/胡萝卜 100g", "全麦面粉 20g", "小葱 少许", "橄榄油 5ml"],
    steps: ["蔬菜擦丝，与蛋液、面粉、葱花拌匀", "平底锅刷油，倒入面糊摊平", "小火两面煎至金黄"],
    nutrition: { kcal: 300, protein: 20, carbs: 28, fat: 12, fiber: 4 },
    source: "自研",
  },
  {
    id: "b08", name: "牛奶玉米蛋套餐", category: "breakfast", emoji: "🌽",
    image: "img/recipes/b08.svg", time: "15分钟", difficulty: "简单", servings: 1,
    tags: ["快手", "均衡"], season: ["全年"],
    ingredients: ["牛奶 300ml", "甜玉米 1根", "水煮蛋 2个", "猕猴桃 1个"],
    steps: ["玉米蒸熟", "鸡蛋水煮", "搭配牛奶和猕猴桃，10 分钟搞定"],
    nutrition: { kcal: 440, protein: 24, carbs: 60, fat: 13, fiber: 7 },
    source: "自研",
  },

  /* ===== 午餐 ===== */
  {
    id: "l01", name: "鸡胸肉西兰花糙米碗", category: "lunch", emoji: "🍗",
    image: "img/recipes/l01.svg", time: "25分钟", difficulty: "简单", servings: 1,
    tags: ["高蛋白", "减脂经典"], season: ["全年"],
    ingredients: ["鸡胸肉 200g", "西兰花 150g", "糙米饭 200g（熟）", "蒜 2瓣", "生抽/黑胡椒/橄榄油 少许"],
    steps: ["鸡胸肉用盐、黑胡椒、生抽腌 10 分钟", "平底锅少油中火煎至两面金黄，切条", "西兰花焯水 2 分钟", "糙米饭打底，铺鸡胸与西兰花，淋蒜蓉酱汁"],
    nutrition: { kcal: 560, protein: 52, carbs: 55, fat: 13, fiber: 8 },
    source: "自研",
  },
  {
    id: "l02", name: "香煎三文鱼藜麦沙拉", category: "lunch", emoji: "🐟",
    image: "img/recipes/l02.svg", time: "25分钟", difficulty: "中等", servings: 1,
    tags: ["高蛋白", "Omega-3"], season: ["全年"],
    ingredients: ["三文鱼 180g", "藜麦 50g（生）", "芦笋 100g", "小番茄 8颗", "柠檬/橄榄油 少许"],
    steps: ["藜麦加水煮 15 分钟沥干", "三文鱼用盐和黑胡椒腌 5 分钟，少油煎至表面金黄", "芦笋煎 2 分钟", "装盘挤柠檬汁，淋少量橄榄油"],
    nutrition: { kcal: 560, protein: 38, carbs: 40, fat: 26, fiber: 6 },
    source: "自研",
  },
  {
    id: "l03", name: "番茄牛肉荞麦面", category: "lunch", emoji: "🍜",
    image: "img/recipes/l03.svg", time: "25分钟", difficulty: "简单", servings: 1,
    tags: ["高蛋白", "中式"], season: ["全年"],
    ingredients: ["瘦牛肉片 150g", "番茄 2个", "荞麦面 80g（干）", "洋葱 半个", "生抽/番茄酱 少许"],
    steps: ["荞麦面煮熟过凉", "少油炒香洋葱，下番茄炒出沙", "加水煮开，下牛肉片烫熟调味", "浇在面上"],
    nutrition: { kcal: 520, protein: 36, carbs: 62, fat: 12, fiber: 7 },
    source: "自研",
  },
  {
    id: "l04", name: "虾仁豆腐蔬菜锅", category: "lunch", emoji: "🦐",
    image: "img/recipes/l04.svg", time: "20分钟", difficulty: "简单", servings: 1,
    tags: ["高蛋白", "低脂"], season: ["全年"],
    ingredients: ["鲜虾仁 150g", "北豆腐 150g", "娃娃菜 200g", "金针菇 100g", "姜/葱 少许"],
    steps: ["少油煸香姜片，下虾仁炒至变色", "加入豆腐和清水煮开", "下娃娃菜、金针菇煮 5 分钟", "盐和白胡椒调味"],
    nutrition: { kcal: 340, protein: 40, carbs: 18, fat: 11, fiber: 6 },
    source: "自研",
  },
  {
    id: "l05", name: "彩椒鸡丁糙米饭", category: "lunch", emoji: "🌶️",
    image: "img/recipes/l05.svg", time: "20分钟", difficulty: "简单", servings: 1,
    tags: ["高蛋白", "快手"], season: ["全年"],
    ingredients: ["鸡腿肉(去皮) 180g", "彩椒 2个", "糙米饭 200g", "蒜 2瓣", "生抽/黑胡椒 少许"],
    steps: ["鸡腿肉切丁腌制 10 分钟", "少油炒鸡丁至金黄盛出", "下彩椒丁翻炒，倒回鸡丁调味", "配糙米饭"],
    nutrition: { kcal: 580, protein: 45, carbs: 58, fat: 16, fiber: 8 },
    source: "自研",
  },
  {
    id: "l06", name: "清蒸鲈鱼杂粮饭", category: "lunch", emoji: "🐠",
    image: "img/recipes/l06.svg", time: "25分钟", difficulty: "中等", servings: 1,
    tags: ["高蛋白", "清淡"], season: ["全年"],
    ingredients: ["鲈鱼 1条约 350g", "杂粮饭 200g（熟）", "姜丝/葱丝 少许", "蒸鱼豉油 1勺", "上海青 150g"],
    steps: ["鱼身划刀抹盐，铺姜丝大火蒸 8–10 分钟", "出锅铺葱丝淋热油和蒸鱼豉油", "青菜焯水", "配杂粮饭"],
    nutrition: { kcal: 520, protein: 45, carbs: 55, fat: 12, fiber: 7 },
    source: "自研",
  },
  {
    id: "l07", name: "黑椒牛柳红薯西兰花", category: "lunch", emoji: "🥩",
    image: "img/recipes/l07.svg", time: "25分钟", difficulty: "中等", servings: 1,
    tags: ["高蛋白", "增肌"], season: ["全年"],
    ingredients: ["牛里脊 180g", "红薯 200g", "西兰花 150g", "黑胡椒/生抽/蒜 少许"],
    steps: ["牛里脊逆纹切条，用黑胡椒、生抽腌 10 分钟", "红薯切块蒸熟", "大火快炒牛柳至刚熟", "西兰花焯水，一起装盘"],
    nutrition: { kcal: 540, protein: 40, carbs: 60, fat: 14, fiber: 9 },
    source: "自研",
  },
  {
    id: "l08", name: "番茄鸡蛋豆腐盖饭", category: "lunch", emoji: "🍅",
    image: "img/recipes/l08.svg", time: "20分钟", difficulty: "简单", servings: 1,
    tags: ["家常", "高蛋白"], season: ["全年"],
    ingredients: ["鸡蛋 2个", "豆腐 150g", "番茄 2个", "杂粮饭 180g", "小葱 少许"],
    steps: ["番茄切块炒出沙", "下豆腐块轻推，加半碗水煮 5 分钟", "淋入蛋液煮熟", "调味后浇在杂粮饭上"],
    nutrition: { kcal: 520, protein: 32, carbs: 62, fat: 15, fiber: 6 },
    source: "自研",
  },

  /* ===== 晚餐 ===== */
  {
    id: "d01", name: "凉拌鸡丝魔芋面", category: "dinner", emoji: "🥒",
    image: "img/recipes/d01.svg", time: "20分钟", difficulty: "简单", servings: 1,
    tags: ["低卡", "高蛋白"], season: ["夏季"],
    ingredients: ["鸡胸肉 150g", "魔芋面 200g", "黄瓜 1根", "香菜/小米辣 少许", "生抽/醋/蒜 适量"],
    steps: ["鸡胸肉煮熟放凉撕成丝", "魔芋面焯水 2 分钟过凉", "黄瓜切丝", "调汁：生抽+醋+蒜末+小米辣，拌匀"],
    nutrition: { kcal: 280, protein: 38, carbs: 22, fat: 5, fiber: 7 },
    source: "自研",
  },
  {
    id: "d02", name: "冬瓜虾仁汤+玉米", category: "dinner", emoji: "🍲",
    image: "img/recipes/d02.svg", time: "20分钟", difficulty: "简单", servings: 1,
    tags: ["低卡", "去水肿"], season: ["夏季"],
    ingredients: ["冬瓜 300g", "虾仁 120g", "甜玉米 1根", "姜丝 少许", "盐/白胡椒 少许"],
    steps: ["冬瓜切片，玉米切段", "少油煸姜丝，下冬瓜翻炒", "加水煮开，放玉米煮 10 分钟", "下虾仁煮 3 分钟调味"],
    nutrition: { kcal: 300, protein: 28, carbs: 40, fat: 4, fiber: 7 },
    source: "自研",
  },
  {
    id: "d03", name: "蔬菜鸡蛋汤+蒸南瓜", category: "dinner", emoji: "🎃",
    image: "img/recipes/d03.svg", time: "20分钟", difficulty: "简单", servings: 1,
    tags: ["低卡", "清淡"], season: ["全年"],
    ingredients: ["鸡蛋 1个", "菠菜 150g", "西红柿 1个", "南瓜 200g"],
    steps: ["南瓜切块蒸 15 分钟", "番茄炒软加水煮开", "下菠菜，淋蛋液成蛋花", "调味即可"],
    nutrition: { kcal: 260, protein: 16, carbs: 40, fat: 6, fiber: 8 },
    source: "自研",
  },
  {
    id: "d04", name: "蒜蓉蒸扇贝+青菜", category: "dinner", emoji: "🦪",
    image: "img/recipes/d04.svg", time: "20分钟", difficulty: "中等", servings: 1,
    tags: ["高蛋白", "海鲜"], season: ["秋冬"],
    ingredients: ["扇贝 6只", "粉丝 30g", "蒜末 2瓣", "上海青 200g", "蒸鱼豉油 少许"],
    steps: ["粉丝泡软垫底，放扇贝", "蒜末炒香铺在扇贝上，大火蒸 6 分钟", "淋蒸鱼豉油和葱花", "青菜焯水搭配"],
    nutrition: { kcal: 330, protein: 30, carbs: 35, fat: 7, fiber: 5 },
    source: "自研",
  },
  {
    id: "d05", name: "少油韩式豆腐汤", category: "dinner", emoji: "🥘",
    image: "img/recipes/d05.svg", time: "25分钟", difficulty: "简单", servings: 1,
    tags: ["低脂", "暖胃"], season: ["秋冬"],
    ingredients: ["嫩豆腐 200g", "鸡蛋 1个", "西葫芦 100g", "香菇 3朵", "韩式辣酱 1勺（可减）"],
    steps: ["少油炒香洋葱和香菇", "加水和半勺辣酱煮开", "下豆腐、西葫芦煮 8 分钟", "打入鸡蛋煮熟，配少量糙米饭"],
    nutrition: { kcal: 330, protein: 24, carbs: 30, fat: 12, fiber: 5 },
    source: "自研",
  },
  {
    id: "d06", name: "香菇鸡肉蔬菜粥", category: "dinner", emoji: "🥣",
    image: "img/recipes/d06.svg", time: "30分钟", difficulty: "简单", servings: 1,
    tags: ["养胃", "高蛋白"], season: ["秋冬"],
    ingredients: ["大米/小米 60g", "鸡胸肉 120g", "香菇 4朵", "胡萝卜 半根", "青菜 100g"],
    steps: ["米加水煮粥底 20 分钟", "加入鸡丁、香菇片、胡萝卜粒煮 10 分钟", "最后下青菜碎，盐和白胡椒调味"],
    nutrition: { kcal: 420, protein: 32, carbs: 60, fat: 6, fiber: 5 },
    source: "自研",
  },
  {
    id: "d07", name: "烤时蔬+煎蛋+牛油果", category: "dinner", emoji: "🥑",
    image: "img/recipes/d07.svg", time: "25分钟", difficulty: "简单", servings: 1,
    tags: ["低碳", "健康脂肪"], season: ["全年"],
    ingredients: ["彩椒/西葫芦/茄子 300g", "鸡蛋 2个", "牛油果 半个", "橄榄油 5ml", "黑胡椒/盐 少许"],
    steps: ["蔬菜切块拌橄榄油和黑胡椒，烤箱 200℃ 烤 15 分钟", "平底锅煎太阳蛋", "装盘配牛油果"],
    nutrition: { kcal: 380, protein: 20, carbs: 28, fat: 22, fiber: 10 },
    source: "自研",
  },
  {
    id: "d08", name: "酸辣白菜+鸡胸丁", category: "dinner", emoji: "🥬",
    image: "img/recipes/d08.svg", time: "18分钟", difficulty: "简单", servings: 1,
    tags: ["低卡", "开胃"], season: ["秋冬"],
    ingredients: ["大白菜 300g", "鸡胸肉 150g", "干辣椒 2个", "蒜 2瓣", "醋/生抽 少许"],
    steps: ["鸡胸肉切丁腌制后少油炒熟盛出", "爆香蒜和干辣椒，下白菜大火翻炒", "白菜变软后倒回鸡丁，烹醋调味"],
    nutrition: { kcal: 300, protein: 38, carbs: 20, fat: 7, fiber: 6 },
    source: "自研",
  },

  /* ===== 加餐 ===== */
  {
    id: "s01", name: "希腊酸奶蓝莓杯", category: "snack", emoji: "🫐",
    image: "", time: "3分钟", difficulty: "简单", servings: 1,
    tags: ["高蛋白", "加餐"], season: ["全年"],
    ingredients: ["无糖希腊酸奶 150g", "蓝莓 80g", "杏仁 8颗"],
    steps: ["酸奶装杯", "铺蓝莓与杏仁即可"],
    nutrition: { kcal: 220, protein: 18, carbs: 20, fat: 9, fiber: 4 },
    source: "自研",
  },
  {
    id: "s02", name: "水煮蛋+小番茄", category: "snack", emoji: "🥚",
    image: "", time: "8分钟", difficulty: "简单", servings: 1,
    tags: ["高蛋白", "加餐"], season: ["全年"],
    ingredients: ["鸡蛋 2个", "小番茄 100g"],
    steps: ["鸡蛋冷水下锅煮 8 分钟", "配小番茄食用"],
    nutrition: { kcal: 190, protein: 16, carbs: 10, fat: 11, fiber: 2 },
    source: "自研",
  },
];

/* 食材关键词 → 菜谱匹配词（用于智能菜谱生成） */
const INGREDIENT_KEYWORDS = {
  "鸡胸肉": ["鸡胸", "鸡胸肉", "鸡"],
  "鸡腿肉": ["鸡腿", "鸡腿肉", "鸡"],
  "牛肉": ["牛肉", "牛柳", "牛"],
  "三文鱼": ["三文鱼", "鲑鱼", "鱼"],
  "鲈鱼": ["鲈鱼", "鱼"],
  "虾仁": ["虾", "虾仁"],
  "扇贝": ["扇贝", "贝"],
  "鸡蛋": ["鸡蛋", "蛋"],
  "豆腐": ["豆腐"],
  "糙米": ["糙米", "糙米饭", "杂粮饭", "米"],
  "藜麦": ["藜麦"],
  "燕麦": ["燕麦"],
  "荞麦面": ["荞麦面", "荞麦", "面"],
  "全麦面包": ["全麦面包", "面包", "全麦"],
  "红薯": ["红薯", "地瓜"],
  "紫薯": ["紫薯"],
  "南瓜": ["南瓜"],
  "玉米": ["玉米"],
  "西兰花": ["西兰花", "西蓝花"],
  "番茄": ["番茄", "西红柿"],
  "黄瓜": ["黄瓜"],
  "彩椒": ["彩椒", "甜椒", "青椒"],
  "菠菜": ["菠菜"],
  "白菜": ["白菜", "大白菜"],
  "青菜": ["青菜", "上海青", "蔬菜", "叶菜"],
  "生菜": ["生菜"],
  "芦笋": ["芦笋"],
  "冬瓜": ["冬瓜"],
  "西葫芦": ["西葫芦", "角瓜"],
  "香菇": ["香菇", "蘑菇", "菌菇"],
  "金针菇": ["金针菇"],
  "娃娃菜": ["娃娃菜"],
  "香蕉": ["香蕉"],
  "蓝莓": ["蓝莓", "莓"],
  "牛奶": ["牛奶"],
  "酸奶": ["酸奶"],
  "牛油果": ["牛油果", "鳄梨"],
  "坚果": ["坚果", "杏仁", "核桃", "南瓜籽"],
  "魔芋": ["魔芋"],
  "粉丝": ["粉丝"],
};

/* ---------------- 训练计划模板（每周 5 练，肩/背优先） ---------------- */
const WEEKLY_PLAN_TEMPLATE = [
  {
    day: 1, label: "周一", focus: "肩（重点）", color: "blue",
    detail: "热身 → 哑铃肩上推举 4×10 · 哑铃侧平举 4×12 · 俯身反向飞鸟 4×12 · 哑铃前平举 3×12 · 面拉 3×15 → 拉伸",
    exercises: ["e_ohp", "e_lateral", "e_revfly", "e_front", "e_facepull"],
  },
  {
    day: 2, label: "周二", focus: "背（重点）", color: "blue",
    detail: "热身 → 哑铃俯身划船 4×10 · 单手哑铃划船 4×10/侧 · 直臂下压 3×12 · 反向划船 3×力竭 · 罗马尼亚硬拉(哑铃) 3×12 → 拉伸",
    exercises: ["e_bentrow", "e_onearmrow", "e_straightpull", "e_invertedrow", "e_rdl_dumbbell"],
  },
  {
    day: 3, label: "周三", focus: "腿 + 臀", color: "green",
    detail: "热身 → 高脚杯深蹲 4×12 · 哑铃箭步蹲 3×10/侧 · 杠铃罗马尼亚硬拉 3×10 · 臀桥 3×15 · 提踵 3×15 → 拉伸",
    exercises: ["e_goblet", "e_lunge", "e_rdl_barbell", "e_bridge", "e_calf"],
  },
  {
    day: 4, label: "周四", focus: "肩 + 胸", color: "blue",
    detail: "热身 → 坐姿哑铃推举 4×10 · 侧平举 4×12 · 俯卧撑 3×力竭 · 哑铃卧推 3×10 · 哑铃飞鸟 3×12 → 拉伸",
    exercises: ["e_ohp", "e_lateral", "e_pushup", "e_dbench", "e_dfly"],
  },
  {
    day: 5, label: "周五", focus: "背 + 手臂", color: "blue",
    detail: "热身 → 杠铃划船 4×10 · 直臂下压 3×12 · 哑铃弯举 3×12 · 锤式弯举 3×12 · 颈后臂屈伸 3×12 → 拉伸",
    exercises: ["e_barbellrow", "e_straightpull", "e_curl", "e_hammer", "e_overheadext"],
  },
  {
    day: 6, label: "周六", focus: "主动恢复", color: "purple",
    detail: "快走 30–40 分钟 / 全身拉伸 + 泡沫轴放松（非力量训练日）",
    exercises: [],
  },
  {
    day: 7, label: "周日", focus: "休息", color: "purple",
    detail: "完全休息，保证睡眠与饮水；可做轻度散步",
    exercises: [],
  },
];

/* ---------------- 动作教程库 ----------------
 * group: 肩/背/胸/腿/臀/核心/手臂/斜方肌/肩袖
 * video: { type: "bilibili", url } 或 { type: "search", keyword }
 * tan: 是否收录于谭成义教程库
 */
const EXERCISES = [
  /* ===== 肩 ===== */
  {
    id: "e_ohp", name: "哑铃肩上推举", group: "肩", equipment: "哑铃", level: "入门",
    video: { type: "bilibili", url: "https://www.bilibili.com/video/BV1RX4y1j7P6/" },
    tan: true, tanNote: "谭成义《第三视角私教课·练肩》重点动作",
    method: ["站姿或坐姿，双手持哑铃置于耳侧，肘部约 90° 且略向前", "核心收紧、臀部夹紧，垂直向上推起至手臂伸直（不锁死肘）", "顶端稍停，缓慢下放回起始位"],
    keyPoints: ["推起轨迹保持竖直，不要向前画弧", "想象用「肩膀发力」而非用手臂，三角肌中束主导", "手腕保持中立，哑铃在腕关节正上方", "下放至肘部略低于肩即可，避免过度拉伸肩前侧"],
    errors: ["腰部过度反弓借力", "耸肩导致斜方肌代偿", "肘部外张角度不一致"],
    reps: "4 组 × 8–12 次", rest: "90 秒",
  },
  {
    id: "e_lateral", name: "哑铃侧平举", group: "肩", equipment: "哑铃", level: "入门",
    video: { type: "bilibili", url: "https://www.bilibili.com/video/BV1RX4y1j7P6/" },
    tan: true, tanNote: "谭成义私教肩部教学经典动作",
    method: ["双手持哑铃垂于体侧，肘微屈固定", "以肘带动向两侧抬起，至与肩同高或略低", "顶端稍停，缓慢下放"],
    keyPoints: ["重量宁轻勿重，用「小重量高次数」找三角肌中束发力", "想象把肘部「提」起来，而不是用手腕甩", "身体不要左右晃动借力", "抬起时小拇指略微向上，刺激更精准"],
    errors: ["重量过大、耸肩", "身体摇晃借力", "抬得过高导致斜方肌代偿"],
    reps: "4 组 × 12–15 次", rest: "60 秒",
  },
  {
    id: "e_revfly", name: "俯身哑铃反向飞鸟", group: "肩", equipment: "哑铃", level: "入门",
    video: { type: "bilibili", url: "https://www.bilibili.com/video/BV1RX4y1j7P6/" },
    tan: true, tanNote: "练肩后束，改善圆肩",
    method: ["俯身约 45°，背部平直，哑铃垂于膝前", "肘微屈，向两侧打开至与肩同高", "肩胛骨向中间靠拢，缓慢还原"],
    keyPoints: ["想象「用肩胛骨夹一支笔」，后束+菱形肌协同", "避免用背部竖脊肌代偿（起身）", "肘部角度全程固定", "重量轻、次数高，感受肩后侧灼烧"],
    errors: ["身体随动作起伏", "耸肩", "肘部过度弯曲变成划船"],
    reps: "4 组 × 12–15 次", rest: "60 秒",
  },
  {
    id: "e_front", name: "哑铃前平举", group: "肩", equipment: "哑铃", level: "入门",
    video: { type: "search", keyword: "哑铃前平举 三角肌前束" },
    method: ["双手或单手持哑铃于大腿前侧", "直臂向前抬起至与肩同高", "缓慢下放"],
    keyPoints: ["三角肌前束发力，肘不弯曲", "抬起不超过肩高，避免斜方肌代偿", "身体稳定不后仰"],
    errors: ["用惯性甩起", "身体后仰借力"],
    reps: "3 组 × 12 次", rest: "60 秒",
  },
  {
    id: "e_facepull", name: "面拉（弹力带）", group: "肩", equipment: "弹力带", level: "入门",
    video: { type: "search", keyword: "面拉 肩后束 肩袖 弹力带" },
    tan: true, tanNote: "谭成义多次推荐：改善肩部健康",
    method: ["弹力带固定在胸部高度，双手握两端", "向面部方向拉，肘部抬高外展", "末端将带子向两侧分开，感受肩后束收缩"],
    keyPoints: ["动作末端做一个「外旋」，练到肩袖", "肘部始终高于手腕", "轻重量、高次数，每天做也无妨"],
    errors: ["只用手臂拉", "耸肩"],
    reps: "3 组 × 15–20 次", rest: "60 秒",
  },

  /* ===== 背 ===== */
  {
    id: "e_bentrow", name: "哑铃俯身划船", group: "背", equipment: "哑铃", level: "入门",
    video: { type: "bilibili", url: "https://www.bilibili.com/video/BV1Bh4y1V7ea/" },
    tan: true, tanNote: "谭成义《第三视角私教课·练背》重点",
    method: ["俯身约 45°，背部平直，双铃垂于体前", "将哑铃向髋部方向拉，肘部贴近身体", "顶端挤压肩胛骨，缓慢下放"],
    keyPoints: ["「肘部带动」向后拉，想象手是钩子", "收紧核心防止塌腰", "下放时肩胛骨前伸，充分拉伸背阔肌", "肘部角度固定，避免变成二头弯举"],
    errors: ["身体上下起伏", "耸肩", "用腰部反弹借力"],
    reps: "4 组 × 10 次", rest: "90 秒",
  },
  {
    id: "e_onearmrow", name: "单手哑铃划船", group: "背", equipment: "哑铃", level: "入门",
    video: { type: "bilibili", url: "https://www.bilibili.com/video/BV1Bh4y1V7ea/" },
    tan: true,
    method: ["单膝跪在凳上，同侧手撑凳，对侧手持铃", "背部平直，将哑铃拉向髋部", "顶端挤压背阔肌，缓慢下放"],
    keyPoints: ["躯干固定，不要扭转", "拉的方向朝髋部而非胸部，更刺激背阔肌", "感受「腋下夹紧」"],
    errors: ["身体旋转", "腰部塌陷"],
    reps: "4 组 × 10–12 次/侧", rest: "90 秒",
  },
  {
    id: "e_straightpull", name: "直臂下压（弹力带/龙门架）", group: "背", equipment: "弹力带", level: "入门",
    video: { type: "search", keyword: "直臂下压 背阔肌 弹力带 训练" },
    tan: true, tanNote: "谭成义专门讲解过直臂下压如何练背",
    method: ["弹力带固定高处，双手直臂握住", "保持手臂伸直，将带子向下压至大腿前侧", "缓慢还原，感受背阔肌拉伸"],
    keyPoints: ["手臂全程伸直，靠背阔肌收缩带动", "先「沉肩」再下压，肩胛骨后下方移动", "适合作为练背前的激活动作"],
    errors: ["屈肘变成三头下压", "耸肩"],
    reps: "3 组 × 12–15 次", rest: "60 秒",
  },
  {
    id: "e_invertedrow", name: "反向划船（桌下/低杠）", group: "背", equipment: "自重", level: "入门",
    video: { type: "search", keyword: "反向划船 自重 练背 新手" },
    method: ["在稳固桌沿或低杠下，身体悬空脚跟撑地", "身体呈直线，将胸部拉向桌面", "顶端稍停，缓慢下放"],
    keyPoints: ["身体全程直线，不塌腰", "肩胛骨先下沉再后收", "难度不够就抬腿，难度太大就屈膝"],
    errors: ["臀部先抬起", "颈部前伸"],
    reps: "3 组 × 尽量多（8–15）", rest: "90 秒",
  },
  {
    id: "e_rdl_dumbbell", name: "哑铃罗马尼亚硬拉", group: "背", equipment: "哑铃", level: "入门",
    video: { type: "search", keyword: "罗马尼亚硬拉 哑铃 腘绳肌 臀部" },
    method: ["双脚与髋同宽，哑铃置于大腿前", "屈髋向后推，哑铃沿腿下滑至小腿中段", "臀部发力站起"],
    keyPoints: ["「髋部铰链」：屈髋不弯腰", "背部保持中立，膝盖微屈固定", "感受大腿后侧和臀部拉伸"],
    errors: ["弓背", "膝盖过度前移变成深蹲"],
    reps: "3 组 × 10–12 次", rest: "90 秒",
  },
  {
    id: "e_barbellrow", name: "杠铃俯身划船", group: "背", equipment: "杠铃", level: "进阶",
    video: { type: "search", keyword: "杠铃俯身划船 动作要领" },
    method: ["俯身约 45°，正握杠铃与肩同宽", "将杠铃拉向下腹部", "顶端挤压肩胛，缓慢下放"],
    keyPoints: ["核心收紧稳定躯干", "肘部向髋部方向拉", "重量适中保证背部平直"],
    errors: ["弓背", "用腰甩杠铃"],
    reps: "4 组 × 8–10 次", rest: "90 秒",
  },

  /* ===== 胸 ===== */
  {
    id: "e_pushup", name: "俯卧撑", group: "胸", equipment: "自重", level: "入门",
    video: { type: "search", keyword: "俯卧撑 标准动作 新手" },
    method: ["双手略宽于肩撑地，身体呈直线", "屈肘下降至胸部接近地面", "推起还原"],
    keyPoints: ["核心与臀部收紧，身体不塌不弓", "肘部与躯干约 45°", "下降时肩胛骨后收"],
    errors: ["塌腰", "只做半程"],
    reps: "3 组 × 力竭（8–15）", rest: "90 秒",
  },
  {
    id: "e_dbench", name: "哑铃卧推", group: "胸", equipment: "哑铃", level: "入门",
    video: { type: "search", keyword: "哑铃卧推 动作要领 胸肌" },
    method: ["仰卧，哑铃置于胸部两侧", "向上推起至手臂伸直，稍内收", "缓慢下放至胸部两侧"],
    keyPoints: ["肩胛骨后收下沉，胸部打开", "推起时想象「把哑铃往中间挤」", "手腕保持中立"],
    errors: ["肩部前移", "下放过低拉伤肩"],
    reps: "3 组 × 8–12 次", rest: "90 秒",
  },
  {
    id: "e_dfly", name: "哑铃飞鸟", group: "胸", equipment: "哑铃", level: "入门",
    video: { type: "search", keyword: "哑铃飞鸟 胸肌 动作" },
    method: ["仰卧，双手持铃于胸上方，肘微屈", "向两侧打开至胸部有拉伸感", "沿弧线合拢"],
    keyPoints: ["肘角固定约 150°，不变成卧推", "用「拥抱」的感觉夹胸", "重量轻、控制离心"],
    errors: ["肘部越弯越深", "肩膀离开凳面"],
    reps: "3 组 × 12 次", rest: "60 秒",
  },

  /* ===== 腿/臀 ===== */
  {
    id: "e_goblet", name: "高脚杯深蹲", group: "腿", equipment: "哑铃", level: "入门",
    video: { type: "search", keyword: "高脚杯深蹲 动作要领" },
    method: ["双手捧哑铃于胸前，双脚略宽于肩", "屈髋屈膝下蹲至大腿平行或更低", "脚跟发力站起"],
    keyPoints: ["膝盖对准脚尖方向", "胸口保持打开，哑铃贴近身体", "下蹲时先「坐」向后"],
    errors: ["膝盖内扣", "脚跟离地", "弓背"],
    reps: "4 组 × 10–15 次", rest: "90 秒",
  },
  {
    id: "e_lunge", name: "哑铃箭步蹲", group: "腿", equipment: "哑铃", level: "入门",
    video: { type: "search", keyword: "哑铃箭步蹲 动作要领" },
    method: ["双手持铃垂于体侧，向前迈一大步", "下蹲至前腿大腿平行地面，后膝接近地面", "前脚蹬地还原"],
    keyPoints: ["前膝对准脚尖，不要内扣", "躯干直立，重心在两腿之间", "后退一步还原更护膝"],
    errors: ["膝盖超过脚尖过多", "身体前倾"],
    reps: "3 组 × 10–12 次/侧", rest: "90 秒",
  },
  {
    id: "e_rdl_barbell", name: "杠铃罗马尼亚硬拉", group: "腿", equipment: "杠铃", level: "进阶",
    video: { type: "search", keyword: "杠铃罗马尼亚硬拉 动作" },
    method: ["杠铃贴近大腿，屈髋向后推", "杠铃沿腿下滑至小腿中段", "臀部发力站直"],
    keyPoints: ["全程杠铃贴腿", "背部中立，眼睛看斜前方", "感受腘绳肌拉伸"],
    errors: ["弓背", "杠铃远离身体"],
    reps: "3 组 × 8–10 次", rest: "120 秒",
  },
  {
    id: "e_bridge", name: "负重臀桥", group: "臀", equipment: "哑铃", level: "入门",
    video: { type: "search", keyword: "臀桥 动作要领 臀部" },
    method: ["仰卧屈膝，哑铃放髋部", "臀部发力顶起至身体成直线", "顶端夹紧臀部稍停"],
    keyPoints: ["用臀部发力而非腰部", "顶端不要过度挺腰", "脚跟踩实"],
    errors: ["腰部代偿", "动作太快没停顿"],
    reps: "3 组 × 15 次", rest: "60 秒",
  },
  {
    id: "e_calf", name: "站姿提踵", group: "腿", equipment: "自重/哑铃", level: "入门",
    video: { type: "search", keyword: "站姿提踵 小腿" },
    method: ["前脚掌踩台阶或垫物，脚跟下沉", "踮起脚尖至最高点", "缓慢下放"],
    keyPoints: ["顶端停顿 1 秒", "动作幅度完整"],
    errors: ["借助弹跳"],
    reps: "3 组 × 15–20 次", rest: "45 秒",
  },

  /* ===== 核心 ===== */
  {
    id: "e_plank", name: "平板支撑", group: "核心", equipment: "自重", level: "入门",
    video: { type: "search", keyword: "平板支撑 标准动作" },
    method: ["前臂撑地，身体成一条直线", "保持 30–60 秒"],
    keyPoints: ["收紧腹部和臀部", "不要塌腰或撅臀", "呼吸均匀"],
    errors: ["塌腰", "憋气"],
    reps: "3 组 × 30–60 秒", rest: "60 秒",
  },
  {
    id: "e_deadbug", name: "死虫式", group: "核心", equipment: "自重", level: "入门",
    video: { type: "search", keyword: "死虫式 核心 训练" },
    method: ["仰卧，四肢朝天，腰贴地", "对侧手脚同时缓慢下放", "回到起始位换边"],
    keyPoints: ["腰部始终贴地", "动作慢而控制"],
    errors: ["腰部拱起"],
    reps: "3 组 × 10 次/侧", rest: "45 秒",
  },

  /* ===== 手臂 ===== */
  {
    id: "e_curl", name: "哑铃弯举", group: "手臂", equipment: "哑铃", level: "入门",
    video: { type: "search", keyword: "哑铃弯举 二头肌" },
    method: ["双手持铃垂于体侧，掌心朝前", "肘部固定，弯举哑铃至肩前", "缓慢下放"],
    keyPoints: ["肘部全程贴紧身体不晃动", "下放时控制离心", "不要借助身体摆动"],
    errors: ["甩动借力", "手腕弯曲"],
    reps: "3 组 × 10–12 次", rest: "60 秒",
  },
  {
    id: "e_hammer", name: "锤式弯举", group: "手臂", equipment: "哑铃", level: "入门",
    video: { type: "search", keyword: "锤式弯举 肱肌" },
    method: ["掌心相对持铃", "弯举至肩前，保持中立握", "缓慢下放"],
    keyPoints: ["强化肱肌和前臂", "肘部固定"],
    errors: ["肘部前移"],
    reps: "3 组 × 12 次", rest: "60 秒",
  },
  {
    id: "e_overheadext", name: "颈后哑铃臂屈伸", group: "手臂", equipment: "哑铃", level: "入门",
    video: { type: "search", keyword: "颈后臂屈伸 三头肌" },
    method: ["双手托哑铃于颈后", "肘部固定，向上伸直手臂", "缓慢下放"],
    keyPoints: ["肘尖朝前，不要外张", "用三头肌发力"],
    errors: ["肘部外展", "腰部反弓"],
    reps: "3 组 × 10–12 次", rest: "60 秒",
  },

  /* ===== 斜方肌/肩袖/热身 ===== */
  {
    id: "e_shrug", name: "哑铃耸肩", group: "斜方肌", equipment: "哑铃", level: "入门",
    video: { type: "search", keyword: "哑铃耸肩 斜方肌" },
    method: ["双手持铃垂于体侧", "肩膀垂直向上耸起", "顶端停顿，缓慢下放"],
    keyPoints: ["垂直耸肩，不画圈", "斜方肌上束发力"],
    errors: ["屈肘变成弯举"],
    reps: "3 组 × 12–15 次", rest: "60 秒",
  },
  {
    id: "e_externalrot", name: "弹力带肩外旋", group: "肩袖", equipment: "弹力带", level: "入门",
    video: { type: "search", keyword: "弹力带肩外旋 肩袖 热身" },
    method: ["弹力带固定体侧，肘贴腰", "前臂向外旋转打开", "缓慢还原"],
    keyPoints: ["肘部夹紧身体", "轻阻力高次数，肩部热身/康复必备"],
    errors: ["肘部离开身体"],
    reps: "2–3 组 × 15 次", rest: "45 秒",
  },
  {
    id: "e_wallangel", name: "靠墙天使（胸椎活动）", group: "肩袖", equipment: "自重", level: "入门",
    video: { type: "search", keyword: "靠墙天使 胸椎 活动度" },
    method: ["背靠墙，手臂呈 W 贴墙", "缓慢向上滑动成 Y，再滑回", "保持腰背贴墙"],
    keyPoints: ["改善圆肩和肩胛活动度", "动作慢，感受胸椎伸展"],
    errors: ["腰部离墙", "耸肩"],
    reps: "2 组 × 10 次", rest: "45 秒",
  },
];

/* ---------------- 谭成义教程库（独立） ---------------- */
const TAN_LIBRARY = [
  {
    id: "t01", title: "第三视角私教课 · 练肩", desc: "保姆级私教视角，详解肩部动作细节与发力要点，新手必看。",
    url: "https://www.bilibili.com/video/BV1RX4y1j7P6/", plays: "10万+",
  },
  {
    id: "t02", title: "第三视角私教课 · 练背", desc: "详解背部动作（划船/下拉等）的预激活、手肘轨迹与背阔肌发力。",
    url: "https://www.bilibili.com/video/BV1Bh4y1V7ea/", plays: "21.8万+",
  },
  {
    id: "t03", title: "私教系列 · 肩部教学（完整版）", desc: "肩部完整教学：从解剖到动作，讲解非常详细，播放 14.9 万+。",
    url: "https://www.bilibili.com/list/521903482?sort_field=pubtime", plays: "14.9万+",
  },
  {
    id: "t04", title: "私教系列 · 背部训练（完整版）", desc: "背部完整教学，重点讲背部「预先受力」与肩胛控制。",
    url: "https://www.bilibili.com/list/521903482?sort_field=pubtime", plays: "21.8万+",
  },
  {
    id: "t05", title: "背部焚决跟练 2.0", desc: "背部跟练系列：内旋肌热 2–3 组×30 次、小重量多次数细节丰富。",
    url: "https://www.xiaohongshu.com/discovery/item/6992a273000000002801e7dd", plays: "跟练",
  },
  {
    id: "t06", title: "凯圣王 × 谭成义 三分化① 训练计划", desc: "三分化训练计划总览：胸肩三头 / 背后束二头 / 腿。",
    url: "https://www.bilibili.com/video/BV1FcdZBNEm3/", plays: "计划讲解",
  },
  {
    id: "t07", title: "三分化② 跟练 · 胸肩三头", desc: "跟练第二期：胸部、肩部、三头肌完整跟练。",
    url: "https://www.bilibili.com/video/BV15iQeB7Epq/", plays: "跟练",
  },
  {
    id: "t08", title: "三分化③ 跟练 · 背 · 后束 · 二头", desc: "跟练第三期：背部、三角肌后束、二头肌跟练。",
    url: "https://www.bilibili.com/video/BV1ofdnBZEi3/", plays: "跟练",
  },
  {
    id: "t09", title: "三分化合集", desc: "三分化系列合集入口，方便连续跟练。",
    url: "https://www.bilibili.com/video/BV17ooLBUEqS/", plays: "合集",
  },
  {
    id: "t10", title: "肩部跟练系列", desc: "跟着谭成义一起把动作做标准，进步会很快。",
    url: "https://www.bilibili.com/list/521903482?sort_field=pubtime", plays: "跟练",
  },
  {
    id: "t11", title: "肩袖损伤改善方法", desc: "针对肩部疼痛、受限、弹响的改善方法，肩部训练前建议观看。",
    url: "https://www.bilibili.com/list/521903482?sort_field=pubtime", plays: "康复",
  },
  {
    id: "t12", title: "私教系列 · 手臂教学", desc: "手臂（二头/三头）详细教学。",
    url: "https://www.bilibili.com/list/521903482?sort_field=pubtime", plays: "10万+",
  },
  {
    id: "t13", title: "卧推系列（含 13–16 周计划）", desc: "卧推进阶系列，适合后期加入健身房后的胸部训练。",
    url: "https://www.bilibili.com/list/521903482?sort_field=pubtime", plays: "系列",
  },
  {
    id: "t14", title: "谭成义 B 站主页（全教程）", desc: "关注主页获取最新教程，按播放列表查看全部内容。",
    url: "https://m.bilibili.com/space/521903482", plays: "主页",
  },
];

/* ---------------- 读书库 ---------------- */
const BOOKS = [
  { id: "bk01", title: "原子习惯", author: "詹姆斯·克利尔", category: "习惯养成", intro: "教你如何通过 1% 的微小改变建立持久习惯——与你的减脂/成长目标完美契合。", why: "把「每天坚持」变成系统，而不是靠意志力。" },
  { id: "bk02", title: "微习惯", author: "斯蒂芬·盖斯", category: "习惯养成", intro: "每天一个俯卧撑、一页书，用极小的行动骗过大脑，养成大习惯。", why: "适合新手启动阶段，降低开始的阻力。" },
  { id: "bk03", title: "认知觉醒", author: "周岭", category: "认知思维", intro: "自我改变的原动力来自认知。讲述如何用元认知驱动成长。", why: "帮助你把「想改变」变成「会改变」。" },
  { id: "bk04", title: "终身成长", author: "卡罗尔·德韦克", category: "认知思维", intro: "固定型思维 vs 成长型思维：相信能力可以培养，是持续进步的前提。", why: "减脂瓶颈期最需要的心态书。" },
  { id: "bk05", title: "刻意练习", author: "安德斯·艾利克森", category: "方法论", intro: "天才不是天生的，而是「有目的的练习」的结果。", why: "训练动作、阅读学习都适用的底层方法。" },
  { id: "bk06", title: "高效能人士的七个习惯", author: "史蒂芬·柯维", category: "效率方法", intro: "从依赖到独立再到互赖的成长路径，个人管理的经典。", why: "建立以原则为中心的生活方式。" },
  { id: "bk07", title: "思考，快与慢", author: "丹尼尔·卡尼曼", category: "认知思维", intro: "系统 1 与系统 2：了解大脑的直觉偏差，做出更理性的选择。", why: "识别饮食/消费中的「非理性决策」。" },
  { id: "bk08", title: "原则", author: "瑞·达利欧", category: "认知思维", intro: "桥水基金创始人的决策与生活原则，用系统化方式面对失败。", why: "把目标-问题-诊断-改进变成日常循环。" },
  { id: "bk09", title: "被讨厌的勇气", author: "岸见一郎 / 古贺史健", category: "心理成长", intro: "阿德勒心理学入门：课题分离，专注自己能控制的事。", why: "减少内耗，把精力留给真正重要的事。" },
  { id: "bk10", title: "运动改造大脑", author: "约翰·瑞迪", category: "健康健身", intro: "运动如何提升专注力、缓解焦虑、改善记忆——科学证据充分。", why: "给你坚持运动最硬核的理由。" },
  { id: "bk11", title: "睡眠革命", author: "尼克·利特尔黑尔斯", category: "健康健身", intro: "R90 睡眠方案：用 90 分钟周期规划睡眠，提升睡眠质量。", why: "配合工作台的睡眠日历一起用。" },
  { id: "bk12", title: "饮食的迷思", author: "蒂姆·斯佩克特", category: "健康健身", intro: "伦敦国王学院遗传学教授讲肠道菌群与饮食真相，破除减肥迷思。", why: "建立科学、不焦虑的饮食观。" },
  { id: "bk13", title: "5% 的改变", author: "李松蔚", category: "心理成长", intro: "不用大动干戈，从 5% 的小改变开始，激活整个系统。", why: "专治「道理都懂就是做不到」。" },
  { id: "bk14", title: "打开心智", author: "L先生（李睿秋）", category: "认知思维", intro: "关于学习、思考、决策与心智模式的系统方法。", why: "提升信息时代的深度思考能力。" },
  { id: "bk15", title: "十分钟冥想", author: "安迪·普迪科姆", category: "心理成长", intro: "每天 10 分钟正念练习，缓解焦虑、提升专注。", why: "睡前冥想也能改善睡眠质量。" },
  { id: "bk16", title: "活出生命的意义", author: "维克多·弗兰克尔", category: "经典传记", intro: "纳粹集中营幸存者关于意义疗法的经典。", why: "找到「为什么坚持」的终极答案。" },
  { id: "bk17", title: "纳瓦尔宝典", author: "埃里克·乔根森", category: "认知思维", intro: "硅谷投资人纳瓦尔的财富与幸福原则。", why: "用长期主义视角看待健康与成长。" },
  { id: "bk18", title: "曾国藩传", author: "张宏杰", category: "经典传记", intro: "「结硬寨，打呆仗」的笨功夫哲学，一个普通人的逆袭史。", why: "最符合「慢就是快」的榜样人物。" },
  { id: "bk19", title: "富兰克林自传", author: "本杰明·富兰克林", category: "经典传记", intro: "十三条美德清单与自我修炼，美国国父的自律日常。", why: "最早的行为习惯打卡系统。" },
  { id: "bk20", title: "当下的力量", author: "埃克哈特·托利", category: "心理成长", intro: "专注当下，摆脱思维中的焦虑与内耗。", why: "训练期间最需要的专注力心法。" },
];

/* ---------------- 数据备份用：全部静态数据 ---------------- */
const STATIC_DATA = { RECIPES, EXERCISES, TAN_LIBRARY, BOOKS, SCIENCE };
