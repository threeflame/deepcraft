// BP/scripts/systems/game_loop.js
import { world, system, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { EQUIPMENT_STATS } from "../data/equipment.js"; 
import { COMBAT_LOG_CACHE } from "../combat/death_system.js";
import { applyEquipmentPenalties, applyNumericalPassives, applyStatsToEntity, getXpCostForLevel } from "../player/player_manager.js";
import { updateMobNameTag, processBossSkillAI } from "./mob_manager.js";
import { getItemId } from "./lore_manager.js";

export function initializeGameLoop() {
    system.runInterval(() => {
        try {
            // 1. Player Loop
            world.getAllPlayers().forEach(player => {
                playerLoop(player);
            });

            const overworld = world.getDimension("overworld");

            // 2. Boss Loop (AI & NameTag)
            try { 
                overworld.getEntities({ tags: ["deepcraft:boss"] }).forEach(boss => {
                    if (!boss.isValid) return;
                    updateMobNameTag(boss);
                    processBossSkillAI(boss);
                });
            } catch (e) { }

            // 3. Minion Loop (NameTag Update) ★追加
            try {
                overworld.getEntities({ tags: ["deepcraft:minion"] }).forEach(minion => {
                    if (!minion.isValid) return;
                    updateMobNameTag(minion);
                });
            } catch (e) { }

        } catch (e) { console.warn("System Loop Error: " + e); }
    }, 1); 
}

export function initializeDeathCheckLoop() {
    system.runInterval(() => {
        try {
            const deadEntities = world.getDimension("overworld").getEntities({ tags: ["deepcraft:dead"] });
            for (const entity of deadEntities) {
                processDeath(entity);
            }
        } catch (e) { console.warn("DeathCheckLoop Error: " + e); }
    }, 1); 
}

export function initializeHudLoop() {
    system.runInterval(() => {
        try {
            for (const player of world.getAllPlayers()) {
                updatePlayerHud(player);
            }
        } catch (e) { console.warn("HudLoop Error: " + e); }
    }, 5); 
}

function processDeath(entity) {
    if (entity.hasTag("deepcraft:dead")) {
        entity.removeTag("deepcraft:dead"); 

        const attackerId = entity.getDynamicProperty("deepcraft:last_attacker_id");
        let attacker = undefined;
        if (attackerId) {
            attacker = world.getEntity(attackerId);
        }

        const damageOptions = {
            cause: EntityDamageCause.entityAttack
        };
        if (attacker && attacker.isValid) {
            damageOptions.damagingEntity = attacker;
        } else {
            damageOptions.cause = EntityDamageCause.void;
        }

        try {
            entity.applyDamage(99999, damageOptions);
        } catch (e) {
            entity.dimension.runCommandAsync(`kill @e[type=${entity.typeId},r=1,c=1]`);
        }
        entity.setDynamicProperty("deepcraft:last_attacker_id", undefined);
    }
}

function playerLoop(player) {
    // --- クールダウン UI制御 ---
    const currentTick = system.currentTick;
    const lastAttackTick = player.getDynamicProperty("deepcraft:last_attack_tick") || 0;
    
    const equip = player.getComponent("equippable");
    const item = equip ? equip.getEquipmentSlot(EquipmentSlot.Mainhand).getItem() : undefined;
    
    let weaponId = "minecraft:hand";
    if (item) {
        const customId = getItemId(item);
        weaponId = customId ? customId : item.typeId;
    }
    
    const speed = EQUIPMENT_STATS[weaponId]?.speed ?? 12;
    const elapsed = currentTick - lastAttackTick;
    
    let signal = " "; 

    if (elapsed < speed) {
        const percent = elapsed / speed;
        const frame = Math.floor(percent * 80); 
        const frameStr = frame.toString().padStart(2, '0');
        signal = `!jc.${frameStr}`;
    } else {
        const headLoc = player.getHeadLocation();
        const viewDir = player.getViewDirection();
        const target = player.dimension.getEntitiesFromRay(headLoc, viewDir, { maxDistance: 4, excludeFamilies: ["inanimate"] });
        
        if (target.length > 0 && target[0].entity.id !== player.id) {
            signal = "!jc.81"; 
        }
    }

    player.onScreenDisplay.setTitle(signal, {
        fadeInDuration: 0,
        stayDuration: 2,
        fadeOutDuration: 0,
        subtitle: " " 
    });

    // --- Ether Regen ---
    const intelligence = player.getDynamicProperty("deepcraft:intelligence") || 0;
    const willpower = player.getDynamicProperty("deepcraft:willpower") || 0;

    const maxEther = Math.floor(CONFIG.ETHER_BASE + (intelligence * CONFIG.ETHER_PER_INT));
    let currentEther = player.getDynamicProperty("deepcraft:ether") || 0;
    const regenRate = CONFIG.ETHER_REGEN_BASE + (willpower * CONFIG.ETHER_REGEN_PER_WILL);
    const tickRegen = regenRate / 20; 
    
    if (currentEther < maxEther) {
        currentEther = Math.min(maxEther, currentEther + tickRegen);
        player.setDynamicProperty("deepcraft:ether", currentEther);
    }

    // --- Combat Timer ---
    let combatTimer = player.getDynamicProperty("deepcraft:combat_timer") || 0;
    if (combatTimer > 0) {
        combatTimer = Math.max(0, combatTimer - 0.05); 
        player.setDynamicProperty("deepcraft:combat_timer", combatTimer);
    }
    
    if (currentTick % 10 === 0) {
        applyEquipmentPenalties(player);
        applyNumericalPassives(player);
        applyStatsToEntity(player);
    }
}

function updatePlayerHud(player) {
    const level = player.getDynamicProperty("deepcraft:level") || 1;
    const xp = player.getDynamicProperty("deepcraft:xp") || 0;
    const reqXp = getXpCostForLevel(level);
    const currentHP = Math.floor(player.getDynamicProperty("deepcraft:hp") || 100);
    const maxHP = Math.floor(player.getDynamicProperty("deepcraft:max_hp") || 100);
    const currentEther = player.getDynamicProperty("deepcraft:ether") || 0;
    const maxEther = Math.floor(CONFIG.ETHER_BASE + ((player.getDynamicProperty("deepcraft:intelligence") || 0) * CONFIG.ETHER_PER_INT));
    const gold = player.getDynamicProperty("deepcraft:gold") || 0;
    const combatTimer = player.getDynamicProperty("deepcraft:combat_timer") || 0;

    let hudText = `§cHP: ${currentHP}/${maxHP}   ` +
                  `§3Ether: ${Math.floor(currentEther)}/${maxEther}\n` +
                  `§eLv.${level}   §fXP:${xp}/${reqXp}   §6${gold} G`;

    if (combatTimer > 0) {
        hudText += `\n§c§l⚔ COMBAT: ${combatTimer.toFixed(1)}s ⚔`;
    }

    player.onScreenDisplay.setActionBar(hudText);
}