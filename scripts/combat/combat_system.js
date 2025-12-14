// BP/scripts/combat/combat_system.js
import { EquipmentSlot, EntityDamageCause, system, Player, world } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { calculateEntityStats } from "../player/stat_calculator.js";
import { checkReq } from "../player/player_manager.js";
import { updateMobNameTag } from "../systems/mob_manager.js"; 
import { EQUIPMENT_STATS } from "../data/equipment.js";
import { getItemId } from "../systems/lore_manager.js"; 
import { applyStatus } from "../systems/status_manager.js";
import { preparePlayerDeath } from "./death_system.js";

// --- 共通関数 ---
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

export function isEnemy(actor, target) {
    if (!actor || !target || !target.isValid) return false;
    if (actor.id === target.id) return false; // 自分自身
    if (target.hasTag("deepcraft:safe")) return false; // セーフゾーン

    // パーティ判定
    const actorParty = getAffiliationId(actor);
    const targetParty = getAffiliationId(target);
    if (actorParty && targetParty && actorParty === targetParty) return false; // 味方

    return true;
}

export function findNearbyEnemies(player, radius, count = 1) {
    const dimension = player.dimension;
    const candidates = dimension.getEntities({
        location: player.location,
        maxDistance: radius,
        excludeFamilies: ["inanimate"],
        excludeTypes: ["minecraft:item", "minecraft:xp_orb", "minecraft:arrow"]
    });

    const enemies = candidates.filter(e => isEnemy(player, e));
    enemies.sort((a, b) => {
        const da = (a.location.x-player.location.x)**2 + (a.location.y-player.location.y)**2 + (a.location.z-player.location.z)**2;
        const db = (b.location.x-player.location.x)**2 + (b.location.y-player.location.y)**2 + (b.location.z-player.location.z)**2;
        return da - db;
    });

    return enemies.slice(0, count);
}

