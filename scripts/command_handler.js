// BP/scripts/systems/command_handler.js
import { openMarketMenu, processCommandSell } from "../data/market.js";
import { openMenuHub } from "../ui/ui_manager.js";
import { addXP, resetCurrentProfile } from "../player/player_manager.js";
import { giveCustomItem, summonBoss } from "./item_handler.js";
import { acceptQuest } from "../player/quest_manager.js";
import { CONFIG } from "../config.js";

export function handleChatCommand(player, message) {
    const args = message.substring(1).split(" ");
    const command = args[0].toLowerCase();

    switch (command) {
        // --- 一般プレイヤー用 ---
        case "menu":
            openMenuHub(player);
            break;

        case "market":
            openMarketMenu(player);
            break;

        case "sell":
            if (!args[1]) {
                player.sendMessage("§c使用法: !sell <価格>");
                return;
            }
            processCommandSell(player, args[1]);
            break;

        case "party":
            player.sendMessage("§7パーティ機能は準備中です。");
            break;

        case "help":
            player.sendMessage("§e--- DeepCraft Commands ---");
            player.sendMessage("§f!menu  : メニューを開く");
            player.sendMessage("§f!market: マーケットを開く");
            player.sendMessage("§f!sell <価格>: 手持ちアイテムを出品");
            player.sendMessage("§f!help  : コマンド一覧");
            if (player.hasTag("admin")) {
                player.sendMessage("§c!admin : 管理者メニュー (xp, give, summon, max, reset, quest)");
            }
            break;

        // --- 管理者用 (adminタグ必須) ---
        case "admin":
            if (!player.hasTag("admin")) {
                player.sendMessage("§c権限がありません。(adminタグが必要です)");
                return;
            }
            handleAdminCommand(player, args);
            break;

        default:
            player.sendMessage(`§c不明なコマンドです: ${command}`);
            break;
    }
}

function handleAdminCommand(player, args) {
    const sub = args[1];
    const val = args[2];

    switch (sub) {
        case "xp":
            addXP(player, parseInt(val) || 1000);
            break;
        case "give":
            if (val) giveCustomItem(player, val);
            else player.sendMessage("§cIDを指定してください");
            break;
        case "summon":
            if (val) summonBoss(player, val);
            else player.sendMessage("§cBossIDを指定してください");
            break;
        case "quest":
            if (val) acceptQuest(player, val);
            else player.sendMessage("§cQuestIDを指定してください");
            break;
        case "reset":
            resetCurrentProfile(player);
            break;
        default:
            player.sendMessage("§c使用法: !admin <xp/give/summon/quest/reset> [値]");
            break;
    }
}