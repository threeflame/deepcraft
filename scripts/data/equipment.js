// BP/scripts/data/equipment.js

export const EQUIPMENT_POOL = {
    // ==========================================
    //  Tier 0: Starter
    // ==========================================
    "trainee_sword": {
        name: "§fTrainee Sword",
        lore: ["§7鍛錬用の剣。", "§eATK: 3"],
        baseItem: "minecraft:wooden_sword",
        stats: { atk: 3 }, // ★追加
        req: {} 
    },
    "rusty_axe": {
        name: "§fRusty Axe",
        lore: ["§7錆びついた斧。", "§eATK: 4"],
        baseItem: "minecraft:wooden_axe",
        stats: { atk: 4 }, // ★追加
        req: {} 
    },
    "goblin_ear": {
        name: "§aゴブリンの耳",
        lore: ["§7マーケットで売れるかもしれない。"],
        baseItem: "minecraft:rabbit_foot",
        stats: {},
        req: {}
    },

    // ==========================================
    //  Tier 1: Common
    // ==========================================
    "soldier_blade": {
        name: "§bSoldier Blade",
        lore: ["§7兵士の剣。", "§eATK: 6", "§cReq: Strength 10"],
        baseItem: "minecraft:iron_sword",
        stats: { atk: 6 },
        req: { strength: 10 }
    },
    "thief_dagger": {
        name: "§bThief Dagger",
        lore: ["§7盗賊の短剣。", "§eATK: 4", "§cReq: Agility 10"],
        baseItem: "minecraft:iron_sword",
        stats: { atk: 4 },
        req: { agility: 10 }
    },
    "heavy_mace": {
        name: "§bHeavy Mace",
        lore: ["§7重たいメイス。", "§eATK: 8", "§cReq: Heavy 15"],
        baseItem: "minecraft:iron_shovel",
        stats: { atk: 8 },
        req: { heavy: 15 }
    },
    "hunter_bow": {
        name: "§bHunter Bow",
        lore: ["§7狩人の弓。", "§eATK: 5", "§cReq: Light 15"],
        baseItem: "minecraft:bow",
        stats: { atk: 5 },
        req: { light: 15 }
    },

    // ==========================================
    //  Tier 2: Uncommon
    // ==========================================
    "katana": {
        name: "§aKatana",
        lore: ["§7切れ味鋭い刀。", "§eATK: 10", "§cReq: Agility 20, Medium 15"],
        baseItem: "minecraft:iron_sword",
        stats: { atk: 10 },
        req: { agility: 20, medium: 15 }
    },
    "battle_axe": {
        name: "§aBattle Axe",
        lore: ["§7戦斧。", "§eATK: 12", "§cReq: Strength 25, Heavy 10"],
        baseItem: "minecraft:iron_axe",
        stats: { atk: 12 },
        req: { strength: 25, heavy: 10 }
    },
    "noble_rapier": {
        name: "§aNoble Rapier",
        lore: ["§7貴族のレイピア。", "§eATK: 9", "§cReq: Charisma 20, Agility 20"],
        baseItem: "minecraft:golden_sword",
        stats: { atk: 9 },
        req: { charisma: 20, agility: 20 }
    },
    "obsidian_shield": {
        name: "§aObsidian Shield",
        lore: ["§7堅牢な盾。", "§eDEF: 15", "§cReq: Defense 30"],
        baseItem: "minecraft:shield",
        stats: { def: 15 }, // ★防具なのでDEF
        req: { defense: 30 }
    },

    // ==========================================
    //  Tier 3: Rare / Elemental
    // ==========================================
    "wind_spear": {
        name: "§eWind Spear",
        lore: ["§7風を纏う槍。", "§eATK: 14", "§6[R-Click]: Gale Dash", "§cReq: Gale 20, Agility 30"],
        baseItem: "minecraft:iron_shovel",
        stats: { atk: 14 },
        req: { gale: 20, agility: 30 },
        skillId: "gale_dash"
    },
    "flame_sword": {
        name: "§eFlame Sword",
        lore: ["§7炎の魔剣。", "§eATK: 16", "§6[R-Click]: Fireball", "§cReq: Flame 25, Strength 25"],
        baseItem: "minecraft:golden_sword",
        stats: { atk: 16 },
        req: { flame: 25, strength: 25 },
        skillId: "fireball"
    },
    "frost_dagger": {
        name: "§eFrost Dagger",
        lore: ["§7氷の短剣。", "§eATK: 12", "§6[R-Click]: Ice Shard", "§cReq: Frost 25, Agility 25"],
        baseItem: "minecraft:iron_sword",
        stats: { atk: 12 },
        req: { frost: 25, agility: 25 },
        skillId: "ice_shard"
    },
    "thunder_hammer": {
        name: "§eThunder Hammer",
        lore: ["§7雷神の鎚。", "§eATK: 18", "§6[R-Click]: Smite", "§cReq: Thunder 30, Heavy 30"],
        baseItem: "minecraft:iron_pickaxe",
        stats: { atk: 18 },
        req: { thunder: 30, heavy: 30 },
        skillId: "thunder_smite"
    },
    "paladin_mace": {
        name: "§ePaladin Mace",
        lore: ["§7聖騎士のメイス。", "§eATK: 15", "§6[R-Click]: Healing Aura", "§cReq: Fortitude 30, Willpower 30"],
        baseItem: "minecraft:golden_axe",
        stats: { atk: 15 },
        req: { fortitude: 30, willpower: 30 },
        skillId: "healing_aura"
    },

    // ==========================================
    //  Tier 4: Epic / Legendary
    // ==========================================
    "heavy_claymore": {
        name: "§dHeavy Claymore",
        lore: ["§7破壊の大剣。", "§eATK: 25", "§cReq: Strength 50, Heavy 30"],
        baseItem: "minecraft:diamond_sword",
        stats: { atk: 25 },
        req: { strength: 50, heavy: 30 }
    },
    "spell_blade": {
        name: "§dSpell Blade",
        lore: ["§7魔導剣。", "§eATK: 20", "§cReq: Intelligence 50"],
        baseItem: "minecraft:diamond_sword",
        stats: { atk: 20 },
        req: { intelligence: 50 }
    },
    "titan_axe": {
        name: "§6§lTitan Axe",
        lore: ["§7巨人の斧。", "§eATK: 35", "§6[R-Click]: Ground Smash", "§cReq: Strength 60, Heavy 40"],
        baseItem: "minecraft:netherite_axe",
        stats: { atk: 35 },
        req: { strength: 60, heavy: 40 },
        skillId: "ground_smash"
    },
    "warlord_blade": {
        name: "§6§lWarlord Blade",
        lore: ["§7覇王の剣。", "§eATK: 30", "§6[R-Click]: War Cry", "§cReq: Strength 50, Charisma 50"],
        baseItem: "minecraft:netherite_sword",
        stats: { atk: 30 },
        req: { strength: 50, charisma: 50 },
        skillId: "war_cry"
    }
};