// --- メイン処理 ---
export function handleEntityHurt(event) {
    const { hurtEntity: victim, damageSource, damage } = event;
    const attacker = damageSource.damagingEntity;
    const cause = damageSource.cause;

    const ignoredCauses = [
        EntityDamageCause.void, EntityDamageCause.suicide, EntityDamageCause.starve, 
        EntityDamageCause.fire, EntityDamageCause.fireTick, EntityDamageCause.lava, 
        EntityDamageCause.drowning
    ];
    if (ignoredCauses.includes(cause)) return;

    // 基本チェック
    if (victim.typeId === "minecraft:player" && victim.hasTag("deepcraft:dead")) return;
    if (victim.typeId === "minecraft:player" && victim.hasTag("deepcraft:safe")) return;
    if (attacker?.typeId === "minecraft:player" && attacker.hasTag("deepcraft:safe")) {
        attacker.sendMessage("§8» §cセーフゾーンでは攻撃できません。");
        return;
    }
    if (cause === EntityDamageCause.fall && victim.hasTag("deepcraft:used_air_dash")) return;

    // Combat Timer
    if (victim.typeId === "minecraft:player") victim.setDynamicProperty("deepcraft:combat_timer", CONFIG.COMBAT.COMBAT_MODE_DURATION);
    if (attacker?.typeId === "minecraft:player") attacker.setDynamicProperty("deepcraft:combat_timer", CONFIG.COMBAT.COMBAT_MODE_DURATION);

    // 気絶・処刑判定
    if (victim.hasTag("deepcraft:knocked")) {
        if (attacker) processExecutionHit(attacker, victim);
        return; 
    }
    if (attacker?.hasTag("deepcraft:knocked")) return;

    // ▼▼▼ ステータス取得とダメージ計算 ▼▼▼
    const victimStats = calculateEntityStats(victim);
    const attackerStats = attacker ? calculateEntityStats(attacker) : { atk: damage, penetration: 0, critChance: 0, critMult: 1.5, magicPower: 1.0 };
    
    let isCritical = false;
    let rawDamage = 0;
    const isMagic = (cause === EntityDamageCause.magic || cause === EntityDamageCause.lightning);

    // 1. 基礎ダメージの決定
    if (cause === EntityDamageCause.projectile || isMagic) {
        // スキルや飛び道具のダメージ
        rawDamage = damage;
        
        // ★修正: 魔法攻撃ならタレント等の補正(Magic Power)のみを乗せる (INT影響なし)
        if (isMagic) {
            rawDamage *= (attackerStats.magicPower || 1.0);
        }
    } 
    else if (attacker?.typeId === "minecraft:player") {
        // プレイヤーの直接攻撃
        rawDamage = attackerStats.atk;
        
        // 攻撃速度チェック等
        const currentTick = system.currentTick;
        const lastAttackTick = attacker.getDynamicProperty("deepcraft:last_attack_tick") || 0;
        const equipComp = attacker.getComponent("equippable");
        const mainHandItem = equipComp ? equipComp.getEquipmentSlot(EquipmentSlot.Mainhand).getItem() : undefined;
        let weaponId = "minecraft:hand";
        if (mainHandItem) {
            const customId = getItemId(mainHandItem);
            weaponId = customId ? customId : mainHandItem.typeId;
        }
        const speed = EQUIPMENT_STATS[weaponId]?.speed ?? 12;
        
        if ((currentTick - lastAttackTick) < speed * 0.9) {
            attacker.playSound("game.player.attack.nodamage", { volume: 0.3, pitch: 1.5 });
            attacker.setDynamicProperty("deepcraft:last_attack_tick", currentTick);
            return; 
        }
        attacker.setDynamicProperty("deepcraft:last_attack_tick", currentTick);

        if (!checkReq(attacker, mainHandItem).valid) {
            attacker.playSound("random.break", { volume: 0.3 });
            rawDamage = 1;
        } else {
            if (Math.random() < attackerStats.critChance) {
                isCritical = true;
                rawDamage *= attackerStats.critMult;
            }
        }
        
        // ドレイン
        if (attacker.hasTag("talent:vampirism")) {
            const cur = attacker.getDynamicProperty("deepcraft:hp") || 100;
            const max = attacker.getDynamicProperty("deepcraft:max_hp") || 100;
            attacker.setDynamicProperty("deepcraft:hp", Math.min(cur + 15, max));
        }
    } 
    else {
        // Mob攻撃
        rawDamage = Math.max(damage, attackerStats.atk);
        if (attacker && attacker.hasTag("deepcraft:minion")) {
            const minionAtk = attacker.getDynamicProperty("deepcraft:atk");
            if (minionAtk) rawDamage = minionAtk;
        }
    }

    // 2. 防御計算 (統一)
    // 物理も魔法も同じ Defense で軽減する
    const effectiveDefScore = Math.max(0, victimStats.def * (1.0 - attackerStats.penetration));
    const reductionRate = effectiveDefScore / (effectiveDefScore + CONFIG.COMBAT.DEFENSE_CONSTANT);
    
    // ★修正: magicResist参照を削除し、純粋にDefense由来の軽減率のみを使用
    let finalDamage = rawDamage * (1.0 - reductionRate);
    finalDamage = Math.max(1, Math.floor(finalDamage));

    // DOT付与 (物理のみ)
    if (attacker?.typeId === "minecraft:player" && cause === EntityDamageCause.entityAttack) {
        if (attacker.hasTag("talent:kindle") && Math.random() < 0.2) {
            applyStatus(victim, "burn", 3, 1);
            attacker.sendMessage("§8» §c火傷付与！");
        }
        if (attacker.hasTag("talent:chilling_touch") && Math.random() < 0.2) {
            applyStatus(victim, "freeze", 3, 1);
            attacker.sendMessage("§8» §b凍結付与！");
        }
        if (attacker.hasTag("talent:static") && Math.random() < 0.2) {
            applyStatus(victim, "shock", 5, 1);
            attacker.sendMessage("§8» §e感電付与！");
        }
    }

    // 3. HP適用
    const currentHP = victim.getDynamicProperty("deepcraft:hp") ?? victimStats.maxHP;
    let newHP = currentHP - finalDamage;
    if (isNaN(newHP) || !isFinite(newHP)) newHP = 1;
    
    if (newHP <= 0) {
        if (victim.typeId === "minecraft:player") {
            applyKnockdown(victim); 
        } else {
            victim.setDynamicProperty("deepcraft:hp", 0);
            victim.addTag("deepcraft:dead"); 
            if (attacker) victim.setDynamicProperty("deepcraft:last_attacker_id", attacker.id);
        }
    } else {
        victim.setDynamicProperty("deepcraft:hp", newHP);
        if (victim.typeId !== "minecraft:player") updateMobNameTag(victim);
    }

    // フィードバック
    if (attacker?.typeId === "minecraft:player") {
        const color = isMagic ? "§b" : (isCritical ? "§c" : "§6");
        const suffix = isCritical ? " §lCRIT!" : "";
        attacker.sendMessage(`§8» ${color}${finalDamage}${suffix}`);
        
        if (isCritical) attacker.playSound("random.anvil_land", { volume: 0.4, pitch: 2.0 });
        else if (attackerStats.penetration > 0.2) attacker.playSound("item.trident.hit", { volume: 0.35 });
    }
}

