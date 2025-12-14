// BP/scripts/systems/custom_commands.js
import * as Minecraft from "@minecraft/server";
import { system } from "@minecraft/server";
import { openMenuHub, openQuestMenu } from "../ui/ui_manager.js";
import { processCommandSell } from "../data/market.js";
import { calculateEntityStats } from "../player/stat_calculator.js";
import { openDebugHub } from "./debug_menu.js";

system.beforeEvents.startup.subscribe(ev => {
    const registry = ev.customCommandRegistry;

    // 1. /deepcraft:menu
    registry.registerCommand({
        name: "deepcraft:menu",
        description: "DeepCraftメニューを開く",
        permissionLevel: Minecraft.CommandPermissionLevel.Any,
        mandatoryParameters: [],
        optionalParameters: []
    }, (origin, args) => {
        const player = origin.sourceEntity;
        if (player) system.run(() => openMenuHub(player));
    });

    // 2. /deepcraft:sell <price>
    registry.registerCommand({
        name: "deepcraft:sell",
        description: "手持ちのアイテムを出品する",
        permissionLevel: Minecraft.CommandPermissionLevel.Any,
        mandatoryParameters: [],
        optionalParameters: [
            {
                name: "price",
                type: Minecraft.CustomCommandParamType.Integer
            }
        ]
    }, (origin, args) => {
        const player = origin.sourceEntity;
        if (player) {
            const priceInput = args.price;
            system.run(() => {
                if (priceInput === undefined) {
                    player.sendMessage("§8» §c使用法: /deepcraft:sell <価格>");
                } else {
                    processCommandSell(player, priceInput);
                }
            });
        }
    });

    // 3. /deepcraft:stats
    registry.registerCommand({
        name: "deepcraft:stats",
        description: "現在のステータスを表示",
        permissionLevel: Minecraft.CommandPermissionLevel.Any,
        mandatoryParameters: [],
        optionalParameters: []
    }, (origin, args) => {
        const player = origin.sourceEntity;
        if (player) system.run(() => showPlayerStats(player));
    });

    // 4. /deepcraft:quest
    registry.registerCommand({
        name: "deepcraft:quest",
        description: "クエストログを開く",
        permissionLevel: Minecraft.CommandPermissionLevel.Any,
        mandatoryParameters: [],
        optionalParameters: []
    }, (origin, args) => {
        const player = origin.sourceEntity;
        if (player) system.run(() => openQuestMenu(player));
    });

    // 5. /deepcraft:debug (Admin Only)
    // ★変更: これ一つで全てのデバッグ機能にアクセスする
    registry.registerCommand({
        name: "deepcraft:debug",
        description: "開発者用メニューを開く (Admin限定)",
        permissionLevel: Minecraft.CommandPermissionLevel.Any,
        mandatoryParameters: [],
        optionalParameters: []
    }, (origin, args) => {
        const player = origin.sourceEntity;
        if (player) {
            if (!player.hasTag("admin")) {
                player.sendMessage("§8» §c権限がありません。");
                return;
            }
            system.run(() => openDebugMenu(player));
        }
    });

    // 6. /deepcraft:vanish (Admin Only)
    // これは便利なのでショートカットとして残す
    registry.registerCommand({
        name: "deepcraft:vanish",
        description: "運営用: 姿を隠す/現す (スペクテイター切替)",
        permissionLevel: Minecraft.CommandPermissionLevel.Any,
        mandatoryParameters: [],
        optionalParameters: []
    }, (origin, args) => {
        const player = origin.sourceEntity;
        if (player) {
            if (!player.hasTag("admin")) {
                player.sendMessage("§8» §c権限がありません。");
                return;
            }
            
            system.run(() => {
                if (player.hasTag("deepcraft:vanished")) {
                    player.runCommand("gamemode creative @s");
                    player.removeTag("deepcraft:vanished");
                    player.sendMessage("§8» §a姿を現しました。 (Visible)");
                    player.playSound("random.pop");
                } else {
                    player.runCommand("gamemode spectator @s");
                    player.addTag("deepcraft:vanished");
                    player.sendMessage("§8» §c姿を消しました。 (Vanish)");
                    player.playSound("random.fizz");
                }
            });
        }
    });
});

function showPlayerStats(player) {
    const stats = calculateEntityStats(player);
    const level = player.getDynamicProperty("deepcraft:level") || 1;
    const xp = player.getDynamicProperty("deepcraft:xp") || 0;
    const gold = player.getDynamicProperty("deepcraft:gold") || 0;
    const deaths = player.getDynamicProperty("deepcraft:overworld_deaths") || 0;

    let msg = `§l§a--- ${player.name}'s Stats ---§r\n`;
    msg += `§eLv.${level}  §fXP: ${xp}\n`;
    msg += `§6Gold: ${gold} G\n`;
    msg += `§cHP: ${stats.maxHP}  §3Ether: ${stats.maxEther}\n`;
    msg += `§4ATK: ${stats.atk}  §bDEF: ${stats.def}\n`;
    msg += `§fSpeed: ${(stats.speed * 100).toFixed(0)}%  §aCrit: ${(stats.critChance * 100).toFixed(1)}%`;
    
    player.sendMessage(msg);
}