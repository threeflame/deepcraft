// BP/scripts/config.js

export const CONFIG = {
    STAT_POINTS_PER_LEVEL: 15,
    XP_BASE_COST: 100,
    XP_LEVEL_MULTIPLIER: 50,
    DEATH_ITEM_DROP_RATE: 0.5,
    MAX_PROFILES: 3,

    // Ether System
    ETHER_BASE: 20,
    ETHER_PER_INT: 2.5,
    ETHER_REGEN_BASE: 1.0,
    ETHER_REGEN_PER_WILL: 0.2,

    // ★追加: Combat System Constants
    COMBAT: {
        BASE_CRIT_CHANCE: 0.05, // 基礎クリティカル率 5%
        BASE_CRIT_MULT: 1.5,    // 基礎クリティカル倍率 1.5倍
        DEFENSE_CONSTANT: 0.5,  // Fortitudeの防御への寄与率
        MIN_DAMAGE: 1           // 最低保証ダメージ
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