// (以下省略: applyKnockdown, processExecutionHit, executeKnockedTarget, applySkillDamage は変更なし)

function applyKnockdown(player) {
    player.addTag("deepcraft:knocked");
    player.setDynamicProperty("deepcraft:bleed_time", 30); 
    player.setDynamicProperty("deepcraft:hp", 1); 
    player.playSound("random.hurt", { volume: 0.3 });
    player.sendMessage("§8» §c気絶しました！味方に助けを求めてください！");
    player.addEffect("slowness", 20000000, { amplifier: 10, showParticles: false });
    player.addEffect("blindness", 20000000, { amplifier: 0, showParticles: false }); 
    player.addEffect("weakness", 20000000, { amplifier: 255, showParticles: false });
    player.addEffect("resistance", 20000000, { amplifier: 255, showParticles: false });
    player.nameTag = `§c[気絶]\n§7${player.name}`;
}

function processExecutionHit(attacker, victim) {
    if (attacker.typeId === "minecraft:player") {
        const currentTick = system.currentTick;
        const lastAttackTick = attacker.getDynamicProperty("deepcraft:last_attack_tick") || 0;
        const equipComp = attacker.getComponent("equippable");
        const mainHandItem = equipComp ? equipComp.getEquipmentSlot(EquipmentSlot.Mainhand).getItem() : undefined;
        let weaponId = "minecraft:hand";
        if (mainHandItem) {
            const customId = getItemId(mainHandItem);
            weaponId = customId ? customId : mainHandItem.typeId;
        }
        const speed = EQUIPMENT_STATS[weaponId]?.speed ?? 12;
        if ((currentTick - lastAttackTick) < speed * 0.9) {
            attacker.playSound("game.player.attack.nodamage", { volume: 0.3, pitch: 1.5 });
            attacker.setDynamicProperty("deepcraft:last_attack_tick", currentTick);
            return;
        }
        attacker.setDynamicProperty("deepcraft:last_attack_tick", currentTick);
    }
    let bleedTime = victim.getDynamicProperty("deepcraft:bleed_time") || 0;
    bleedTime -= 1; 
    victim.setDynamicProperty("deepcraft:bleed_time", bleedTime);
    if (attacker?.typeId === "minecraft:player") {
        attacker.playSound("random.heavy_hit", { volume: 0.35, pitch: 1.2 });
    }
    victim.dimension.spawnParticle("minecraft:redstone_wire_dust_particle", victim.location);
    if (bleedTime <= 0) {
        executeKnockedTarget(attacker, victim);
    } else {
        if (attacker.typeId === "minecraft:player") {
            attacker.sendMessage(`§8» §c処刑中... (残${bleedTime}秒)`);
        }
    }
}

function executeKnockedTarget(attacker, victim) {
    if (attacker?.typeId === "minecraft:player") {
        attacker.playSound("random.heavy_hit", { volume: 0.35 });
    }
    victim.dimension.spawnParticle("minecraft:redstone_wire_dust_particle", victim.location);
    if (attacker && attacker.typeId === "minecraft:player") {
        attacker.sendMessage(`§8» §4${victim.name}を処刑した！`);
    }
    victim.sendMessage(`§8» §c処刑されました...`);
    victim.removeTag("deepcraft:knocked");
    victim.addTag("deepcraft:dead"); 
    if (attacker) victim.setDynamicProperty("deepcraft:last_attacker_id", attacker.id);
    victim.nameTag = victim.name;
    if (victim.typeId === "minecraft:player") {
        preparePlayerDeath(victim);
    }
    victim.kill();
}

export function applySkillDamage(attacker, target, amount) {
    if (!target.isValid) return;
    target.applyDamage(amount, { cause: EntityDamageCause.magic, damagingEntity: attacker });
}