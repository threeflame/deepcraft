// BP/scripts/config.js

export const CONFIG = {
    STAT_POINTS_PER_LEVEL: 15,
    XP_BASE_COST: 100,
    XP_LEVEL_MULTIPLIER: 50,
    DEATH_ITEM_DROP_RATE: 0.5,
    MAX_PROFILES: 3,
    
    // Void (エンド) システム
    VOID_MAX_DEATHS: 3,           // Overworldでの最大死亡回数
    VOID_SPAWN_X: 2880,           // Void転送先X座標
    VOID_SPAWN_Y: 16,             // Void転送先Y座標
    VOID_SPAWN_Z: 3370,           // Void転送先Z座標

    // Ether System
    ETHER_BASE: 100,
    ETHER_PER_INT: 5.0,
    ETHER_REGEN_BASE: 2.0,
    ETHER_REGEN_PER_WILL: 0.5,

    // Combat System Constants
    COMBAT: {
        BASE_CRIT_CHANCE: 0.05,
        BASE_CRIT_MULT: 1.5,
        DEFENSE_CONSTANT: 150,
        HP_REGEN_RATE: 0.1,
        MIN_DAMAGE: 1,
        COMBAT_MODE_DURATION: 20
    },

    STATS: {
        strength: "Strength",
        fortitude: "Fortitude",
        agility: "Agility",
        intelligence: "Intelligence",
        willpower: "Willpower",
        charisma: "Charisma",
        defense: "Defense",
        flame: "Flame",
        frost: "Frost",
        gale: "Gale",
        thunder: "Thunder",
        heavy: "Mastery: Heavy",
        medium: "Mastery: Medium",
        light: "Mastery: Light"
    }
};