// BP/scripts/player/player_manager.js
import { world, system, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { calculateEntityStats } from "./stat_calculator.js";
import { EQUIPMENT_POOL } from "../data/equipment.js";
import { decodeLoreData, getItemId } from "../systems/lore_manager.js";

export function handlePlayerSpawn(event) {
    const player = event.player;

    // ★変更: Void/Wipe判定を削除し、シンプルにプロファイル確認のみ
    if (!player.getDynamicProperty("deepcraft:active_profile")) {
        initializePlayer(player);
    }
    
    // 状態リセット (必須)
    player.removeTag("deepcraft:knocked");
    player.removeTag("deepcraft:dead");
    player.setDynamicProperty("deepcraft:bleed_time", 0);
    player.setDynamicProperty("deepcraft:combat_timer", 0);
    
    player.removeEffect("slowness");
    player.removeEffect("blindness");
    player.removeEffect("weakness");
    player.removeEffect("jump_boost");
    player.removeEffect("resistance");
    player.onScreenDisplay.setActionBar(" ");
    
    // ネームタグを戻す
    player.nameTag = player.name;
    
    // ===== Void転送フラグがある場合 =====
    if (player.getDynamicProperty("deepcraft:pending_void_transfer")) {
        player.setDynamicProperty("deepcraft:pending_void_transfer", undefined);
        const theEnd = world.getDimension("minecraft:the_end");
        player.teleport(
            { x: CONFIG.VOID_SPAWN_X, y: CONFIG.VOID_SPAWN_Y, z: CONFIG.VOID_SPAWN_Z },
            { dimension: theEnd }
        );
        player.sendMessage("§8» §5ここから脱出せよ... 死ねば全てを失う。");
        return;
    }
    
    // ===== Voidリセットフラグがある場合 =====
    if (player.getDynamicProperty("deepcraft:pending_void_reset")) {
        player.setDynamicProperty("deepcraft:pending_void_reset", undefined);
        
        // プロファイルリセットを実行
        resetCurrentProfile(player);
        
        // Overworldへテレポート
        const overworld = world.getDimension("minecraft:overworld");
        player.teleport({ x: -219, y: 4, z: -452 }, { dimension: overworld });
        player.sendMessage("§8» §a新たな冒険を始めましょう...");
        return;
    }
    
    // Voidリセットフラグがある場合、インベントリをクリア
    if (player.getDynamicProperty("deepcraft:pending_wipe")) {
        player.setDynamicProperty("deepcraft:pending_wipe", undefined);
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
        player.sendMessage("§8» §cインベントリがクリアされました。");
    }

    // コンバットログチェック (変更なし)
    const logKey = `combat_log:${player.id}`;
    if (world.getDynamicProperty(logKey)) {
        world.setDynamicProperty(logKey, undefined);
        const inventory = player.getComponent("inventory").container;
        if (inventory) { for (let i = 0; i < inventory.size; i++) inventory.setItem(i, undefined); }
        const equip = player.getComponent("equippable");
        if (equip) {
            [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Mainhand, EquipmentSlot.Offhand].forEach(slotId => {
                const slot = equip.getEquipmentSlot(slotId);
                if (slot) slot.setItem(undefined);
            });
        }
        player.sendMessage("§8» §c戦闘中に切断したため、ペナルティとして死亡します...");
        system.runTimeout(() => {
            if (player.isValid) player.runCommand("kill @s");
        }, 60);
        return;
    }

    applyStatsToEntity(player);
    player.setDynamicProperty("deepcraft:hp", player.getDynamicProperty("deepcraft:max_hp"));
}

function initializePlayer(player) {
    player.setDynamicProperty("deepcraft:active_profile", 1);
    player.setDynamicProperty("deepcraft:ether", CONFIG.ETHER_BASE);
    player.setDynamicProperty("deepcraft:gold", 0);
    player.setDynamicProperty("deepcraft:hp", 100);
    player.setDynamicProperty("deepcraft:max_hp", 100);
    player.setDynamicProperty("deepcraft:invested_points", 0);
    player.setDynamicProperty("deepcraft:overworld_deaths", 0);
    loadProfile(player, 1);
    player.sendMessage("§8» §aDeepCraft System Initialized.");
}

// ... (以下の関数群は変更なし、そのまま維持)
export function getXpCostForLevel(level) {
    return CONFIG.XP_BASE_COST + (level * CONFIG.XP_LEVEL_MULTIPLIER);
}

export function addXP(player, amount) {
    let currentXP = player.getDynamicProperty("deepcraft:xp") || 0;
    player.setDynamicProperty("deepcraft:xp", currentXP + amount);
    player.sendMessage(`§8» §e+${amount} XP`);
}

export function applyStatsToEntity(player) {
    const stats = calculateEntityStats(player);
    player.setDynamicProperty("deepcraft:max_hp", stats.maxHP);

    const current = player.getDynamicProperty("deepcraft:hp");
    if (current === undefined || current > stats.maxHP) {
        player.setDynamicProperty("deepcraft:hp", stats.maxHP);
    }
    
    // HPイベント発火 (今回は無効化のまま)
    
    const movement = player.getComponent("minecraft:movement");
    if (movement) {
        let finalSpeed = 0.1 * stats.speed;
        if (player.hasTag("deepcraft:knocked")) {
            finalSpeed = 0.0;
        } else {
            const freezeLevel = player.getDynamicProperty("deepcraft:val_freeze") || 0;
            const freezeTime = player.getDynamicProperty("deepcraft:status_freeze") || 0;
            if (freezeTime > 0 && freezeLevel > 0) {
                const slowFactor = 1.0 - (freezeLevel * 0.15);
                finalSpeed *= Math.max(0, slowFactor);
            }
        }
        movement.setCurrentValue(Math.max(0.0, finalSpeed));
    }
    
    if (!player.hasTag("deepcraft:knocked") && player.nameTag.includes("気絶")) {
        player.nameTag = player.name;
    }
}

export function applyNumericalPassives(player) {
    let regenAmount = 0;
    const combatTimer = player.getDynamicProperty("deepcraft:combat_timer") || 0;
    const burnTime = player.getDynamicProperty("deepcraft:status_burn") || 0;
    
    if (combatTimer <= 0 && burnTime <= 0) {
        regenAmount += CONFIG.COMBAT.HP_REGEN_RATE;
    }
    if (player.hasTag("talent:immortal")) regenAmount += 1;
    
    if (regenAmount > 0) {
        const cur = player.getDynamicProperty("deepcraft:hp") || 0;
        const max = player.getDynamicProperty("deepcraft:max_hp") || 100;
        if (cur < max) {
            player.setDynamicProperty("deepcraft:hp", Math.min(cur + regenAmount, max));
        }
    }

    if (player.hasTag("talent:full_belly")) {
        player.runCommand("effect @s saturation 1 0 true"); 
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
    if (armorPenalty) player.addTag("debuff:heavy_armor");
    else player.removeTag("debuff:heavy_armor");
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
        invested_points: player.getDynamicProperty("deepcraft:invested_points") || 0,
        pending_card_draws: player.getDynamicProperty("deepcraft:pending_card_draws") || 0,
        stats: {},
        talents: player.getTags().filter(t => t.startsWith("talent:")),
        quests: JSON.parse(player.getDynamicProperty("deepcraft:quest_data") || "{}")
    };
    for (const key in CONFIG.STATS) data.stats[key] = player.getDynamicProperty(`deepcraft:${key}`) || 0;
    player.setDynamicProperty(`deepcraft:profile_${slot}`, JSON.stringify(data));
}

export function loadProfile(player, slot) {
    const json = player.getDynamicProperty(`deepcraft:profile_${slot}`);
    const data = json ? JSON.parse(json) : { level: 1, xp: 0, invested_points: 0, pending_card_draws: 0, stats: {}, talents: [], quests: {} };
    
    player.setDynamicProperty("deepcraft:level", data.level || 1);
    player.setDynamicProperty("deepcraft:xp", data.xp || 0);
    player.setDynamicProperty("deepcraft:invested_points", data.invested_points || 0);
    player.setDynamicProperty("deepcraft:pending_card_draws", data.pending_card_draws || 0);
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
    try {
        const currentSlot = player.getDynamicProperty("deepcraft:active_profile") || 1;
        
        // プロファイルデータを削除
        player.setDynamicProperty(`deepcraft:profile_${currentSlot}`, undefined);
        player.setDynamicProperty("deepcraft:quest_data", undefined);
        player.setDynamicProperty("deepcraft:overworld_deaths", 0);
        
        // レベル・XP・お金をリセット
        player.setDynamicProperty("deepcraft:level", 1);
        player.setDynamicProperty("deepcraft:xp", 0);
        player.setDynamicProperty("deepcraft:gold", 0);
        player.setDynamicProperty("deepcraft:invested_points", 0);
        player.setDynamicProperty("deepcraft:pending_card_draws", 0);
        
        // ステータスをリセット
        for (const key in CONFIG.STATS) {
            player.setDynamicProperty(`deepcraft:${key}`, 0);
        }
        
        // タレントタグを全て削除
        player.getTags().filter(t => t.startsWith("talent:")).forEach(t => player.removeTag(t));
        
        // Voidタグを確実に解除
        player.removeTag("deepcraft:void");
        
        // ステータスを再計算
        applyStatsToEntity(player);
        const stats = calculateEntityStats(player);
        player.setDynamicProperty("deepcraft:hp", stats.maxHP);
        player.setDynamicProperty("deepcraft:max_hp", stats.maxHP);
        player.setDynamicProperty("deepcraft:ether", CONFIG.ETHER_BASE);
        
        // リスポーン時にインベントリをクリアするフラグを設定
        player.setDynamicProperty("deepcraft:pending_wipe", true);
        
        player.playSound("random.break");
        player.sendMessage(`§8» §4プロファイルがリセットされました。`);
    } catch(e) {
        console.warn(`resetCurrentProfile Error: ${e}`);
    }
}