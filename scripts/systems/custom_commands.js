// BP/scripts/systems/custom_commands.js
import * as Minecraft from "@minecraft/server";
import { system } from "@minecraft/server";
import { openMenuHub, openQuestMenu } from "../ui/ui_manager.js";
import { processCommandSell } from "../data/market.js";
import { calculateEntityStats } from "../player/stat_calculator.js";


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
            system.run(() => {
                if (args.price === undefined) {
                    player.sendMessage("§c使用法: /deepcraft:sell <価格>");
                } else {
                    processCommandSell(player, args.price);
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

    // 5. /deepcraft:csummon <name> (Admin Only)
    registry.registerCommand({
        name: "deepcraft:csummon",
        description: "カスタムMobを召喚する (Admin限定)",
        permissionLevel: Minecraft.CommandPermissionLevel.Any,
        mandatoryParameters: [
            {
                name: "name", // ★変更: id -> name
                type: Minecraft.CustomCommandParamType.String
            }
        ],
        optionalParameters: []
    }, (origin, args) => {
        const player = origin.sourceEntity;
        if (player) {
            if (!player.hasTag("admin")) {
                player.sendMessage("§c権限がありません。");
                return;
            }
            // デバッグ用: 引数が来ているか確認
            // player.sendMessage(`§7Debug Args: ${JSON.stringify(args)}`);
            
            system.run(async () => {
                const { summonBoss } = await import("../systems/item_handler.js");
                summonBoss(player, args.name); // ★変更: args.name
            });
        }
    });

    // 6. /deepcraft:cgive <name> [sellable] (Admin Only)
    registry.registerCommand({
        name: "deepcraft:cgive",
        description: "カスタムアイテムを入手する (Admin限定)",
        permissionLevel: Minecraft.CommandPermissionLevel.Any,
        mandatoryParameters: [
            {
                name: "name", // ★変更: id -> name
                type: Minecraft.CustomCommandParamType.String
            }
        ],
        optionalParameters: [
            {
                name: "sellable",
                type: Minecraft.CustomCommandParamType.Boolean
            }
        ]
    }, (origin, args) => {
        const player = origin.sourceEntity;
        if (player) {
            if (!player.hasTag("admin")) {
                player.sendMessage("§c権限がありません。");
                return;
            }
            // デバッグ用: 引数が来ているか確認
            // player.sendMessage(`§7Debug Args: ${JSON.stringify(args)}`);

            system.run(async () => {
                const { giveCustomItem } = await import("../systems/item_handler.js");
                giveCustomItem(player, args.name, args.sellable || false); // ★変更: args.name
            });
        }
    });
});

function showPlayerStats(player) {
    const stats = calculateEntityStats(player);
    const level = player.getDynamicProperty("deepcraft:level") || 1;
    const xp = player.getDynamicProperty("deepcraft:xp") || 0;
    const gold = player.getDynamicProperty("deepcraft:gold") || 0;

    let msg = `§l§a--- ${player.name}'s Stats ---§r\n`;
    msg += `§eLv.${level}  §fXP: ${xp}\n`;
    msg += `§6Gold: ${gold} G\n`;
    msg += `§cHP: ${stats.maxHP}  §3Ether: ${stats.maxEther}\n`;
    msg += `§4ATK: ${stats.atk}  §bDEF: ${stats.def}\n`;
    msg += `§fSpeed: ${(stats.speed * 100).toFixed(0)}%  §aCrit: ${(stats.critChance * 100).toFixed(1)}%`;
    
    player.sendMessage(msg);
}