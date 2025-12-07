// BP/scripts/systems/game_loop.js
import { world, system, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { EQUIPMENT_STATS } from "../data/equipment.js"; 
import { updateMobNameTag, processBossSkillAI } from "./mob_manager.js";
import { getItemId } from "./lore_manager.js";
import { applyEquipmentPenalties, applyNumericalPassives, applyStatsToEntity, getXpCostForLevel } from "../player/player_manager.js";

const reviveProgress = new Map(); 

export function initializeGameLoop() {
    system.runInterval(() => {
        try {
            world.getAllPlayers().forEach(player => {
                // 奈落判定タグ検知
                if (player.hasTag("deepcraft:void_fall")) {
                    // ★修正: kill() メソッドを使用
                    player.kill(); 
                }

                playerLoop(player);
                if (player.hasTag("deepcraft:knocked")) {
                    processKnockedPlayer(player);
                }
            });

            const overworld = world.getDimension("overworld");
            try { 
                overworld.getEntities({ tags: ["deepcraft:boss"] }).forEach(boss => {
                    if (!boss.isValid) return;
                    updateMobNameTag(boss);
                    processBossSkillAI(boss);
                });
            } catch (e) { }
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

        // ★修正: kill() メソッドを使用
        entity.kill();
        
        entity.setDynamicProperty("deepcraft:last_attacker_id", undefined);
    }
}

function processKnockedPlayer(player) {
    let bleedTime = player.getDynamicProperty("deepcraft:bleed_time") || 0;

    // 1. 毎秒処理 (カウントダウン)
    if (system.currentTick % 20 === 0) {
        const newBleedTime = Math.max(0, bleedTime - 1);
        player.setDynamicProperty("deepcraft:bleed_time", newBleedTime);
        bleedTime = newBleedTime; // 表示用に更新

        // ★削除: アニメーション処理 (playanimation) を削除しました

        try {
            // パーティクルだけ残す
            const loc = player.location;
            player.dimension.spawnParticle("minecraft:basic_smoke_particle", { x: loc.x, y: loc.y + 0.5, z: loc.z });
            // player.nameTag = ... (変更なし)
        } catch(e){}
        
        // ★修正: 時間切れで即キル (killメソッド)
        if (newBleedTime <= 0) {
            player.removeTag("deepcraft:knocked");
            player.addTag("deepcraft:dead"); 
            player.sendMessage("§cYou bled out...");
            player.nameTag = player.name;
            player.kill();
            return; 
        }
    }

    // HUD更新 (毎ティック)
    player.onScreenDisplay.setActionBar(`§c§l[KNOCKED] BLEED OUT: ${bleedTime}s`);

    // 2. 蘇生判定 (Revive)
    const dimension = player.dimension;
    const rescuers = dimension.getPlayers({ 
        location: player.location, 
        maxDistance: 3,
        excludeTags: ["deepcraft:knocked", "deepcraft:dead"]
    });

    const rescuer = rescuers.find(p => p.isSneaking);

    if (rescuer) {
        let progress = reviveProgress.get(player.id) || 0;
        progress++;
        reviveProgress.set(player.id, progress);
        
        if (progress % 5 === 0) {
            try {
                dimension.spawnParticle("minecraft:villager_happy", player.location);
                player.playSound("random.orb", { volume: 0.5, pitch: 0.5 + (progress / 100) });
            } catch(e){}
        }
        
        if (progress >= 60) {
            player.removeTag("deepcraft:knocked");
            const maxHP = player.getDynamicProperty("deepcraft:max_hp");
            player.setDynamicProperty("deepcraft:hp", Math.floor(maxHP * 0.2)); 
            player.nameTag = player.name;

            player.removeEffect("slowness");
            player.removeEffect("blindness");
            player.removeEffect("weakness");
            player.removeEffect("jump_boost");
            
            player.playSound("random.levelup");
            player.sendMessage(`§aYou were revived by ${rescuer.name}!`);
            rescuer.sendMessage(`§aYou revived ${player.name}!`);
            
            reviveProgress.delete(player.id);
        } else {
            const percent = Math.floor((progress / 60) * 100);
            player.onScreenDisplay.setTitle(`§aReviving... ${percent}%`, { fadeInDuration:0, stayDuration:2, fadeOutDuration:0 });
        }
    } else {
        if (reviveProgress.has(player.id)) {
            reviveProgress.delete(player.id);
            player.onScreenDisplay.setTitle(" ", { fadeInDuration:0, stayDuration:0, fadeOutDuration:0 });
        }
    }
}

function playerLoop(player) {
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

    if (!player.hasTag("deepcraft:knocked")) {
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
    }

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

// --- HUD Helper ---
function drawBar(current, max, length, colorChar) {
    const safeMax = max > 0 ? max : 1;
    const percent = Math.max(0, Math.min(current / safeMax, 1.0));
    const fill = Math.ceil(percent * length);
    const empty = length - fill;
    return `§${colorChar}` + "■".repeat(fill) + "§8" + "□".repeat(empty) + "§r";
}

function updatePlayerHud(player) {
    if (player.hasTag("deepcraft:knocked")) return;

    const currentHP = Math.floor(player.getDynamicProperty("deepcraft:hp") || 100);
    const maxHP = Math.floor(player.getDynamicProperty("deepcraft:max_hp") || 100);
    const currentEther = Math.floor(player.getDynamicProperty("deepcraft:ether") || 0);
    const maxEther = Math.floor(CONFIG.ETHER_BASE + ((player.getDynamicProperty("deepcraft:intelligence") || 0) * CONFIG.ETHER_PER_INT));
    const combatTimer = player.getDynamicProperty("deepcraft:combat_timer") || 0;

    const healthComp = player.getComponent("minecraft:health");
    if (healthComp) {
        const ratio = Math.max(0, currentHP / maxHP);
        let vanillaVal = Math.ceil(ratio * healthComp.effectiveMax);
        
        if (vanillaVal < 1 && currentHP > 0 && !player.hasTag("deepcraft:dead")) {
            vanillaVal = 1;
        }
        if (healthComp.currentValue !== vanillaVal) {
            try { healthComp.setCurrentValue(vanillaVal); } catch(e){}
        }
    }

    const burn = player.getDynamicProperty("deepcraft:status_burn") || 0;
    const freeze = player.getDynamicProperty("deepcraft:status_freeze") || 0;
    const shock = player.getDynamicProperty("deepcraft:status_shock") || 0;
    
    let dotText = "";
    if (burn > 0) dotText += ` §c[B:${burn}]`;
    if (freeze > 0) dotText += ` §b[F:${freeze}]`;
    if (shock > 0) dotText += ` §e[S:${shock}]`;

    let hudText = "";

    if (combatTimer > 0) {
        const hpBar = drawBar(currentHP, maxHP, 10, "c");
        hudText = `§cHP: ${currentHP}/${maxHP}  ${hpBar}\n`;
        const mpBar = drawBar(currentEther, maxEther, 10, "b");
        hudText += `§bMP: ${currentEther}/${maxEther}  ${mpBar}\n`;
        hudText += `§c<!> COMBAT: ${combatTimer.toFixed(1)}s <!>${dotText}`;
    } else {
        const level = player.getDynamicProperty("deepcraft:level") || 1;
        const xp = player.getDynamicProperty("deepcraft:xp") || 0;
        const reqXp = getXpCostForLevel(level);
        const gold = player.getDynamicProperty("deepcraft:gold") || 0;

        hudText = `§cHP: ${currentHP}/${maxHP}   §bMP: ${currentEther}/${maxEther}\n`;
        hudText += `§eLv.${level}   §fXP:${xp}/${reqXp}   §6${gold} G`;
        
        if (dotText !== "") {
            hudText += `\n${dotText}`;
        }
    }
    
    if (player.hasTag("deepcraft:safe")) {
        hudText += `\n§a[Safe Zone]`;
    }

    player.onScreenDisplay.setActionBar(hudText);
}