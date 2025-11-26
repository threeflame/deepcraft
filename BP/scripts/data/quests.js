// BP/scripts/data/quests.js

export const QUEST_POOL = {
    "hunt_zombies": {
        name: "Undead Hunter",
        description: "ゾンビを5体倒せ",
        type: "kill",
        target: "minecraft:zombie",
        amount: 5,
        reward: { xp: 500, item: "minecraft:iron_ingot", count: 3 }
    },
    "hunt_skeletons": {
        name: "Bone Collector",
        description: "スケルトンを3体倒せ",
        type: "kill",
        target: "minecraft:skeleton",
        amount: 3,
        reward: { xp: 600 }
    },
    "hunt_spiders": {
        name: "Pest Control",
        description: "クモを5体倒せ",
        type: "kill",
        target: "minecraft:spider",
        amount: 5,
        reward: { xp: 800 }
    }
};