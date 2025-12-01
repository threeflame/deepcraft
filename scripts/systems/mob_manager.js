// BP/scripts/systems/mob_manager.js
import { world, system } from "@minecraft/server";
import { MOB_POOL } from "../data/mobs.js";

export function updateMobNameTag(entity) {
    if (!entity.isValid) return;
    
    // ★修正: バニラHP(healthコンポーネント)ではなく、仮想HPプロパティを直接取得する
    const current = entity.getDynamicProperty("deepcraft:hp");
    const max = entity.getDynamicProperty("deepcraft:max_hp");
    
    // まだデータが初期化されていないMob（通常のゾンビなど）は無視する
    if (current === undefined || max === undefined) return;
    
    // 名前の決定ロジック
    let name = "";
    
    // 1. ボスの場合
    const bossId = entity.getDynamicProperty("deepcraft:boss_id");
    if (bossId && MOB_POOL[bossId]) {
        name = MOB_POOL[bossId].name;
    } 
    // 2. ミニオンの場合
    else if (entity.hasTag("deepcraft:minion")) {
        const ownerName = entity.getDynamicProperty("deepcraft:owner_name");
        if (ownerName) {
            name = `§7${ownerName}'s Minion`;
        } else {
            name = "§bMinion";
        }
    }
    // 3. その他のMob
    else {
        // IDをきれいな名前に変換 (minecraft:zombie -> Zombie)
        name = entity.typeId.replace("minecraft:", "").replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // HPバーの生成
    // 0割り防止
    const safeMax = max > 0 ? max : 1;
    const percent = Math.max(0, Math.min(current / safeMax, 1.0));
    
    const barLen = 10;
    const fill = Math.ceil(percent * barLen);
    
    // 色の変化 (緑 -> 黄 -> 赤)
    let color = "§a";
    if (percent < 0.5) color = "§e";
    if (percent < 0.2) color = "§c";
    
    const bar = color + "|".repeat(fill) + "§8" + "|".repeat(barLen - fill);
    
    // ネームタグの適用 (現在HP / 最大HP)
    entity.nameTag = `${name}\n${bar} §f${Math.ceil(current)}/${Math.ceil(max)}`;
}

export function processBossSkillAI(boss) {
    if (!boss.isValid) return;
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
        const players = boss.dimension.getPlayers({ location: boss.location, maxDistance: 30 });
        players.forEach(p => p.sendMessage(`§e[ボス] ${skill.msg}`));
    }
    skill.action(boss);
}