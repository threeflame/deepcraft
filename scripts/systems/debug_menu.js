// BP/scripts/systems/debug_menu.js
import { world, system } from "@minecraft/server";
import { ChestFormData } from "../extensions/forms.js";
import { ModalFormData, ActionFormData } from "@minecraft/server-ui";
import { EQUIPMENT_POOL } from "../data/equipment.js";
import { MOB_POOL } from "../data/mobs.js";
import { giveCustomItem, summonBoss } from "./item_handler.js";
import { openMenuHub } from "../ui/ui_manager.js";
import { setupSpawner, removeNearbySpawners, toggleSpawnerDebug } from "./spawner_manager.js";

/**
 * 開発者用メインメニュー
 */
export function openDebugMenu(player) {
    const form = new ActionFormData()
        .title("§l[Debug] 開発者メニュー")
        .body("機能を選択してください")
        .button("§lアイテム入手", "textures/ui/inventory_icon")
        .button("§lMob召喚", "textures/ui/spawn_egg")
        .button("§lスポナー管理", "textures/blocks/spawner") // ★追加
        .button("§lメニューに戻る");

    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 0) openDebugGiveMenu(player);
        if (res.selection === 1) openDebugSummonMenu(player);
        if (res.selection === 2) openSpawnerMenu(player); // ★追加
        if (res.selection === 3) openMenuHub(player);
    });
}

/**
 * スポナー管理メニュー
 */
function openSpawnerMenu(player) {
    const form = new ActionFormData()
        .title("§lスポナー管理")
        .button("§a§l新規設置 (GUI)", "textures/ui/color_plus")
        .button("§c§l近くを撤去", "textures/ui/trash")
        .button("§e§lデバッグ表示切替", "textures/ui/visible_icon")
        .button("戻る");

    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 0) openSpawnerCreateForm(player);
        if (res.selection === 1) {
            removeNearbySpawners(player);
            // 連続作業のため少し待って再表示
            system.runTimeout(() => openSpawnerMenu(player), 20);
        }
        if (res.selection === 2) {
            toggleSpawnerDebug(player);
            system.runTimeout(() => openSpawnerMenu(player), 20);
        }
        if (res.selection === 3) openDebugMenu(player);
    });
}

/**
 * スポナー設置フォーム (ModalForm)
 */
function openSpawnerCreateForm(player) {
    const mobIds = Object.keys(MOB_POOL);
    
    const form = new ModalFormData()
        .title("スポナー設置")
        .dropdown("湧かせるMobを選択", mobIds.map(id => MOB_POOL[id].name), { defaultValueIndex: 0 })
        .slider("リスポーン時間 (秒)", 10, 600, { step: 10, defaultValue: 60 })
        .slider("検知半径 (m)", 4, 64, { step: 1, defaultValue: 16 })

    form.show(player).then(res => {
        if (res.canceled) {
            openSpawnerMenu(player);
            return;
        }

        const [mobIndex, respawnTime, radius] = res.formValues;
        const selectedMobId = mobIds[mobIndex];

        if (selectedMobId) {
            setupSpawner(player, selectedMobId, respawnTime, radius);
            // 設置完了後もメニューに戻るか、チャットで通知して終了
        }
    });
}

/**
 * デバッグ: アイテム入手メニュー (既存)
 */
export function openDebugGiveMenu(player) {
    const form = new ChestFormData("large");
    form.title("§l[Debug] アイテム入手");

    const itemIds = Object.keys(EQUIPMENT_POOL);
    
    itemIds.forEach((id, index) => {
        if (index >= 53) return;
        const def = EQUIPMENT_POOL[id];
        form.button(index, def.name, [`§8ID: ${id}`, "§e[クリックで入手]"], def.baseItem);
    });

    form.button(53, "§c§l戻る", [], "minecraft:barrier");

    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 53) {
            openDebugMenu(player);
            return;
        }
        const selectedId = itemIds[res.selection];
        if (selectedId) {
            giveCustomItem(player, selectedId, true);
            openDebugGiveMenu(player);
        }
    });
}

/**
 * デバッグ: Mob召喚メニュー (既存)
 */
export function openDebugSummonMenu(player) {
    const form = new ChestFormData("small");
    form.title("§l[Debug] Mob召喚");

    const mobIds = Object.keys(MOB_POOL);

    mobIds.forEach((id, index) => {
        if (index >= 26) return;
        const def = MOB_POOL[id];
        let icon = "minecraft:spawn_egg";
        if (def.type === "minecraft:zombie") icon = "minecraft:zombie_spawn_egg";
        else if (def.type.includes("skeleton")) icon = "minecraft:skeleton_spawn_egg";
        
        form.button(index, def.name, [`§8ID: ${id}`, `§7Type: ${def.type}`, "§c[クリックで召喚]"], icon);
    });

    form.button(26, "§c§l戻る", [], "minecraft:barrier");

    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 26) {
            openDebugMenu(player);
            return;
        }
        const selectedId = mobIds[res.selection];
        if (selectedId) {
            summonBoss(player, selectedId);
            player.sendMessage(`§a召喚しました: ${selectedId}`);
        }
    });
}