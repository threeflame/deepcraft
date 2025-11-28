// BP/scripts/main.js
import { world, system } from "@minecraft/server";

// --- Module Imports ---
import { initializeGameLoop } from "./systems/game_loop.js";
import { handlePlayerSpawn } from "./player/player_manager.js";
import { handleChatCommand } from "./systems/command_handler.js";
import { handleItemUse } from "./systems/item_handler.js";
import { handleEntityHurt } from "./combat/combat_system.js";
import { handleEntityDie, handlePlayerLeave } from "./combat/death_system.js";

// --- System Initialization ---

// メインループを開始
initializeGameLoop();

// --- Event Subscriptions ---

// プレイヤーがワールドに参加/リスポーンした時
world.afterEvents.playerSpawn.subscribe((ev) => {
    try {
        handlePlayerSpawn(ev);
    } catch (e) { console.warn(`PlayerSpawn Error: ${e} ${e.stack}`); }
});

// プレイヤーがチャットを送信した時
world.beforeEvents.chatSend.subscribe((ev) => {
    try {
        if (ev.message.startsWith("!")) {
            ev.cancel = true;
            system.run(() => handleChatCommand(ev.sender, ev.message));
        }
    } catch (e) { console.warn(`ChatCommand Error: ${e} ${e.stack}`); }
});

// プレイヤーがアイテムを使用した時
world.afterEvents.itemUse.subscribe((ev) => {
    try {
        handleItemUse(ev);
    } catch (e) { console.warn(`ItemUse Error: ${e} ${e.stack}`); }
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
