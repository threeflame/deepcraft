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

function handlePlayerKill(player, victim) {
    // クエスト進行
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

    // ボスドロップ
    if (victim.hasTag("deepcraft:boss")) {
        const bossId = victim.getDynamicProperty("deepcraft:boss_id");
        const def = MOB_POOL[bossId];
        if (def?.drops) {
            def.drops.forEach(drop => {
                if (drop.chance && Math.random() > drop.chance) return;
                if (drop.type === "xp") {
                    addXP(player, drop.amount);
                    player.sendMessage(`§eボス撃破！ +${drop.amount} XP`);
                }
                if (drop.type === "item") {
                    const item = createCustomItem(drop.id);
                    player.dimension.spawnItem(item, victim.location);
                    player.sendMessage(`§6§lレアドロップ！ §r獲得: ${item.nameTag}`);
                }
            });
        }
    }
    if (player.hasTag("talent:exp_boost")) addXP(player, 50);
}

function handlePlayerDeath(player) {
    player.setDynamicProperty("deepcraft:combat_timer", 0);
    player.setDynamicProperty("deepcraft:hp", player.getDynamicProperty("deepcraft:max_hp"));

    const lostXP = player.getDynamicProperty("deepcraft:xp") || 0;
    player.setDynamicProperty("deepcraft:xp", 0);
    if (lostXP > 0) player.sendMessage(`§c死亡により ${lostXP} XPを失いました...`);

    const inventory = player.getComponent("inventory").container;
    const droppedItems = [];
    for (let i = 9; i < inventory.size; i++) { // ホットバー(0-8)を除く
        const item = inventory.getItem(i);
        if (item && Math.random() < CONFIG.DEATH_ITEM_DROP_RATE) {
            droppedItems.push(item.clone());
            inventory.setItem(i, undefined);
        }
    }

    if (droppedItems.length > 0) {
        const soul = player.dimension.spawnEntity("minecraft:chest_minecart", { x: player.location.x, y: player.location.y + 1.0, z: player.location.z });
        soul.nameTag = `§b${player.name}の魂`;
        soul.setDynamicProperty("deepcraft:owner_id", player.id);
        const soulContainer = soul.getComponent("inventory").container;
        droppedItems.forEach(item => soulContainer.addItem(item));
        player.sendMessage(`§b一部のアイテムを魂として座標 [${Math.floor(soul.location.x)}, ${Math.floor(soul.location.y)}, ${Math.floor(soul.location.z)}] に落としました。`);
    }
}

export function handlePlayerLeave(event) {
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