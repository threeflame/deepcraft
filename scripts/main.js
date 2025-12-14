// BP/scripts/main.js
import { world, system } from "@minecraft/server";

// --- Module Imports ---
import { initializeGameLoop, initializeDeathCheckLoop, initializeHudLoop } from "./systems/game_loop.js";
import { handlePlayerSpawn } from "./player/player_manager.js";
// import { handleItemUse } from "./systems/item_handler.js"; // ★削除: main.js内で直接処理するため不要
import { handleScriptEventCommand } from "./systems/command_handler.js";
import { handleEntityHurt } from "./combat/combat_system.js";
import { handleEntityDie, handlePlayerLeave } from "./combat/death_system.js";
import { runSpawnerLoop } from "./systems/spawner_manager.js";
import "./systems/custom_commands.js";
import { runMovementLoop } from "./systems/movement_system.js";
import { runStatusLoop } from "./systems/status_manager.js";
import { initializeInputSystem, handleDeepcraftInputItemUse } from "./systems/input_system.js";

import { openMenuHub } from "./ui/ui_manager.js";
import { openDebugHub } from "./systems/debug_menu.js";

// --- System Initialization ---

// メインループを開始
initializeGameLoop();
initializeDeathCheckLoop();
initializeHudLoop();
runSpawnerLoop();
runMovementLoop();
runStatusLoop();
initializeInputSystem();

// --- Event Subscriptions ---

// プレイヤーがワールドに参加/リスポーンした時
world.afterEvents.playerSpawn.subscribe((ev) => {
    try {
        handlePlayerSpawn(ev);
    } catch (e) { console.warn(`PlayerSpawn Error: ${e} ${e.stack}`); }
});

// アイテム使用 (メニュー、スキル、セーフゾーン判定)
world.afterEvents.itemUse.subscribe((ev) => {
    const player = ev.source;
    const item = ev.itemStack;

    // ▼▼▼ 気絶チェック (Knocked Check) ▼▼▼
    if (player.hasTag("deepcraft:knocked")) {
        player.playSound("note.bass", { volume: 0.3 });
        player.sendMessage("§c気絶中は動けません！ (味方に助けを求めてください)");
        return; // 強制終了
    }
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    // ▼▼▼ 1. セーフゾーン判定 (Safe Zone Check) ▼▼▼
    // deepcraft:safe タグを持っている場合、戦闘行為を禁止する
    if (player.hasTag("deepcraft:safe")) {
        // 例外: "minecraft:compass" (メニュー) だけは許可する
        if (item.typeId === "minecraft:compass") {
            // そのまま下の処理へ通す
        } else {
            // それ以外(武器スキルや魔法)は使用禁止
            player.playSound("note.bass", { volume: 0.3, pitch: 0.8 });
            player.sendMessage("§cセーフゾーン内では行動できません。");
            return; // ここで処理を強制終了
        }
    }
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    // 2. コンパス (メニュー)
    if (item.typeId === "minecraft:compass") {
        openMenuHub(player);
        return;
    }

    // 2.5. 時計 (デバッグメニュー)
    if (item.typeId === "minecraft:clock") {
        openDebugHub(player);
        return;
    }

    // 3. DeepCraft入力 (右クリック): Tap=コンボ入力 / Hold=武器技
    handleDeepcraftInputItemUse(player, item);
});

// エンティティがダメージを受けた時
world.afterEvents.entityHurt.subscribe((ev) => {
    try {
        handleEntityHurt(ev);
    } catch (e) { console.warn(`EntityHurt Error: ${e} ${e.stack}`); }
});

// エンティティが死亡した時
world.afterEvents.entityDie.subscribe((ev) => {
    try {
        handleEntityDie(ev);
    } catch (e) { console.warn(`EntityDie Error: ${e} ${e.stack}`); }
});

// プレイヤーがワールドから退出した時
world.afterEvents.playerLeave.subscribe((ev) => {
    try {
        handlePlayerLeave(ev);
    } catch (e) { console.warn(`PlayerLeave Error: ${e} ${e.stack}`); }
});