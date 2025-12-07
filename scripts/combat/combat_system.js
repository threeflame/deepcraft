// BP/scripts/combat/combat_system.js
import { EquipmentSlot, EntityDamageCause, system, Player, world } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { calculateEntityStats } from "../player/stat_calculator.js";
import { checkReq } from "../player/player_manager.js";
import { updateMobNameTag } from "../systems/mob_manager.js"; 
import { EQUIPMENT_STATS } from "../data/equipment.js";
import { getItemId } from "../systems/lore_manager.js"; 
import { applyStatus } from "../systems/status_manager.js";

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
        EntityDamageCause.drowning,  EntityDamageCause.magic
    ];
    if (ignoredCauses.includes(cause)) return;

    // セーフゾーン
    if (victim.typeId === "minecraft:player" && victim.hasTag("deepcraft:safe")) {
        healVanilla(victim, damage);
        return;
    }
    if (attacker?.typeId === "minecraft:player" && attacker.hasTag("deepcraft:safe")) {
        attacker.sendMessage("§c[Safe Zone] 攻撃できません。");
        healVanilla(victim, damage);
        return;
    }
    
    // 落下ダメージ (AirDash中無効)
    if (cause === EntityDamageCause.fall && victim.hasTag("deepcraft:used_air_dash")) {
        healVanilla(victim, damage);
        return;
    }

    // FF Check
    if (attacker && victim && attacker.id !== victim.id) {
        const attackerAff = getAffiliationId(attacker);
        const victimAff = getAffiliationId(victim);
        if (attackerAff && victimAff && attackerAff === victimAff) {
            healVanilla(victim, damage);
            return; 
        }
    }

    // Combat Timer
    if (victim.typeId === "minecraft:player") victim.setDynamicProperty("deepcraft:combat_timer", CONFIG.COMBAT.COMBAT_MODE_DURATION);
    if (attacker?.typeId === "minecraft:player") attacker.setDynamicProperty("deepcraft:combat_timer", CONFIG.COMBAT.COMBAT_MODE_DURATION);

    // ▼▼▼ 1. 既に気絶している場合 (処刑判定 v2) ▼▼▼
    if (victim.hasTag("deepcraft:knocked")) {
        if (attacker) {
            processExecutionHit(attacker, victim);
        }
        healVanilla(victim, damage); // バニラダメージは消す
        return; 
    }
    
    // 気絶者は攻撃不可
    if (attacker?.hasTag("deepcraft:knocked")) return;

    // ▼▼▼ 2. 通常ダメージ計算 ▼▼▼
    const victimStats = calculateEntityStats(victim);
    const attackerStats = attacker ? calculateEntityStats(attacker) : { atk: damage, penetration: 0, critChance: 0, critMult: 1.5, magicPower: 1.0 };
    
    let finalDamage = 0;
    let isCritical = false;
    const isMagic = (cause === EntityDamageCause.magic || cause === EntityDamageCause.lightning);

    let rawDamage = attackerStats.atk;
    
    if (attacker?.typeId === "minecraft:player") {
        const equipComp = attacker.getComponent("equippable");
        const mainHandItem = equipComp ? equipComp.getEquipmentSlot(EquipmentSlot.Mainhand).getItem() : undefined;
        
        const currentTick = system.currentTick;
        const lastAttackTick = attacker.getDynamicProperty("deepcraft:last_attack_tick") || 0;
        
        let weaponId = "minecraft:hand";
        if (mainHandItem) {
            const customId = getItemId(mainHandItem);
            weaponId = customId ? customId : mainHandItem.typeId;
        }
        
        const speed = EQUIPMENT_STATS[weaponId]?.speed ?? 12;
        const elapsed = currentTick - lastAttackTick;
        
        // クールダウン判定
        if (elapsed < speed * 0.9) {
            attacker.playSound("game.player.attack.nodamage", { volume: 0.5, pitch: 1.5 });
            attacker.setDynamicProperty("deepcraft:last_attack_tick", currentTick);
            healVanilla(victim, damage);
            return; 
        }
        
        attacker.setDynamicProperty("deepcraft:last_attack_tick", currentTick);

        if (!checkReq(attacker, mainHandItem).valid) {
            attacker.playSound("random.break");
            rawDamage = 1;
        } else {
            if (!isMagic && Math.random() < attackerStats.critChance) {
                isCritical = true;
                rawDamage *= attackerStats.critMult;
            }
        }
        if (isMagic) rawDamage *= attackerStats.magicPower;

        if (attacker.hasTag("talent:vampirism")) {
            const cur = attacker.getDynamicProperty("deepcraft:hp") || 100;
            const max = attacker.getDynamicProperty("deepcraft:max_hp") || 100;
            attacker.setDynamicProperty("deepcraft:hp", Math.min(cur + 15, max));
        }
    } else {
        rawDamage = Math.max(damage, attackerStats.atk);
        if (attacker && attacker.hasTag("deepcraft:minion")) {
            const minionAtk = attacker.getDynamicProperty("deepcraft:atk");
            if (minionAtk) rawDamage = minionAtk;
        }
    }

    if (isMagic) {
        finalDamage = rawDamage * (1.0 - victimStats.magicResist);
    } else {
        const effectiveDefScore = Math.max(0, victimStats.def * (1.0 - attackerStats.penetration));
        const reductionRate = effectiveDefScore / (effectiveDefScore + CONFIG.COMBAT.DEFENSE_CONSTANT);
        finalDamage = rawDamage * (1.0 - reductionRate);
    }

    finalDamage = Math.max(1, Math.floor(finalDamage));

    // DOT付与
    if (attacker?.typeId === "minecraft:player") {
        if (attacker.hasTag("talent:kindle") && Math.random() < 0.2) {
            applyStatus(victim, "burn", 3, 1);
            attacker.sendMessage("§cBurn applied!");
        }
        if (attacker.hasTag("talent:chilling_touch") && Math.random() < 0.2) {
            applyStatus(victim, "freeze", 3, 1);
            attacker.sendMessage("§bFreeze applied!");
        }
        if (attacker.hasTag("talent:static") && Math.random() < 0.2) {
            applyStatus(victim, "shock", 5, 1);
            attacker.sendMessage("§eShock applied!");
        }
    }

    // ▼▼▼ 3. HP適用とノックダウン判定 ▼▼▼
    const currentHP = victim.getDynamicProperty("deepcraft:hp") ?? victimStats.maxHP;
    const newHP = currentHP - finalDamage;
    
    if (newHP <= 0) {
        if (victim.typeId === "minecraft:player") {
            // プレイヤーなら気絶
            applyKnockdown(victim); 
        } else {
            // Mobなら即死
            victim.setDynamicProperty("deepcraft:hp", 0);
            victim.addTag("deepcraft:dead"); 
            if (attacker) victim.setDynamicProperty("deepcraft:last_attacker_id", attacker.id);
        }
    } else {
        // 生存
        victim.setDynamicProperty("deepcraft:hp", newHP);
        if (victim.typeId !== "minecraft:player") updateMobNameTag(victim);
    }

    // フィードバック
    if (attacker?.typeId === "minecraft:player") {
        if (isCritical) {
            victim.dimension.playSound("random.anvil_land", victim.location, { pitch: 2.0 });
            attacker.sendMessage(`§cCritical! §l${finalDamage}`);
        } else if (attackerStats.penetration > 0.2) {
             victim.dimension.playSound("item.trident.hit", victim.location);
             attacker.sendMessage(`§6${finalDamage}`);
        } else {
             attacker.sendMessage(`§7${finalDamage}`);
        }
    }
}

