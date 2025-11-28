// BP/scripts/systems/game_loop.js
import { world, system, EquipmentSlot } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { COMBAT_LOG_CACHE } from "../combat/death_system.js";
import { applyEquipmentPenalties, applyNumericalPassives, applyStatsToEntity, getXpCostForLevel } from "../player/player_manager.js";
import { MOB_POOL } from "../data/mobs.js";

export function initializeGameLoop() {
    system.runInterval(() => {
        try {
            // 1. Player Loop
            world.getAllPlayers().forEach(player => {
                try {
                    if (!player.isValid()) return;
                    playerLoop(player);
                } catch (e) { /* 個別プレイヤーのエラーは無視 */ }
            });

            // 2. Boss Loop
            try {
                world.getDimension("overworld").getEntities({ tags: ["deepcraft:boss"] }).forEach(boss => {
                    updateMobNameTag(boss);
                    processBossSkillAI(boss);
                });
            } catch (e) { /* ボスループのエラーは無視 */ }

        } catch (e) { console.warn("System Loop Error: " + e); }
    }, 10); // 0.5秒ごとに実行
}

function playerLoop(player) {
    // レベル、XP、Ether計算
    let level = player.getDynamicProperty("deepcraft:level");
    if (typeof level !== 'number' || level < 1) { level = 1; player.setDynamicProperty("deepcraft:level", 1); }
    let xp = player.getDynamicProperty("deepcraft:xp");
    if (typeof xp !== 'number' || xp < 0) { xp = 0; player.setDynamicProperty("deepcraft:xp", 0); }

    const reqXp = getXpCostForLevel(level);
    const intelligence = player.getDynamicProperty("deepcraft:intelligence") || 0;
    const willpower = player.getDynamicProperty("deepcraft:willpower") || 0;

    const maxEther = Math.floor(CONFIG.ETHER_BASE + (intelligence * CONFIG.ETHER_PER_INT));
    let currentEther = player.getDynamicProperty("deepcraft:ether") || 0;
    const regenRate = CONFIG.ETHER_REGEN_BASE + (willpower * CONFIG.ETHER_REGEN_PER_WILL);
    const tickRegen = regenRate / 10;
    if (currentEther < maxEther) {
        currentEther = Math.min(maxEther, currentEther + tickRegen);
        player.setDynamicProperty("deepcraft:ether", currentEther);
    }

    // コンバットタイマー & データバックアップ処理
    let combatTimer = player.getDynamicProperty("deepcraft:combat_timer") || 0;

    if (combatTimer > 0) {
        combatTimer = Math.max(0, combatTimer - 0.5);
        player.setDynamicProperty("deepcraft:combat_timer", combatTimer);

        const inventory = player.getComponent("inventory").container;
        const equip = player.getComponent("equippable");
        let items = [];
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (item) items.push(item.clone());
        }
        [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Mainhand, EquipmentSlot.Offhand].forEach(slot => {
            const item = equip.getEquipment(slot);
            if (item) items.push(item.clone());
        });

        COMBAT_LOG_CACHE.set(player.id, {
            name: player.name,
            location: { ...player.location },
            dimensionId: player.dimension.id,
            items: items,
            timestamp: Date.now()
        });
    } else {
        if (COMBAT_LOG_CACHE.has(player.id)) {
            COMBAT_LOG_CACHE.delete(player.id);
        }
    }

    // HUD表示
    const currentHP = Math.floor(player.getDynamicProperty("deepcraft:hp") || 100);
    const maxHP = Math.floor(player.getDynamicProperty("deepcraft:max_hp") || 100);
    const etherPercent = Math.max(0, Math.min(1, currentEther / maxEther));
    const etherBarLen = 10;
    const etherFill = Math.ceil(etherPercent * etherBarLen);
    const etherBarDisplay = "§b" + "■".repeat(etherFill) + "§8" + "■".repeat(etherBarLen - etherFill);
    const gold = player.getDynamicProperty("deepcraft:gold") || 0;

    let hudText = `§cHP: ${currentHP}/${maxHP}   ` +
                  `§3Ether: ${etherBarDisplay} ${Math.floor(currentEther)}/${maxEther}\n` +
                  `§eLv.${level}   §fXP:${xp}/${reqXp}   §6${gold} G`;

    if (combatTimer > 0) {
        hudText += `\n§c§l⚔ COMBAT: ${combatTimer.toFixed(1)}s ⚔`;
    }

    player.onScreenDisplay.setActionBar(hudText);

    // パッシブ効果の適用
    applyEquipmentPenalties(player);
    applyNumericalPassives(player);
    applyStatsToEntity(player);
}

export function updateMobNameTag(entity) {
    if (!entity.isValid()) return;
    const current = entity.getDynamicProperty("deepcraft:hp");
    const max = entity.getDynamicProperty("deepcraft:max_hp");
    if (current === undefined || max === undefined) return;
    const bossId = entity.getDynamicProperty("deepcraft:boss_id");
    let name = (bossId && MOB_POOL[bossId]) ? MOB_POOL[bossId].name : entity.typeId.replace("minecraft:", "").replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    const percent = Math.max(0, current / max);
    const barLen = 10;
    const fill = Math.ceil(percent * barLen);
    let color = percent < 0.2 ? "§c" : percent < 0.5 ? "§e" : "§a";
    const bar = color + "|".repeat(fill) + "§8" + "|".repeat(barLen - fill);
    entity.nameTag = `${name}\n${bar} §f${Math.ceil(current)}/${max}`;
}

function processBossSkillAI(boss) {
    if (!boss.isValid()) return;
    const bossId = boss.getDynamicProperty("deepcraft:boss_id");
    const bossDef = MOB_POOL[bossId];
    if (bossDef && bossDef.skills && boss.target) {
        bossDef.skills.forEach(skill => {
            if (Math.random() < skill.chance) {
                executeBossSkill(boss, skill);
            }
        });
    }
}

function executeBossSkill(boss, skill) {
    if (skill.msg) {
        boss.dimension.runCommand(`tellraw @a[r=30,x=${boss.location.x},y=${boss.location.y},z=${boss.location.z}] {"rawtext":[{"text":"§e[ボス] ${skill.msg}"}]}`);
    }
    skill.action(boss);
}