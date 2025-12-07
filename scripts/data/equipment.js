// BP/scripts/data/equipment.js

export const EQUIPMENT_POOL = {
    // ==========================================
    //  Tier 0: Starter
    // ==========================================
    "trainee_sword": {
        name: "§fTrainee Sword",
        lore: ["§7鍛錬用の剣。", "§eATK: 5"],
        baseItem: "minecraft:wooden_sword",
        stats: { atk: 5 },
        req: {},
        scaling: { medium: 2 }
    },
    "rusty_axe": {
        name: "§fRusty Axe",
        lore: ["§7錆びた斧。", "§eATK: 8"],
        baseItem: "minecraft:wooden_axe",
        stats: { atk: 8 },
        req: {},
        scaling: { heavy: 2 }
    },
    "goblin_ear": {
        name: "§aGoblin Ear",
        lore: ["§7素材。"],
        baseItem: "minecraft:rabbit_foot",
        stats: {}, req: {}
    },

    // ==========================================
    //  Tier 1: Common
    // ==========================================
    "soldier_blade": {
        name: "§bSoldier Blade",
        lore: ["§7兵士の剣。", "§eATK: 25", "§cReq: Str 10"],
        baseItem: "deepcraft:soldier_blade",
        stats: { atk: 25 },
        req: { strength: 10 },
        scaling: { medium: 5 }
    },
    "thief_dagger": {
        name: "§bThief Dagger",
        lore: ["§7盗賊の短剣。", "§eATK: 20", "§cReq: Agi 10"],
        baseItem: "minecraft:iron_sword",
        stats: { atk: 20 },
        req: { agility: 10 },
        scaling: { light: 4 }
    },
    "heavy_mace": {
        name: "§bHeavy Mace",
        lore: ["§7メイス。", "§eATK: 35", "§cReq: Heavy 15"],
        baseItem: "minecraft:iron_shovel",
        stats: { atk: 35 },
        req: { heavy: 15 },
        scaling: { heavy: 6 }
    },
    "hunter_bow": {
        name: "§bHunter Bow",
        lore: ["§7狩人の弓。", "§eATK: 25", "§cReq: Light 15"],
        baseItem: "minecraft:bow",
        stats: { atk: 25 },
        req: { light: 15 },
        scaling: { light: 5 }
    },

    // ==========================================
    //  Tier 2: Uncommon
    // ==========================================
    "katana": {
        name: "§aKatana",
        lore: ["§7刀。", "§eATK: 40", "§cReq: Agi 20"],
        baseItem: "minecraft:iron_sword",
        stats: { atk: 40 },
        req: { agility: 20, medium: 15 },
        scaling: { medium: 8 }
    },
    "battle_axe": {
        name: "§aBattle Axe",
        lore: ["§7戦斧。", "§eATK: 50", "§cReq: Str 25"],
        baseItem: "minecraft:iron_axe",
        stats: { atk: 50 },
        req: { strength: 25, heavy: 10 },
        scaling: { heavy: 7 }
    },
    "noble_rapier": {
        name: "§aNoble Rapier",
        lore: ["§7レイピア。", "§eATK: 35"],
        baseItem: "minecraft:golden_sword",
        stats: { atk: 35 },
        req: { charisma: 20, agility: 20 },
        scaling: { medium: 6 }
    },
    "obsidian_shield": {
        name: "§aObsidian Shield",
        lore: ["§7盾。", "§bDEF: 40"],
        baseItem: "minecraft:shield",
        stats: { def: 40 },
        req: { fortitude: 30 },
        scaling: {}
    },

    // ==========================================
    //  Tier 3: Rare / Elemental
    // ==========================================
    "wind_spear": {
        name: "§eWind Spear",
        lore: ["§7風槍。", "§eATK: 45"],
        baseItem: "minecraft:iron_shovel",
        stats: { atk: 45 },
        req: { gale: 20, agility: 30 },
        skillId: "gale_dash",
        scaling: { medium: 5, gale: 4 }
    },
    "flame_sword": {
        name: "§eFlame Sword",
        lore: ["§7炎剣。", "§eATK: 50"],
        baseItem: "minecraft:golden_sword",
        stats: { atk: 50 },
        req: { flame: 25, strength: 25 },
        skillId: "fireball",
        scaling: { medium: 5, flame: 5 }
    },
    "frost_dagger": {
        name: "§eFrost Dagger",
        lore: ["§7氷剣。", "§eATK: 35"],
        baseItem: "minecraft:iron_sword",
        stats: { atk: 35 },
        req: { frost: 25, agility: 25 },
        skillId: "ice_shard",
        scaling: { light: 4, frost: 5 }
    },
    "thunder_hammer": {
        name: "§eThunder Hammer",
        lore: ["§7雷鎚。", "§eATK: 60"],
        baseItem: "minecraft:iron_pickaxe",
        stats: { atk: 60 },
        req: { thunder: 30, heavy: 30 },
        skillId: "thunder_smite",
        scaling: { heavy: 6, thunder: 4 }
    },
    "paladin_mace": {
        name: "§ePaladin Mace",
        lore: ["§7聖騎士のメイス。", "§eATK: 50"],
        baseItem: "minecraft:golden_axe",
        stats: { atk: 50 },
        req: { fortitude: 30, willpower: 30 },
        skillId: "healing_aura",
        scaling: { medium: 6 }
    },

    // ==========================================
    //  Tier 4: Epic / Legendary
    // ==========================================
    "heavy_claymore": {
        name: "§dHeavy Claymore",
        lore: ["§7大剣。", "§eATK: 70"],
        baseItem: "minecraft:diamond_sword",
        stats: { atk: 70 },
        req: { strength: 50, heavy: 30 },
        scaling: { heavy: 10 }
    },
    "spell_blade": {
        name: "§dSpell Blade",
        lore: ["§7魔導剣。", "§eATK: 60"],
        baseItem: "minecraft:diamond_sword",
        stats: { atk: 60 },
        req: { intelligence: 50 },
        scaling: { medium: 8 } // 修正: Int依存を廃止しMedium Masteryへ
    },
    "titan_axe": {
        name: "§6§lTitan Axe",
        lore: ["§7巨人の斧。", "§eATK: 80"],
        baseItem: "minecraft:netherite_axe",
        stats: { atk: 80 },
        req: { strength: 60, heavy: 40 },
        skillId: "ground_smash",
        scaling: { heavy: 12 }
    },
    "warlord_blade": {
        name: "§6§lWarlord Blade",
        lore: ["§7覇王の剣。", "§eATK: 100"],
        baseItem: "minecraft:netherite_sword",
        stats: { atk: 100 },
        req: { strength: 50, charisma: 50 },
        skillId: "war_cry",
        scaling: { medium: 11 }
    },
    "necromancer_staff": {
        name: "§5Necromancer Staff",
        lore: ["§7召喚杖。", "§eATK: 20"],
        baseItem: "minecraft:golden_hoe",
        stats: { atk: 20 },
        req: { intelligence: 30, charisma: 20 },
        skillId: "raise_dead",
        scaling: { light: 8 } // 修正: Int/Cha依存を廃止しLight Masteryへ
    },

    // ==========================================
    //  Debug / Testing
    // ==========================================
    "testing_wand": { name: "§6Testing Wand", lore: [], baseItem: "minecraft:breeze_rod", stats: { atk: 0 }, req: {}, skillId: "target_mob", scaling: {} },
    "testing_staff": { name: "§cTesting Staff", lore: [], baseItem: "minecraft:blaze_rod", stats: { atk: 0 }, req: {}, skillId: "target_player", scaling: {} },
    
    // 攻撃速度検証用
    "debug_fast_blade": {
        name: "§b§lGodspeed Dagger",
        lore: ["§7[DEBUG] 攻撃速度: 4 Tick (0.2s)"],
        baseItem: "minecraft:iron_sword",
        stats: { atk: 10 },
        req: {},
        scaling: { light: 5 }
    },
    "debug_slow_hammer": {
        name: "§4§lSloth Hammer",
        lore: ["§7[DEBUG] 攻撃速度: 60 Tick (3.0s)"],
        baseItem: "minecraft:iron_shovel",
        stats: { atk: 100 },
        req: {},
        scaling: { heavy: 10 }
    }
};

export const EQUIPMENT_STATS = {
    // Vanilla
    "minecraft:wooden_sword": { speed: 12 },
    "minecraft:stone_sword": { speed: 12 },
    "minecraft:iron_sword": { speed: 12 },
    "minecraft:golden_sword": { speed: 12 },
    "minecraft:diamond_sword": { speed: 12 },
    "minecraft:netherite_sword": { speed: 12 },
    
    "minecraft:wooden_axe": { speed: 20 },
    "minecraft:stone_axe": { speed: 20 },
    "minecraft:iron_axe": { speed: 20 },
    "minecraft:golden_axe": { speed: 20 },
    "minecraft:diamond_axe": { speed: 20 },
    "minecraft:netherite_axe": { speed: 20 },
    
    // Custom
    "thief_dagger": { speed: 8 },
    "katana": { speed: 10 },
    "soldier_blade": { speed: 12 },
    "heavy_claymore": { speed: 18 },
    "titan_axe": { speed: 24 },
    "necromancer_staff": { speed: 15 },

    // Debug
    "debug_fast_blade": { speed: 4 },
    "debug_slow_hammer": { speed: 60 }
};