// バニラHPを回復するヘルパー
function healVanilla(entity, amount) {
    const hpComp = entity.getComponent("minecraft:health");
    if (hpComp && hpComp.currentValue > 0) {
        try { hpComp.setCurrentValue(Math.min(hpComp.currentValue + amount, hpComp.effectiveMax)); } catch(e){}
    }
}

function applyKnockdown(player) {
    player.addTag("deepcraft:knocked");
    player.setDynamicProperty("deepcraft:bleed_time", 30); 
    player.setDynamicProperty("deepcraft:hp", 1); 

    player.playSound("random.hurt");
    player.sendMessage("§c§l[DANGER] You are knocked down! Seek help!");

    player.addEffect("slowness", 20000000, { amplifier: 10, showParticles: false });
    player.addEffect("blindness", 20000000, { amplifier: 0, showParticles: false }); 
    player.addEffect("weakness", 20000000, { amplifier: 255, showParticles: false });
    
    // ネームタグ変更
    player.nameTag = `§c[KNOCKED]\n§7${player.name}`;
}

// ★修正: 処刑処理 (時間減少)
function processExecutionHit(attacker, victim) {
    // プレイヤーの場合はクールダウンチェック
    if (attacker.typeId === "minecraft:player") {
        const currentTick = system.currentTick;
        const lastAttackTick = attacker.getDynamicProperty("deepcraft:last_attack_tick") || 0;
        
        // 武器速度取得
        const equipComp = attacker.getComponent("equippable");
        const mainHandItem = equipComp ? equipComp.getEquipmentSlot(EquipmentSlot.Mainhand).getItem() : undefined;
        let weaponId = "minecraft:hand";
        if (mainHandItem) {
            const customId = getItemId(mainHandItem);
            weaponId = customId ? customId : mainHandItem.typeId;
        }
        const speed = EQUIPMENT_STATS[weaponId]?.speed ?? 12;

        // クールダウン未完了なら弾く
        if ((currentTick - lastAttackTick) < speed * 0.9) {
            attacker.playSound("game.player.attack.nodamage", { volume: 0.5, pitch: 1.5 });
            attacker.setDynamicProperty("deepcraft:last_attack_tick", currentTick);
            return;
        }
        // 成功: リセット
        attacker.setDynamicProperty("deepcraft:last_attack_tick", currentTick);
    }

    // ★共通: 時間を1秒減らす
    let bleedTime = victim.getDynamicProperty("deepcraft:bleed_time") || 0;
    bleedTime -= 1; // 1秒減少
    victim.setDynamicProperty("deepcraft:bleed_time", bleedTime);

    // 演出
    victim.dimension.playSound("random.heavy_hit", victim.location, { volume: 0.5, pitch: 1.2 });
    victim.dimension.spawnParticle("minecraft:redstone_wire_dust_particle", victim.location);

    // ★死亡判定
    if (bleedTime <= 0) {
        executeKnockedTarget(attacker, victim);
    } else {
        if (attacker.typeId === "minecraft:player") {
            attacker.sendMessage(`§cExecuting... (${bleedTime}s left)`);
        }
    }
}

function executeKnockedTarget(attacker, victim) {
    victim.dimension.playSound("random.heavy_hit", victim.location);
    victim.dimension.spawnParticle("minecraft:redstone_wire_dust_particle", victim.location);
    
    if (attacker && attacker.typeId === "minecraft:player") {
        attacker.sendMessage(`§4§lEXECUTED ${victim.name}!`);
    }
    victim.sendMessage(`§c§lYou were executed!`);
    
    victim.removeTag("deepcraft:knocked");
    victim.addTag("deepcraft:dead"); 
    
    if (attacker) victim.setDynamicProperty("deepcraft:last_attacker_id", attacker.id);
    
    victim.nameTag = victim.name;
    
    // ★修正: kill() メソッドを使用
    victim.kill();
}

system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id === "deepcraft:swing") {
        const player = ev.sourceEntity;
        if (!player || player.typeId !== "minecraft:player") return;

        const combatTimer = player.getDynamicProperty("deepcraft:combat_timer") || 0;
        if (combatTimer > 0 && !player.hasTag("deepcraft:knocked")) {
            player.setDynamicProperty("deepcraft:last_attack_tick", system.currentTick);
        }
    }
});