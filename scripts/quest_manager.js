// BP/scripts/player/quest_manager.js
import { ItemStack } from "@minecraft/server";
import { QUEST_POOL } from "../data/quests.js";
import { addXP } from "./player_manager.js";
import { openQuestMenu } from "../ui/ui_manager.js";

export function acceptQuest(player, questId) {
    const def = QUEST_POOL[questId];
    if (!def) { player.sendMessage(`§cクエストが見つかりません: ${questId}`); return; }
    const questData = JSON.parse(player.getDynamicProperty("deepcraft:quest_data") || "{}");
    if (questData[questId]) { player.sendMessage("§c既に受注済みか完了しています。"); return; }
    questData[questId] = { status: "active", progress: 0 };
    player.setDynamicProperty("deepcraft:quest_data", JSON.stringify(questData));
    player.sendMessage(`§aクエスト受注: ${def.name}`);
}

export function claimQuestReward(player, questId) {
    const def = QUEST_POOL[questId];
    const questData = JSON.parse(player.getDynamicProperty("deepcraft:quest_data") || "{}");
    if (!questData[questId] || questData[questId].status !== "completed") return;

    if (def.reward.xp) addXP(player, def.reward.xp);
    if (def.reward.item) {
        const item = new ItemStack(def.reward.item, def.reward.count || 1);
        player.getComponent("inventory").container.addItem(item);
    }
    questData[questId].status = "claimed";
    player.setDynamicProperty("deepcraft:quest_data", JSON.stringify(questData));
    player.playSound("random.levelup");
    player.sendMessage("§6報酬を受け取りました！");
    openQuestMenu(player);
}