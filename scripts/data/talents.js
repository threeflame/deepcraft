// BP/scripts/data/talents.js

export const CARD_POOL = [
    // --- Fallback ---
    {
        id: "basic_training",
        name: "§7Basic Training",
        description: "タレントが見つかりませんでした。\n代わりにXPを獲得します。",
        type: "xp",
        value: 500,
        rarity: "common",
        conditionText: "Fallback Only",
        condition: (player) => false
    },

    // ==========================================
    //  Tier 1: Common (Req: 5+)
    // ==========================================
    {
        id: "kindle",
        name: "§cKindle",
        description: "Flame攻撃時、20%の確率で「炎上(弱)」を与える",
        type: "passive",
        rarity: "common",
        conditionText: "Flame 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:flame") || 0) >= 5
    },
    {
        id: "chilling_touch",
        name: "§bChilling Touch",
        description: "Frost攻撃時、20%の確率で「凍傷(弱)」を与える",
        type: "passive",
        rarity: "common",
        conditionText: "Frost 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:frost") || 0) >= 5
    },
    {
        id: "static",
        name: "§eStatic",
        description: "Thunder攻撃時、20%の確率で「感電(弱)」を与える",
        type: "passive",
        rarity: "common",
        conditionText: "Thunder 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:thunder") || 0) >= 5
    },
    {
        id: "vitality_1",
        name: "§fVitality I",
        description: "最大体力 +100",
        type: "passive",
        rarity: "common",
        conditionText: "Fortitude 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:fortitude") || 0) >= 5
    },
    {
        id: "swift_1",
        name: "§fSwiftness I",
        description: "移動速度 +5%",
        type: "passive",
        rarity: "common",
        conditionText: "Agility 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:agility") || 0) >= 5
    },
    {
        id: "tough_skin",
        name: "§fTough Skin",
        description: "物理防御スコア +10",
        type: "passive",
        rarity: "common",
        conditionText: "Fortitude 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:fortitude") || 0) >= 5
    },
    {
        id: "brute_force",
        name: "§fBrute Force",
        description: "近接ダメージ +15 (固定値)",
        type: "passive",
        rarity: "common",
        conditionText: "Strength 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:strength") || 0) >= 5
    },
    {
        id: "acrobat",
        name: "§fAcrobat",
        description: "落下ダメージを無効化",
        type: "passive",
        rarity: "common",
        conditionText: "Agility 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:agility") || 0) >= 5
    },
    {
        id: "eagle_eye",
        name: "§fEagle Eye",
        description: "クリティカル率 +15%",
        type: "passive",
        rarity: "common",
        conditionText: "Intelligence 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:intelligence") || 0) >= 5
    },
    {
        id: "aquatic_life",
        name: "§fAquatic Life",
        description: "水中でHPが徐々に回復する",
        type: "passive",
        rarity: "common",
        conditionText: "Willpower 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:willpower") || 0) >= 5
    },
    {
        id: "battle_cry",
        name: "§fBattle Cry",
        description: "戦闘開始時(初撃)のダメージ +30", // v3の高HPに合わせて強化
        type: "passive",
        rarity: "common",
        conditionText: "Charisma 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:charisma") || 0) >= 5
    },

    // ==========================================
    //  Tier 2: Uncommon (Req: 15+)
    // ==========================================
    {
        id: "vitality_2",
        name: "§bVitality II",
        description: "最大体力 +200",
        type: "passive",
        rarity: "uncommon",
        conditionText: "Fortitude 15+",
        condition: (p) => (p.getDynamicProperty("deepcraft:fortitude") || 0) >= 15
    },
    {
        id: "iron_wall",
        name: "§bIron Wall",
        description: "物理防御スコア +30",
        type: "passive",
        rarity: "uncommon",
        conditionText: "Fortitude 15+", // Defense -> Fortitude
        condition: (p) => (p.getDynamicProperty("deepcraft:fortitude") || 0) >= 15
    },
    {
        id: "sharp_blade",
        name: "§bSharp Blade",
        description: "近接ダメージ倍率 +10% (Medium Mastery)",
        type: "passive",
        rarity: "uncommon",
        conditionText: "Medium Mastery 15+", // Strength -> Mastery
        condition: (p) => (p.getDynamicProperty("deepcraft:medium") || 0) >= 15
    },
    {
        id: "sniper",
        name: "§bSniper",
        description: "弓のダメージ +25 (固定値)",
        type: "passive",
        rarity: "uncommon",
        conditionText: "Light Mastery 15+",
        condition: (p) => (p.getDynamicProperty("deepcraft:light") || 0) >= 15
    },
    {
        id: "fire_walker",
        name: "§bFire Walker",
        description: "炎・マグマのダメージを無効化",
        type: "passive",
        rarity: "uncommon",
        conditionText: "Flame 15+",
        condition: (p) => (p.getDynamicProperty("deepcraft:flame") || 0) >= 15
    },
    {
        id: "full_belly",
        name: "§bMetabolism",
        description: "空腹ダメージ無効 & 自然回復強化",
        type: "passive",
        rarity: "uncommon",
        conditionText: "Fortitude 15+",
        condition: (p) => (p.getDynamicProperty("deepcraft:fortitude") || 0) >= 15
    },
    {
        id: "exp_boost",
        name: "§bFast Learner",
        description: "Mob討伐時の獲得XP +50",
        type: "passive",
        rarity: "uncommon",
        conditionText: "Intelligence 15+",
        condition: (p) => (p.getDynamicProperty("deepcraft:intelligence") || 0) >= 15
    },
    {
        id: "heavy_stance",
        name: "§bHeavy Stance",
        description: "ノックバックを完全に無効化",
        type: "passive",
        rarity: "uncommon",
        conditionText: "Heavy Mastery 15+",
        condition: (p) => (p.getDynamicProperty("deepcraft:heavy") || 0) >= 15
    },

    // ==========================================
    //  Tier 3: Rare (Req: 30+)
    // ==========================================
    {
        id: "berserker",
        name: "§eBerserker",
        description: "HP30%以下の時、ダメージ倍率 +50%",
        type: "passive",
        rarity: "rare",
        conditionText: "Strength 30+",
        condition: (p) => (p.getDynamicProperty("deepcraft:strength") || 0) >= 30
    },
    {
        id: "last_stand",
        name: "§eLast Stand",
        description: "HP30%以下の時、防御スコア +50",
        type: "passive",
        rarity: "rare",
        conditionText: "Fortitude 30+",
        condition: (p) => (p.getDynamicProperty("deepcraft:fortitude") || 0) >= 30
    },
    {
        id: "assassin",
        name: "§eAssassin",
        description: "スニーク中の攻撃ダメージ 2.0倍",
        type: "passive",
        rarity: "rare",
        conditionText: "Agility 30+",
        condition: (p) => (p.getDynamicProperty("deepcraft:agility") || 0) >= 30
    },
    {
        id: "vampirism",
        name: "§eVampirism",
        description: "攻撃時にHPを15回復", // 2->15に強化
        type: "passive",
        rarity: "rare",
        conditionText: "Willpower 30+",
        condition: (p) => (p.getDynamicProperty("deepcraft:willpower") || 0) >= 30
    },
    {
        id: "executioner",
        name: "§eExecutioner",
        description: "相手のHPが50%以下の時、ダメージ倍率 +30%",
        type: "passive",
        rarity: "rare",
        conditionText: "Strength 30+",
        condition: (p) => (p.getDynamicProperty("deepcraft:strength") || 0) >= 30
    },
    {
        id: "evasion",
        name: "§eEvasion",
        description: "10%の確率でダメージを完全無効化",
        type: "passive",
        rarity: "rare",
        conditionText: "Agility 30+",
        condition: (p) => (p.getDynamicProperty("deepcraft:agility") || 0) >= 30
    },
    // ※ Thornsは戦闘システム側での実装が必要ですが、定義は残します
    {
        id: "thorns_master",
        name: "§eThorns Master",
        description: "受けたダメージの30%を相手に与える (未実装)",
        type: "passive",
        rarity: "rare",
        conditionText: "Fortitude 30+", // Defense -> Fortitude
        condition: (p) => (p.getDynamicProperty("deepcraft:fortitude") || 0) >= 30
    },

    // ==========================================
    //  Tier 4: Epic / Legendary (Req: 50+)
    // ==========================================
    {
        id: "glass_cannon",
        name: "§dGlass Cannon",
        description: "ダメージ1.3倍になるが、最大HPが60%になる",
        type: "passive",
        rarity: "epic",
        conditionText: "Strength 50+ / Fortitude < 20",
        condition: (p) => (p.getDynamicProperty("deepcraft:strength") || 0) >= 50 && (p.getDynamicProperty("deepcraft:fortitude") || 0) < 20
    },
    {
        id: "immortal",
        name: "§dImmortal",
        description: "毎秒HPが1ずつ自然回復する",
        type: "passive",
        rarity: "epic",
        conditionText: "Fortitude 50+ / Willpower 50+",
        condition: (p) => (p.getDynamicProperty("deepcraft:fortitude") || 0) >= 50 && (p.getDynamicProperty("deepcraft:willpower") || 0) >= 50
    },
    {
        id: "godspeed",
        name: "§dGodspeed",
        description: "移動速度 +15%",
        type: "passive",
        rarity: "epic",
        conditionText: "Agility 50+",
        condition: (p) => (p.getDynamicProperty("deepcraft:agility") || 0) >= 50
    },
    {
        id: "elemental_lord",
        name: "§6§lElemental Lord",
        description: "炎・氷(凍結)・落雷ダメージを無効化",
        type: "passive",
        rarity: "legendary",
        conditionText: "All Elements 20+",
        condition: (p) => 
            (p.getDynamicProperty("deepcraft:flame") || 0) >= 20 &&
            (p.getDynamicProperty("deepcraft:frost") || 0) >= 20 &&
            (p.getDynamicProperty("deepcraft:gale") || 0) >= 20 &&
            (p.getDynamicProperty("deepcraft:thunder") || 0) >= 20
    },
    {
        id: "divine_protection",
        name: "§a§lDivine Protection",
        description: "致死ダメージを受けた時、HPを全回復 (未実装)",
        type: "passive",
        rarity: "legendary",
        conditionText: "Lucky Find",
        condition: (player) => Math.random() < 0.05
    }
];