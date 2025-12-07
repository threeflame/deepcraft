// BP/scripts/systems/status_manager.js
import { world, system, EntityDamageCause } from "@minecraft/server";

/**
 * 状態異常を付与する (強い方優先)
 * @param {Entity} entity 対象
 * @param {string} type 'burn', 'freeze', 'shock'
 * @param {number} duration 秒数
 * @param {number} strength 威力(レベル)
 */
export function applyStatus(entity, type, duration, strength) {
    if (!entity.isValid) return;

    // 現在の状態を取得
    const currentStrength = entity.getDynamicProperty(`deepcraft:val_${type}`) || 0;
    const currentTime = entity.getDynamicProperty(`deepcraft:status_${type}`) || 0;
    const currentTicks = currentTime * 20; // 秒 -> tick換算(概算)

    // 更新判定: 威力が高い、または威力が同じで時間が長いなら上書き
    if (strength > currentStrength || (strength === currentStrength && duration > currentTime)) {
        entity.setDynamicProperty(`deepcraft:status_${type}`, duration);
        entity.setDynamicProperty(`deepcraft:val_${type}`, strength);
        
        // 初回付与時のエフェクト
        if (currentTime <= 0) {
            if (type === "burn") entity.dimension.playSound("random.fizz", entity.location);
            if (type === "freeze") entity.dimension.playSound("random.glass", entity.location);
            if (type === "shock") entity.dimension.playSound("random.orb", entity.location);
        }
    }
}

/**
 * 状態異常の監視ループ (1秒/20tickごとに実行)
 */
export function runStatusLoop() {
    system.runInterval(() => {
        try {
            // プレイヤーと全Mobを対象にする
            // (負荷軽減のため、本来はアクティブなエンティティに絞るべきだが、今回は簡易実装)
            const targets = [
                ...world.getAllPlayers(),
                ...world.getDimension("overworld").getEntities({ tags: ["deepcraft:boss", "deepcraft:minion"] }) // ボスとミニオン
            ];

            for (const entity of targets) {
                if (!entity.isValid) continue;
                
                processBurn(entity);
                processFreeze(entity);
                processShock(entity);
                
                // アクションバー表示 (プレイヤーのみ)
                if (entity.typeId === "minecraft:player") {
                    updateStatusBar(entity);
                }
            }
        } catch (e) { }
    }, 20);
}

function processBurn(entity) {
    const time = entity.getDynamicProperty("deepcraft:status_burn") || 0;
    if (time > 0) {
        const strength = entity.getDynamicProperty("deepcraft:val_burn") || 1;
        
        // ダメージ適用
        // バニラダメージ(fireTick)は使わず、直接減らす
        if (entity.typeId === "minecraft:player") {
            // プレイヤーは仮想HPを減らす
            const cur = entity.getDynamicProperty("deepcraft:hp");
            if (cur) entity.setDynamicProperty("deepcraft:hp", cur - strength);
        } else {
            entity.applyDamage(strength, { cause: EntityDamageCause.fire });
        }

        // エフェクト
        try {
            entity.dimension.spawnParticle("minecraft:basic_flame_particle", entity.location);
        } catch(e){}

        entity.setDynamicProperty("deepcraft:status_burn", time - 1);
    }
}

function processFreeze(entity) {
    const time = entity.getDynamicProperty("deepcraft:status_freeze") || 0;
    if (time > 0) {
        // エフェクトのみ (速度低下は player_manager.js で処理)
        try {
            entity.dimension.spawnParticle("minecraft:snowflake_particle", {
                x: entity.location.x, y: entity.location.y + 1.5, z: entity.location.z
            });
        } catch(e){}

        entity.setDynamicProperty("deepcraft:status_freeze", time - 1);
    }
}

function processShock(entity) {
    const time = entity.getDynamicProperty("deepcraft:status_shock") || 0;
    if (time > 0) {
        const strength = entity.getDynamicProperty("deepcraft:val_shock") || 1;
        
        // ランダム麻痺 (20%の確率で硬直ダメージ)
        if (Math.random() < 0.2) {
            if (entity.typeId === "minecraft:player") {
                // プレイヤーへの麻痺: 視点揺れ + ダメージ
                const cur = entity.getDynamicProperty("deepcraft:hp");
                if (cur) entity.setDynamicProperty("deepcraft:hp", cur - 1);
                entity.playSound("random.fizz");
                // 一瞬の移動停止はSlownessで表現するか、ノックバックで止める
                entity.addEffect("slowness", 10, { amplifier: 4, showParticles: false });
            } else {
                entity.applyDamage(1, { cause: EntityDamageCause.lightning });
            }
            try {
                entity.dimension.spawnParticle("minecraft:electric_spark_particle", {
                    x: entity.location.x, y: entity.location.y + 1, z: entity.location.z
                });
            } catch(e){}
        }

        entity.setDynamicProperty("deepcraft:status_shock", time - 1);
    }
}

function updateStatusBar(player) {
    // ノックダウン中は表示しない
    if (player.hasTag("deepcraft:knocked")) return;

    const burn = player.getDynamicProperty("deepcraft:status_burn") || 0;
    const freeze = player.getDynamicProperty("deepcraft:status_freeze") || 0;
    const shock = player.getDynamicProperty("deepcraft:status_shock") || 0;
    const bleed = player.getDynamicProperty("deepcraft:status_bleed") || 0;

    let text = "";
    if (burn > 0) text += `§c🔥 ${burn}s  `;
    if (freeze > 0) text += `§b❄ ${freeze}s  `;
    if (shock > 0) text += `§e⚡ ${shock}s  `;
    if (bleed > 0) text += `§4🩸 ${bleed}s  `;

    // 既存のHPバーの上に表示したいが、Actionbarは1つしか出せないので
    // 優先度高で上書きするか、game_loopのHUD更新に統合する必要がある。
    // 今回は status_manager からは送らず、game_loop.js でまとめて表示するように修正する方針が良い。
    // とりあえずデータ更新だけ行い、表示は game_loop.js 側で拾う。
}