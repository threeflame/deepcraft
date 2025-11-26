// BP/scripts/config.js

export const CONFIG = {
    STAT_POINTS_PER_LEVEL: 15,
    XP_BASE_COST: 100,
    XP_LEVEL_MULTIPLIER: 50,
    DEATH_ITEM_DROP_RATE: 0.5,
    MAX_PROFILES: 3,

    // ★追加: エーテル設定
    ETHER_BASE: 20,          // 知力0でも持っている最低エーテル
    ETHER_PER_INT: 2.5,      // 知力1あたりの最大エーテル増加量
    ETHER_REGEN_BASE: 1.0,   // 1秒あたりの基本回復量
    ETHER_REGEN_PER_WILL: 0.2, // Willpower 1あたりの回復ボーナス(隠し味)

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