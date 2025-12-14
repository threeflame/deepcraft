// BP/scripts/player/skill_manager.js
import { system } from "@minecraft/server";
import { SKILL_POOL } from "../data/skills.js";

export function executeSkill(player, skillId) {
    const skill = SKILL_POOL[skillId];
    if (!skill) return;

    const cdTag = `cooldown:skill_${skillId}`;
    if (player.hasTag(cdTag)) {
        player.playSound("note.bass", { volume: 0.3 });
        player.sendMessage("§8» §cスキルはクールダウン中です！");
        return;
    }

    const manaCost = skill.manaCost || 0;
    let currentEther = player.getDynamicProperty("deepcraft:ether") || 0;

    if (currentEther < manaCost) {
        player.playSound("note.bass", { volume: 0.3 });
        player.sendMessage(`§8» §cエーテル不足！ (§b${Math.floor(currentEther)} §c/ §b${manaCost}§c)`);
        return;
    }

    const success = skill.onUse(player);
    if (success !== false) {
        if (manaCost > 0) {
            player.setDynamicProperty("deepcraft:ether", currentEther - manaCost);
        }
        player.addTag(cdTag);
        system.runTimeout(() => {
            if (player.isValid) {
                player.removeTag(cdTag);
                player.playSound("random.orb", { volume: 0.35 });
                player.sendMessage(`§aスキル準備完了: ${skill.name}`);
            }
        }, skill.cooldown * 20);
    }
}