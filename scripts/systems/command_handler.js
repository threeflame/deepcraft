// BP/scripts/systems/command_handler.js
import { system } from "@minecraft/server";
import { openMarketMenu, processCommandSell } from "../data/market.js";
import { openMenuHub } from "../ui/ui_manager.js";
import { addXP, resetCurrentProfile } from "../player/player_manager.js";
import { giveCustomItem, summonBoss } from "./item_handler.js";
import { acceptQuest } from "../player/quest_manager.js";

/**
 * scripteventから呼び出されるコマンド処理
 * @param {import("@minecraft/server").ScriptEventCommandMessageEvent} event
 */
export function handleScriptEventCommand(event) {
    const { sourceEntity: player, id, message } = event;
    const command = id.replace("deepcraft:", "");
    const args = message.split(" ");

    switch (command) {
        // --- 一般プレイヤー用 ---
        case "menu":
            openMenuHub(player);
            break;

        case "market":
            openMarketMenu(player);
            break;

        case "party":
            player.sendMessage("§7パーティ機能は準備中です。");
            break;

        // --- scriptevent経由のコマンド ---
        case "sell":
            processCommandSell(player, message);
            break;

        case "admin":
            if (!player.hasTag("admin")) {
                player.sendMessage("§c権限がありません。(adminタグが必要です)");
                return;
            }
            handleAdminCommand(player, args);
            break;

        default:
            // scripteventで不明なコマンドが来た場合は何もしない（チャット荒れ防止）
            break;
    }
}

function handleAdminCommand(player, args) {
    const sub = args[0];
    const val1 = args[1];
    const val2 = args[2];

    switch (sub) {
        case "xp":
            addXP(player, parseInt(val1) || 1000);
            break;
        case "give":
            if (val1) {
                const isSellable = (val2 === "sellable");
                giveCustomItem(player, val1, isSellable);
            }
            else player.sendMessage("§c使用法: /scriptevent deepcraft:admin give <itemId> [sellable]");
            break;
        case "summon":
            if (val1) summonBoss(player, val1);
            else player.sendMessage("§cBossIDを指定してください");
            break;
        case "quest":
            if (val1) acceptQuest(player, val1);
            else player.sendMessage("§cQuestIDを指定してください");
            break;
        case "reset":
            resetCurrentProfile(player);
            break;
        default:
            player.sendMessage("§cAdmin: /scriptevent deepcraft:admin <xp|give|summon|quest|reset> [value]");
            break;
    }
}