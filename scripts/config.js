// BP/scripts/config.js

export const CONFIG = {
    STAT_POINTS_PER_LEVEL: 15,
    XP_BASE_COST: 100,
    XP_LEVEL_MULTIPLIER: 50,
    DEATH_ITEM_DROP_RATE: 0.5,
    MAX_PROFILES: 3,

    // Ether System (魔法を使いやすくするため容量UP)
    ETHER_BASE: 100,
    ETHER_PER_INT: 5.0,
    ETHER_REGEN_BASE: 2.0,
    ETHER_REGEN_PER_WILL: 0.5,

    // Combat System Constants (Reforged v3)
    COMBAT: {
        BASE_CRIT_CHANCE: 0.05, // 5%
        BASE_CRIT_MULT: 1.5,    // 1.5x
        DEFENSE_CONSTANT: 150,  // 軽減率計算の分母定数 (Score / (Score + 150))
        HP_REGEN_RATE: 2.0,     // 自然回復量
        MIN_DAMAGE: 1,
        COMBAT_MODE_DURATION: 20
    },

    STATS: {
        strength: "Strength",
        fortitude: "Fortitude", // HP & 物理防御
        agility: "Agility",
        intelligence: "Intelligence",
        willpower: "Willpower",
        charisma: "Charisma",
        defense: "Defense", // ※旧ステータス（UI互換性のため残すが計算では非推奨）
        flame: "Flame",
        frost: "Frost",
        gale: "Gale",
        thunder: "Thunder",
        heavy: "Mastery: Heavy",
        medium: "Mastery: Medium",
        light: "Mastery: Light"
    }
};