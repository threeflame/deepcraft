// BP/scripts/systems/debug_menu.js
import { ChestFormData } from "../extensions/forms.js";
import { EQUIPMENT_POOL } from "../data/equipment.js";
import { MOB_POOL } from "../data/mobs.js";
import { giveCustomItem, summonBoss } from "./item_handler.js";
import { openMenuHub } from "../ui/ui_manager.js";

/**
 * デバッグ: アイテム入手メニュー
 */
export function openDebugGiveMenu(player) {
    const form = new ChestFormData("large");
    form.title("§l[Debug] アイテム入手");

    // EQUIPMENT_POOLから全アイテムを取得してリスト化
    const itemIds = Object.keys(EQUIPMENT_POOL);
    
    // ChestUIの制限(54スロット)に合わせてページングが必要だが、今回は簡易的に先頭から詰める
    itemIds.forEach((id, index) => {
        if (index >= 53) return; // 最後のスロットは戻るボタン用
        
        const def = EQUIPMENT_POOL[id];
        // アイコンはベースアイテムを使用
        form.button(index, def.name, [`§8ID: ${id}`, "§e[クリックで入手]"], def.baseItem);
    });

    form.button(53, "§c§l戻る", [], "minecraft:barrier");

    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 53) {
            openMenuHub(player);
            return;
        }

        const selectedId = itemIds[res.selection];
        if (selectedId) {
            giveCustomItem(player, selectedId, true); // true = sellable (テスト用に販売可能で渡す)
            // 連続して入手できるようにメニューを再表示
            openDebugGiveMenu(player);
        }
    });
}

/**
 * デバッグ: Mob召喚メニュー
 */
export function openDebugSummonMenu(player) {
    const form = new ChestFormData("small"); // Mobは少ないのでsmallで十分
    form.title("§l[Debug] Mob召喚");

    const mobIds = Object.keys(MOB_POOL);

    mobIds.forEach((id, index) => {
        if (index >= 26) return;
        
        const def = MOB_POOL[id];
        // アイコンはスポーンエッグがあればそれを使うが、無ければ汎用的なもの
        let icon = "minecraft:spawn_egg";
        if (def.type === "minecraft:zombie") icon = "minecraft:zombie_spawn_egg";
        else if (def.type.includes("skeleton")) icon = "minecraft:skeleton_spawn_egg";
        
        form.button(index, def.name, [`§8ID: ${id}`, `§7Type: ${def.type}`, "§c[クリックで召喚]"], icon);
    });

    form.button(26, "§c§l戻る", [], "minecraft:barrier");

    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 26) {
            openMenuHub(player);
            return;
        }

        const selectedId = mobIds[res.selection];
        if (selectedId) {
            summonBoss(player, selectedId);
            player.sendMessage(`§a召喚しました: ${selectedId}`);
            // 召喚後はメニューを閉じる（戦闘準備のため）
        }
    });
}