// BP/scripts/combat/combat_system.js
import { EquipmentSlot, EntityDamageCause, system, Player, world } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { calculateEntityStats } from "../player/stat_calculator.js";
import { checkReq } from "../player/player_manager.js";
import { updateMobNameTag } from "../systems/mob_manager.js"; 
import { EQUIPMENT_STATS } from "../data/equipment.js";
import { getItemId } from "../systems/lore_manager.js"; 

export function getAffiliationId(entity) {
    if (!entity?.isValid) return null;
    if (entity.typeId === "minecraft:player") return entity.getDynamicProperty("deepcraft:party_id");
    if (entity.hasTag("deepcraft:minion")) {
        const ownerId = entity.getDynamicProperty("deepcraft:owner_id");
        if (ownerId) {
            const owner = world.getEntity(ownerId);
            if (owner && owner.typeId === "minecraft:player") return owner.getDynamicProperty("deepcraft:party_id");
        }
    }
    return null;
}

export function handleEntityHurt(event) {
    const { hurtEntity: victim, damageSource, damage } = event;
    const attacker = damageSource.damagingEntity;
    const cause = damageSource.cause;

    const ignoredCauses = [
        EntityDamageCause.void, EntityDamageCause.suicide, EntityDamageCause.starve, 
        EntityDamageCause.fire, EntityDamageCause.fireTick, EntityDamageCause.lava, 
        EntityDamageCause.drowning, EntityDamageCause.fall, EntityDamageCause.magic
    ];
    if (ignoredCauses.includes(cause)) return;

    // FF Check
    if (attacker && victim && attacker.id !== victim.id) {
        const attackerAffiliationId = getAffiliationId(attacker);
        const victimAffiliationId = getAffiliationId(victim);
        if (attackerAffiliationId && victimAffiliationId && attackerAffiliationId === victimAffiliationId) {
            const isAttackerPlayer = attacker.typeId === "minecraft:player";
            const isVictimPlayer = victim.typeId === "minecraft:player";
            if (isAttackerPlayer && isVictimPlayer) {
                // PvP FF allowed
            } else {
                // Cancel Minion/Party FF
                if (victim.isValid) {
                    const hpComp = victim.getComponent("minecraft:health");
                    if (hpComp && hpComp.currentValue > 0) {
                        try { hpComp.setCurrentValue(Math.min(hpComp.currentValue + damage, hpComp.effectiveMax)); } catch(e){}
                    }
                }
                if (attacker.hasTag("deepcraft:minion")) {
                    const targetComp = attacker.getComponent("minecraft:behavior.nearest_attackable_target");
                    if (targetComp) targetComp.target = undefined;
                }
                return; 
            }
        }
    }

    // Mob HP Refund
    const vHealth = victim.getComponent("minecraft:health");
    if (victim.typeId !== "minecraft:player" && vHealth && damage > 0) {
        try { vHealth.setCurrentValue(vHealth.effectiveMax); } catch (e) { }
    }

    // Combat Timer
    if (victim.typeId === "minecraft:player") victim.setDynamicProperty("deepcraft:combat_timer", CONFIG.COMBAT.COMBAT_MODE_DURATION);
    if (attacker?.typeId === "minecraft:player") attacker.setDynamicProperty("deepcraft:combat_timer", CONFIG.COMBAT.COMBAT_MODE_DURATION);

    // --- Damage Calculation ---
    const victimStats = calculateEntityStats(victim);
    const attackerStats = attacker ? calculateEntityStats(attacker) : { atk: damage, penetration: 0, critChance: 0, critMult: 1.5, magicPower: 1.0 };
    
    let finalDamage = 0;
    let isCritical = false;
    const isMagic = (cause === EntityDamageCause.magic || cause === EntityDamageCause.lightning);

    // 1. Base Damage
    let rawDamage = attackerStats.atk;
    let cooldownFactor = 1.0; 

    if (attacker?.typeId === "minecraft:player") {
        const equipComp = attacker.getComponent("equippable");
        const mainHandItem = equipComp ? equipComp.getEquipmentSlot(EquipmentSlot.Mainhand).getItem() : undefined;
        
        // --- Java式クールダウン計算 ---
        const currentTick = system.currentTick;
        const lastAttackTick = attacker.getDynamicProperty("deepcraft:last_attack_tick") || 0;
        
        let weaponId = "minecraft:hand";
        if (mainHandItem) {
            const customId = getItemId(mainHandItem);
            weaponId = customId ? customId : mainHandItem.typeId;
        }
        
        const speed = EQUIPMENT_STATS[weaponId]?.speed ?? 12;
        const elapsed = currentTick - lastAttackTick;
        let progress = Math.min(elapsed / speed, 1.0);
        
        attacker.setDynamicProperty("deepcraft:last_attack_tick", currentTick);

        cooldownFactor = 0.2 + (0.8 * progress);
        const canCrit = progress >= 0.9;

        if (!checkReq(attacker, mainHandItem).valid) {
            attacker.playSound("random.break");
            rawDamage = 1;
        } else {
            if (!isMagic && canCrit && Math.random() < attackerStats.critChance) {
                isCritical = true;
                rawDamage *= attackerStats.critMult;
            }
        }
        if (isMagic) rawDamage *= attackerStats.magicPower;

        rawDamage *= cooldownFactor;

        // ★削除: ここにあったアニメーション制御コードを削除しました

        if (attacker.hasTag("talent:vampirism")) {
            const cur = attacker.getDynamicProperty("deepcraft:hp") || 100;
            const max = attacker.getDynamicProperty("deepcraft:max_hp") || 100;
            attacker.setDynamicProperty("deepcraft:hp", Math.min(cur + 15, max));
        }
        
        if (cooldownFactor < 0.9) {
            attacker.playSound("game.player.attack.nodamage", { volume: 0.5, pitch: 1.5 });
        }
    } else {
        // Mob/Minion
        rawDamage = Math.max(damage, attackerStats.atk);
        if (attacker && attacker.hasTag("deepcraft:minion")) {
            const minionAtk = attacker.getDynamicProperty("deepcraft:atk");
            if (minionAtk) rawDamage = minionAtk;
        }
    }

    // 2. Defense
    if (isMagic) {
        finalDamage = rawDamage * (1.0 - victimStats.magicResist);
    } else {
        const effectiveDefScore = Math.max(0, victimStats.def * (1.0 - attackerStats.penetration));
        const reductionRate = effectiveDefScore / (effectiveDefScore + CONFIG.COMBAT.DEFENSE_CONSTANT);
        finalDamage = rawDamage * (1.0 - reductionRate);
    }

    finalDamage = Math.max(1, Math.floor(finalDamage));

    // 3. Apply to Virtual HP
    const currentHP = victim.getDynamicProperty("deepcraft:hp") ?? victimStats.maxHP;
    const newHP = currentHP - finalDamage;
    victim.setDynamicProperty("deepcraft:hp", newHP);
    
    // 4. Update NameTag Only
    if (victim.typeId !== "minecraft:player") {
        updateMobNameTag(victim);
    }

    // 5. Death
    if (newHP <= 0) {
        victim.addTag("deepcraft:dead"); 
        if (attacker) victim.setDynamicProperty("deepcraft:last_attacker_id", attacker.id);
        return; 
    }

    // 6. Feedback
    if (attacker?.typeId === "minecraft:player") {
        if (isCritical) {
            victim.dimension.playSound("random.anvil_land", victim.location, { pitch: 2.0 });
            attacker.sendMessage(`§cCritical! §l${finalDamage}`);
        } else if (cooldownFactor < 0.9) {
             attacker.sendMessage(`§8${finalDamage} (Weak)`);
        } else if (attackerStats.penetration > 0.2) {
             victim.dimension.playSound("item.trident.hit", victim.location);
             attacker.sendMessage(`§6${finalDamage}`);
        } else {
             attacker.sendMessage(`§7${finalDamage}`);
        }
    }
}