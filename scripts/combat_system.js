// BP/scripts/combat/combat_system.js
import { EquipmentSlot } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { calculateEntityStats } from "../player/stat_calculator.js";
import { checkReq } from "../player/player_manager.js";
import { updateMobNameTag } from "../systems/game_loop.js";

export function handleEntityHurt(event) {
    const { hurtEntity: victim, damageSource, damage } = event;
    const attacker = damageSource.damagingEntity;
    const cause = damageSource.cause;

    const ignoredCauses = ["none", "suicide", "override", "void", "magic", "wither", "freezing", "drowning", "lava", "fire", "fall", "starve"];
    if (ignoredCauses.includes(cause)) return;

    // コンバットモード開始
    if (victim.typeId === "minecraft:player") {
        victim.setDynamicProperty("deepcraft:combat_timer", CONFIG.COMBAT.COMBAT_MODE_DURATION);
    }
    if (attacker?.typeId === "minecraft:player") {
        attacker.setDynamicProperty("deepcraft:combat_timer", CONFIG.COMBAT.COMBAT_MODE_DURATION);
    }

    // 1. ステータス計算
    const victimStats = calculateEntityStats(victim);
    let finalDamage = 0;
    let isCritical = false;

    // A. 攻撃側
    if (attacker?.typeId === "minecraft:player") {
        const attackerStats = calculateEntityStats(attacker);
        const mainHand = attacker.getComponent("equippable").getEquipment(EquipmentSlot.Mainhand);

        if (!checkReq(attacker, mainHand).valid) {
            attacker.playSound("random.break");
            finalDamage = 1;
        } else {
            let attack = attackerStats.atk;
            if (Math.random() < attackerStats.critChance) {
                isCritical = true;
                attack *= attackerStats.critMult;
            }
            finalDamage = attack;
        }

        if (attacker.hasTag("talent:vampirism")) {
            const cur = attacker.getDynamicProperty("deepcraft:hp") || 100;
            const max = attacker.getDynamicProperty("deepcraft:max_hp") || 100;
            attacker.setDynamicProperty("deepcraft:hp", Math.min(cur + 2, max));
        }
    } else {
        finalDamage = damage; // Mobや環境からのダメージはバニラ値をベースにする
    }

    // B. 防御側
    if (victim.typeId === "minecraft:player" && Math.random() < victimStats.evasion) {
        victim.playSound("random.orb");
        victim.sendMessage("§a回避！");
        return;
    }

    finalDamage = Math.max(CONFIG.COMBAT.MIN_DAMAGE, finalDamage - victimStats.def);
    finalDamage = Math.floor(finalDamage);

    // 2. 仮想HPへの適用
    const currentHP = victim.getDynamicProperty("deepcraft:hp") ?? victimStats.maxHP;
    const newHP = currentHP - finalDamage;
    victim.setDynamicProperty("deepcraft:hp", newHP);

    if (victim.typeId !== "minecraft:player") {
        updateMobNameTag(victim);
    }

    // 3. 死亡判定
    if (newHP <= 0) {
        victim.runCommand("kill @s");
        return;
    }

    // 4. 反射ダメージ
    if (attacker && victim.hasTag("talent:thorns_master")) {
        const attCur = attacker.getDynamicProperty("deepcraft:hp") || 100;
        attacker.setDynamicProperty("deepcraft:hp", Math.max(0, attCur - Math.floor(finalDamage * 0.3)));
    }

    // 5. クリティカル演出
    if (isCritical && attacker?.typeId === "minecraft:player") {
        victim.dimension.playSound("random.anvil_land", victim.location, { pitch: 2.0 });
        victim.dimension.spawnParticle("minecraft:critical_hit_emitter", { x: victim.location.x, y: victim.location.y + 1, z: victim.location.z });
        attacker.sendMessage(`§c§lクリティカル！ §r§6${finalDamage} ダメージ`);
    }
}