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
    //  Tier 1: Common (基礎能力) - Req: 5+
    // ==========================================
    {
        id: "vitality_1",
        name: "§fVitality I",
        description: "最大体力 +4 (ハート2個分)",
        type: "passive",
        rarity: "common",
        conditionText: "Fortitude 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:fortitude") || 1) >= 5
    },
    {
        id: "swift_1",
        name: "§fSwiftness I",
        description: "移動速度レベル +5",
        type: "passive",
        rarity: "common",
        conditionText: "Agility 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:agility") || 1) >= 5
    },
    {
        id: "tough_skin",
        name: "§fTough Skin",
        description: "受けるダメージ -1 (固定値軽減)",
        type: "passive",
        rarity: "common",
        conditionText: "Defense 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:defense") || 1) >= 5
    },
    {
        id: "brute_force",
        name: "§fBrute Force",
        description: "近接ダメージ +2 (固定値加算)",
        type: "passive",
        rarity: "common",
        conditionText: "Strength 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:strength") || 1) >= 5
    },
    {
        id: "acrobat", // 元Feather Step (落下速度低下はEffect必須のため変更)
        name: "§fAcrobat",
        description: "落下ダメージを無効化",
        type: "passive",
        rarity: "common",
        conditionText: "Agility 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:agility") || 1) >= 5
    },
    {
        id: "eagle_eye", // 元Night Eyes (暗視はEffect必須のため変更)
        name: "§fEagle Eye",
        description: "クリティカル率 +10% (ダメージ1.5倍)",
        type: "passive",
        rarity: "common",
        conditionText: "Intelligence 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:intelligence") || 1) >= 5
    },
    {
        id: "aquatic_life", // 元Water Born (水中呼吸はEffect必須のため変更)
        name: "§fAquatic Life",
        description: "水中でHPが徐々に回復する",
        type: "passive",
        rarity: "common",
        conditionText: "Willpower 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:willpower") || 1) >= 5
    },
    {
        id: "battle_cry", // 元Leaper (跳躍はEffect必須のため変更)
        name: "§fBattle Cry",
        description: "戦闘開始時(初撃)のダメージ +3",
        type: "passive",
        rarity: "common",
        conditionText: "Charisma 5+",
        condition: (p) => (p.getDynamicProperty("deepcraft:charisma") || 1) >= 5
    },

    // ==========================================
    //  Tier 2: Uncommon (専門化) - Req: 15+
    // ==========================================
    {
        id: "vitality_2",
        name: "§bVitality II",
        description: "最大体力 +10 (ハート5個分)",
        type: "passive",
        rarity: "uncommon",
        conditionText: "Fortitude 15+",
        condition: (p) => (p.getDynamicProperty("deepcraft:fortitude") || 1) >= 15
    },
    {
        id: "iron_wall",
        name: "§bIron Wall",
        description: "受けるダメージ -2 (固定値軽減)",
        type: "passive",
        rarity: "uncommon",
        conditionText: "Defense 15+",
        condition: (p) => (p.getDynamicProperty("deepcraft:defense") || 1) >= 15
    },
    {
        id: "sharp_blade",
        name: "§bSharp Blade",
        description: "近接ダメージ倍率 +10%",
        type: "passive",
        rarity: "uncommon",
        conditionText: "Strength 15+",
        condition: (p) => (p.getDynamicProperty("deepcraft:strength") || 1) >= 15
    },
    {
        id: "sniper",
        name: "§bSniper",
        description: "弓のダメージ +5 (固定値加算)",
        type: "passive",
        rarity: "uncommon",
        conditionText: "Light Mastery 15+",
        condition: (p) => (p.getDynamicProperty("deepcraft:light") || 1) >= 15
    },
    {
        id: "fire_walker",
        name: "§bFire Walker",
        description: "炎・マグマのダメージを無効化",
        type: "passive",
        rarity: "uncommon",
        conditionText: "Flame 15+",
        condition: (p) => (p.getDynamicProperty("deepcraft:flame") || 1) >= 15
    },
    {
        id: "full_belly",
        name: "§bMetabolism",
        description: "空腹ダメージ無効 & 自然回復強化",
        type: "passive",
        rarity: "uncommon",
        conditionText: "Fortitude 15+",
        condition: (p) => (p.getDynamicProperty("deepcraft:fortitude") || 1) >= 15
    },
    {
        id: "exp_boost",
        name: "§bFast Learner",
        description: "Mob討伐時の獲得XP +50",
        type: "passive",
        rarity: "uncommon",
        conditionText: "Intelligence 15+",
        condition: (p) => (p.getDynamicProperty("deepcraft:intelligence") || 1) >= 15
    },
    {
        id: "heavy_stance",
        name: "§bHeavy Stance",
        description: "ノックバックを完全に無効化",
        type: "passive",
        rarity: "uncommon",
        conditionText: "Heavy Mastery 15+",
        condition: (p) => (p.getDynamicProperty("deepcraft:heavy") || 1) >= 15
    },

    // ==========================================
    //  Tier 3: Rare (特殊能力) - Req: 30+
    // ==========================================
    {
        id: "berserker",
        name: "§eBerserker",
        description: "HP30%以下の時、ダメージ倍率 +50%",
        type: "passive",
        rarity: "rare",
        conditionText: "Strength 30+",
        condition: (p) => (p.getDynamicProperty("deepcraft:strength") || 1) >= 30
    },
    {
        id: "last_stand",
        name: "§eLast Stand",
        description: "HP30%以下の時、受けるダメージ半減",
        type: "passive",
        rarity: "rare",
        conditionText: "Fortitude 30+",
        condition: (p) => (p.getDynamicProperty("deepcraft:fortitude") || 1) >= 30
    },
    {
        id: "assassin",
        name: "§eAssassin",
        description: "スニーク中の攻撃ダメージ 2.0倍",
        type: "passive",
        rarity: "rare",
        conditionText: "Agility 30+",
        condition: (p) => (p.getDynamicProperty("deepcraft:agility") || 1) >= 30
    },
    {
        id: "vampirism",
        name: "§eVampirism",
        description: "攻撃時にHPを2回復",
        type: "passive",
        rarity: "rare",
        conditionText: "Willpower 30+",
        condition: (p) => (p.getDynamicProperty("deepcraft:willpower") || 1) >= 30
    },
    {
        id: "executioner",
        name: "§eExecutioner",
        description: "相手のHPが50%以下の時、ダメージ倍率 +30%",
        type: "passive",
        rarity: "rare",
        conditionText: "Strength 30+",
        condition: (p) => (p.getDynamicProperty("deepcraft:strength") || 1) >= 30
    },
    {
        id: "evasion",
        name: "§eEvasion",
        description: "15%の確率でダメージを完全無効化",
        type: "passive",
        rarity: "rare",
        conditionText: "Agility 30+",
        condition: (p) => (p.getDynamicProperty("deepcraft:agility") || 1) >= 30
    },
    {
        id: "thorns_master",
        name: "§eThorns Master",
        description: "受けたダメージの30%を相手に与える",
        type: "passive",
        rarity: "rare",
        conditionText: "Defense 30+",
        condition: (p) => (p.getDynamicProperty("deepcraft:defense") || 1) >= 30
    },

    // ==========================================
    //  Tier 4: Epic / Legendary (奥義) - Req: 50+
    // ==========================================
    {
        id: "glass_cannon",
        name: "§dGlass Cannon",
        description: "ダメージ2.0倍になるが、最大HPが50%になる",
        type: "passive",
        rarity: "epic",
        conditionText: "Strength 50+ / Fortitude < 20",
        condition: (p) => (p.getDynamicProperty("deepcraft:strength") || 1) >= 50 && (p.getDynamicProperty("deepcraft:fortitude") || 1) < 20
    },
    {
        id: "immortal",
        name: "§dImmortal",
        description: "毎秒HPが1ずつ自然回復する",
        type: "passive",
        rarity: "epic",
        conditionText: "Fortitude 50+ / Willpower 50+",
        condition: (p) => (p.getDynamicProperty("deepcraft:fortitude") || 1) >= 50 && (p.getDynamicProperty("deepcraft:willpower") || 1) >= 50
    },
    {
        id: "godspeed",
        name: "§dGodspeed",
        description: "移動速度レベル +15 (超高速)",
        type: "passive",
        rarity: "epic",
        conditionText: "Agility 50+",
        condition: (p) => (p.getDynamicProperty("deepcraft:agility") || 1) >= 50
    },
    {
        id: "elemental_lord",
        name: "§6§lElemental Lord",
        description: "炎・氷(凍結)・落雷ダメージを無効化",
        type: "passive",
        rarity: "legendary",
        conditionText: "All Elements 20+",
        condition: (p) => 
            (p.getDynamicProperty("deepcraft:flame") || 1) >= 20 &&
            (p.getDynamicProperty("deepcraft:frost") || 1) >= 20 &&
            (p.getDynamicProperty("deepcraft:gale") || 1) >= 20 &&
            (p.getDynamicProperty("deepcraft:thunder") || 1) >= 20
    },
    {
        id: "divine_protection", // 元Fresh Blood (ステータス操作禁止のため変更)
        name: "§a§lDivine Protection",
        description: "致死ダメージを受けた時、HPを全回復 (クールダウン有)",
        type: "passive",
        rarity: "legendary",
        conditionText: "Lucky Find",
        condition: (player) => Math.random() < 0.05
    }
];