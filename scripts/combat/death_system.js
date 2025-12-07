// BP/scripts/combat/death_system.js
import { world, ItemStack } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { QUEST_POOL } from "../data/quests.js";
import { MOB_POOL } from "../data/mobs.js";
import { EQUIPMENT_POOL } from "../data/equipment.js";
import { addXP } from "../player/player_manager.js";
import { createCustomItem } from "../systems/item_handler.js";

export const COMBAT_LOG_CACHE = new Map();

export function handleEntityDie(event) {
    const { deadEntity: victim, damageSource } = event;
    const attacker = damageSource.damagingEntity;

    if (attacker?.typeId === "minecraft:player") {
        handlePlayerKill(attacker, victim);
    }

    if (victim.typeId === "minecraft:player") {
        handlePlayerDeath(victim);
    }
}

export function handlePlayerKill(player, victim) {
    // (クエスト・ドロップ処理は変更なし)
    const questData = JSON.parse(player.getDynamicProperty("deepcraft:quest_data") || "{}");
    for (const qId in questData) {
        const q = questData[qId];
        const def = QUEST_POOL[qId];
        if (q.status === "active" && def.type === "kill" && def.target === victim.typeId) {
            q.progress++;
            if (q.progress >= def.amount) {
                q.status = "completed";
                player.playSound("random.levelup");
                player.sendMessage(`§aクエスト完了: ${def.name}`);
            }
            player.setDynamicProperty("deepcraft:quest_data", JSON.stringify(questData));
        }
    }
    if (victim.hasTag("deepcraft:boss")) {
        const bossId = victim.getDynamicProperty("deepcraft:boss_id");
        const def = MOB_POOL[bossId];
        const partyId = player.getDynamicProperty("deepcraft:party_id");
        const xpShareRadius = 30; 
        const xpShareRate = 0.2;  
        if (def?.drops) {
            def.drops.forEach(drop => {
                if (drop.chance && Math.random() >= drop.chance) return;
                if (drop.type === "xp") {
                    addXP(player, drop.amount);
                    if (partyId) {
                        const bonusXp = Math.floor(drop.amount * xpShareRate);
                        world.getAllPlayers().forEach(p => {
                            if (p.id !== player.id && p.getDynamicProperty("deepcraft:party_id") === partyId) {
                                const dx = player.location.x - p.location.x;
                                const dy = player.location.y - p.location.y;
                                const dz = player.location.z - p.location.z;
                                const distSq = dx * dx + dy * dy + dz * dz;
                                if (distSq <= xpShareRadius * xpShareRadius) addXP(p, bonusXp);
                            }
                        });
                    }
                }
                if (drop.type === "item") {
                    let itemName;
                    const dropCount = drop.amount || 1;
                    for (let i = 0; i < dropCount; i++) {
                        if (EQUIPMENT_POOL[drop.id]) {
                            const item = createCustomItem(drop.id, drop.sellable || false); 
                            itemName = item.nameTag;
                            victim.dimension.spawnItem(item, victim.location);
                        } else {
                            const item = new ItemStack(drop.id, 1);
                            itemName = `§f${drop.id.replace("minecraft:", "").replace(/_/g, " ")}`;
                            victim.dimension.spawnItem(item, victim.location);
                        }
                    }
                    player.sendMessage(`§6§lレアドロップ！ §r獲得: ${itemName} x${dropCount}`);
                }
            });
        }
    }
    if (player.hasTag("talent:exp_boost")) addXP(player, 50);
}

function handlePlayerDeath(player) {
    // ステータスリセット
    player.removeTag("deepcraft:dead");
    player.setDynamicProperty("deepcraft:combat_timer", 0);
    player.setDynamicProperty("deepcraft:hp", player.getDynamicProperty("deepcraft:max_hp"));

    // ★変更: 単純な死亡回数カウントのみ (Voidロジック削除)
    let deathCount = player.getDynamicProperty("deepcraft:death_count") || 0;
    deathCount++;
    player.setDynamicProperty("deepcraft:death_count", deathCount);
    
    player.sendMessage(`§c[DEATH] 死亡しました。 (通算: ${deathCount}回)`);

    // 共通: アイテム & XPロスト
    const currentXP = player.getDynamicProperty("deepcraft:xp") || 0;
    const level = player.getDynamicProperty("deepcraft:level") || 1;
    const lossRate = Math.min(level * 0.05, 1.0); 
    const remainingXP = Math.floor(currentXP * (1.0 - lossRate));
    player.setDynamicProperty("deepcraft:xp", remainingXP);
    
    if (currentXP > remainingXP) {
        player.sendMessage(`§cXPロスト: -${currentXP - remainingXP} (${(lossRate * 100).toFixed(0)}%)`);
    }

    const inventory = player.getComponent("inventory").container;
    const droppedItems = [];
    for (let i = 9; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (item && Math.random() < CONFIG.DEATH_ITEM_DROP_RATE) {
            droppedItems.push(item.clone());
            inventory.setItem(i, undefined);
        }
    }
    if (droppedItems.length > 0) {
        try {
            const soul = player.dimension.spawnEntity("minecraft:chest_minecart", { x: player.location.x, y: player.location.y + 1.0, z: player.location.z });
            soul.nameTag = `§bSoul of ${player.name}`;
            soul.setDynamicProperty("deepcraft:owner_id", player.id);
            const soulContainer = soul.getComponent("inventory").container;
            droppedItems.forEach(item => soulContainer.addItem(item));
            player.sendMessage(`§bアイテムの一部をSoulとしてその場に残しました。`);
        } catch (e) { console.warn(`Soul Spawn Error: ${e}`); }
    }
}

export function handlePlayerLeave(event) {
    // (変更なし)
    const backup = COMBAT_LOG_CACHE.get(event.playerId);
    if (backup) {
        const soul = world.getDimension(backup.dimensionId).spawnEntity("minecraft:chest_minecart", { x: backup.location.x, y: backup.location.y + 1.0, z: backup.location.z });
        soul.nameTag = `§c${backup.name}の逃亡跡 (Soul)`;
        soul.setDynamicProperty("deepcraft:owner_id", event.playerId);
        const soulContainer = soul.getComponent("inventory").container;
        backup.items.forEach(item => { if (item) soulContainer.addItem(item); });
        world.setDynamicProperty(`combat_log:${event.playerId}`, true);
        world.sendMessage(`§c§l${backup.name} が戦闘から逃亡しました！ アイテムがその場にドロップしました。`);
        COMBAT_LOG_CACHE.delete(event.playerId);
    }
}