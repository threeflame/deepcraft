// BP/scripts/player/player_manager.js
import { world, system, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { calculateEntityStats } from "./stat_calculator.js";
import { EQUIPMENT_POOL } from "../data/equipment.js";
import { decodeLoreData } from "../systems/lore_manager.js";
import { getItemId } from "../systems/lore_manager.js";

export function handlePlayerSpawn(event) {
    const player = event.player;

    if (!player.getDynamicProperty("deepcraft:active_profile")) {
        initializePlayer(player);
    }

    const logKey = `combat_log:${player.id}`;
    if (world.getDynamicProperty(logKey)) {
        world.setDynamicProperty(logKey, undefined);
        player.setDynamicProperty("deepcraft:combat_timer", 0);

        const inventory = player.getComponent("inventory").container;
        if (inventory) {
            for (let i = 0; i < inventory.size; i++) inventory.setItem(i, undefined);
        }

        const equip = player.getComponent("equippable");
        if (equip) {
            [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Mainhand, EquipmentSlot.Offhand].forEach(slotId => {
                const slot = equip.getEquipmentSlot(slotId);
                if (slot) slot.setItem(undefined);
            });
        }

        player.sendMessage("§c§l[警告] 戦闘中に切断したため、ペナルティとして死亡します...");
        player.playSound("random.anvil_land");

        system.runTimeout(() => {
            // ★修正: isValid プロパティ参照
            if (player.isValid) {
                player.applyDamage(99999, { cause: EntityDamageCause.suicide });
                player.sendMessage("§c§l-> 処刑されました。(Combat Log Penalty)");
            }
        }, 60);

        return;
    }

    applyStatsToEntity(player);
    player.setDynamicProperty("deepcraft:hp", player.getDynamicProperty("deepcraft:max_hp"));
    player.setDynamicProperty("deepcraft:combat_timer", 0);

    // ★削除: scale_reset のブロックを削除しました
}

function initializePlayer(player) {
    player.setDynamicProperty("deepcraft:active_profile", 1);
    player.setDynamicProperty("deepcraft:ether", CONFIG.ETHER_BASE);
    player.setDynamicProperty("deepcraft:gold", 0);
    player.setDynamicProperty("deepcraft:hp", 100);
    player.setDynamicProperty("deepcraft:max_hp", 100);
    loadProfile(player, 1);
    player.sendMessage("§aDeepCraftシステムを初期化しました。");
}

export function getXpCostForLevel(level) {
    return CONFIG.XP_BASE_COST + (level * CONFIG.XP_LEVEL_MULTIPLIER);
}

export function addXP(player, amount) {
    let currentXP = player.getDynamicProperty("deepcraft:xp") || 0;
    player.setDynamicProperty("deepcraft:xp", currentXP + amount);
    player.sendMessage(`§e+${amount} XP`);
}

export function applyStatsToEntity(player) {
    const stats = calculateEntityStats(player);
    player.setDynamicProperty("deepcraft:max_hp", stats.maxHP);

    const current = player.getDynamicProperty("deepcraft:hp");
    if (current === undefined || current > stats.maxHP) {
        player.setDynamicProperty("deepcraft:hp", stats.maxHP);
    }

    const movement = player.getComponent("minecraft:movement");
    if (movement) {
        const BASE_SPEED = 0.1;
        movement.setCurrentValue(movement.defaultValue * stats.speed);
    }
}

export function applyNumericalPassives(player) {
    let regenAmount = 0;
    if (player.hasTag("talent:immortal")) regenAmount += 1;

    const headBlock = player.dimension.getBlock(player.getHeadLocation());
    if (player.hasTag("talent:aquatic_life") && headBlock?.typeId.includes("water")) {
        regenAmount += 1;
    }

    if (regenAmount > 0) {
        const cur = player.getDynamicProperty("deepcraft:hp") || 0;
        const max = player.getDynamicProperty("deepcraft:max_hp") || 100;
        if (cur < max) player.setDynamicProperty("deepcraft:hp", Math.min(cur + regenAmount, max));
    }

    if (player.hasTag("talent:full_belly")) {
        player.addEffect("saturation", 20, { amplifier: 0, showParticles: false });
    }
}

export function applyEquipmentPenalties(player) {
    const equipment = player.getComponent("equippable");
    let armorPenalty = false;
    if (equipment) {
        [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet].forEach(slotId => {
            const slot = equipment.getEquipmentSlot(slotId);
            if (slot && !checkReq(player, slot.getItem()).valid) armorPenalty = true;
        });
    }
    if (armorPenalty) {
        player.addTag("debuff:heavy_armor");
    } else {
        player.removeTag("debuff:heavy_armor");
    }
}

export function checkReq(player, item) {
    if (!item) return { valid: true };
    const customId = getItemId(item);
    if (!customId) return { valid: true };
    const def = EQUIPMENT_POOL[customId];
    if (!def || !def.req) return { valid: true };

    for (const stat in def.req) {
        const required = def.req[stat];
        const current = player.getDynamicProperty(`deepcraft:${stat}`) || 0;
        if (current < required) return { valid: false, missing: `${CONFIG.STATS[stat]} ${required}` };
    }
    return { valid: true };
}

export function saveProfile(player, slot) {
    const data = {
        level: player.getDynamicProperty("deepcraft:level") || 1,
        xp: player.getDynamicProperty("deepcraft:xp") || 0,
        stats: {},
        talents: player.getTags().filter(t => t.startsWith("talent:")),
        quests: JSON.parse(player.getDynamicProperty("deepcraft:quest_data") || "{}")
    };
    for (const key in CONFIG.STATS) data.stats[key] = player.getDynamicProperty(`deepcraft:${key}`) || 0;
    player.setDynamicProperty(`deepcraft:profile_${slot}`, JSON.stringify(data));
}

export function loadProfile(player, slot) {
    const json = player.getDynamicProperty(`deepcraft:profile_${slot}`);
    const data = json ? JSON.parse(json) : { level: 1, xp: 0, stats: {}, talents: [], quests: {} };
    
    player.setDynamicProperty("deepcraft:level", data.level || 1);
    player.setDynamicProperty("deepcraft:xp", data.xp || 0);
    player.setDynamicProperty("deepcraft:quest_data", JSON.stringify(data.quests || {}));
    for (const key in CONFIG.STATS) player.setDynamicProperty(`deepcraft:${key}`, data.stats[key] || 0);
    player.getTags().filter(t => t.startsWith("talent:")).forEach(t => player.removeTag(t));
    (data.talents || []).forEach(t => player.addTag(t));
    player.setDynamicProperty("deepcraft:active_profile", slot);
    applyStatsToEntity(player);
    const stats = calculateEntityStats(player);
    player.setDynamicProperty("deepcraft:hp", stats.maxHP);
}

export function resetCurrentProfile(player) {
    const currentSlot = player.getDynamicProperty("deepcraft:active_profile") || 1;
    player.setDynamicProperty(`deepcraft:profile_${currentSlot}`, undefined);
    player.setDynamicProperty("deepcraft:quest_data", undefined);
    loadProfile(player, currentSlot);
    player.playSound("random.break");
    player.sendMessage(`§c[デバッグ] プロファイル スロット${currentSlot} をリセットしました。`);
}