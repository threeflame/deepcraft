// BP/scripts/combat/death_system.js
import { world, system, ItemStack, EquipmentSlot } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { QUEST_POOL } from "../data/quests.js";
import { MOB_POOL } from "../data/mobs.js";
import { EQUIPMENT_POOL } from "../data/equipment.js";
import { addXP, resetCurrentProfile } from "../player/player_manager.js";
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
                player.sendMessage(`§8» §aクエスト完了: ${def.name}`);
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
                    player.sendMessage(`§8» §6レアドロップ: ${itemName} x${dropCount}`);
                }
            });
        }
    }
    if (player.hasTag("talent:exp_boost")) addXP(player, 50);
}

/**
 * kill()直前に呼び出す関数 - プレイヤーが生きている状態で全処理を実行
 * @param {Player} player 
 */
export function preparePlayerDeath(player) {
    // ===== Void状態での死亡処理 =====
    if (player.hasTag("deepcraft:void")) {
        player.sendMessage("§8» §4Voidで消滅しました。プロファイルがリセットされます。");
        player.playSound("mob.wither.death");
        
        // Voidタグを解除
        player.removeTag("deepcraft:void");
        
        // プロファイルリセット (生きている状態で実行)
        resetCurrentProfile(player);
        
        // インベントリと装備をクリア
        const inventory = player.getComponent("inventory")?.container;
        if (inventory) {
            for (let i = 0; i < inventory.size; i++) {
                inventory.setItem(i, undefined);
            }
        }
        const equip = player.getComponent("equippable");
        if (equip) {
            [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Mainhand, EquipmentSlot.Offhand].forEach(slotId => {
                try {
                    const slot = equip.getEquipmentSlot(slotId);
                    if (slot) slot.setItem(undefined);
                } catch(e) {}
            });
        }
        
        // Overworldのスポーンポイントを設定 (死亡後にそこでリスポーン)
        try {
            player.runCommand("execute in overworld run spawnpoint @s -219 4 -452");
        } catch(e) {
            console.warn(`Overworld spawnpoint error: ${e}`);
        }
        player.sendMessage("§8» §a新たな冒険を始めましょう...");
        return;
    }

    // ===== 通常の死亡処理 =====
    let deathCount = player.getDynamicProperty("deepcraft:overworld_deaths") || 0;
    deathCount++;
    player.setDynamicProperty("deepcraft:overworld_deaths", deathCount);
    
    const remainingLives = CONFIG.VOID_MAX_DEATHS - deathCount;
    
    if (deathCount >= CONFIG.VOID_MAX_DEATHS) {
        // Voidタグを付与
        player.addTag("deepcraft:void");
        player.sendMessage("§8» §c死亡回数上限。Voidへ転送されます。次の死亡でリセット。");
        player.playSound("mob.enderdragon.growl");
        
        // 死亡カウントをリセット
        player.setDynamicProperty("deepcraft:overworld_deaths", 0);
        
        // Voidへのスポーンポイントを設定 (死亡後にそこでリスポーン)
        try {
            player.runCommand(`execute in the_end run spawnpoint @s ${CONFIG.VOID_SPAWN_X} ${CONFIG.VOID_SPAWN_Y} ${CONFIG.VOID_SPAWN_Z}`);
        } catch(e) {
            console.warn(`Void spawnpoint error: ${e}`);
        }
        return; // kill()は呼び出し元で実行される
    }
    
    player.sendMessage(`§8» §c死亡しました。§e残り ${remainingLives} 回でVoid転送。`);

    // 共通: XPロスト
    const currentXP = player.getDynamicProperty("deepcraft:xp") || 0;
    const level = player.getDynamicProperty("deepcraft:level") || 1;
    const lossRate = Math.min(level * 0.05, 1.0); 
    const remainingXP = Math.floor(currentXP * (1.0 - lossRate));
    player.setDynamicProperty("deepcraft:xp", remainingXP);
    
    if (currentXP > remainingXP) {
        player.sendMessage(`§8» §cXPロスト: -${currentXP - remainingXP} (${(lossRate * 100).toFixed(0)}%)`);
    }

    // 共通: アイテムロスト
    const inventory = player.getComponent("inventory")?.container;
    if (inventory) {
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
                soul.nameTag = `§b${player.name}のSoul`;
                soul.setDynamicProperty("deepcraft:owner_id", player.id);
                const soulContainer = soul.getComponent("inventory").container;
                droppedItems.forEach(item => soulContainer.addItem(item));
                player.sendMessage(`§8» §bアイテムの一部をSoulとしてその場に残しました。`);
            } catch (e) { console.warn(`Soul Spawn Error: ${e}`); }
        }
    }
}

function handlePlayerDeath(player) {
    // 死亡後の後処理のみ (ステータスリセット)
    player.removeTag("deepcraft:dead");
    player.setDynamicProperty("deepcraft:combat_timer", 0);
    player.setDynamicProperty("deepcraft:hp", player.getDynamicProperty("deepcraft:max_hp"));
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
        world.sendMessage(`§8» §c${backup.name} が戦闘から逃亡しました。`);
        COMBAT_LOG_CACHE.delete(event.playerId);
    }
}