// BP/scripts/systems/debug_menu.js
import { world, system } from "@minecraft/server";
import { ChestFormData } from "../extensions/forms.js";
import { ModalFormData, ActionFormData } from "@minecraft/server-ui";
import { EQUIPMENT_POOL } from "../data/equipment.js";
import { MOB_POOL } from "../data/mobs.js";
import { SKILL_POOL } from "../data/skills.js";
import { giveCustomItem, summonBoss } from "./item_handler.js";
import { addXP, resetCurrentProfile } from "../player/player_manager.js";
import { setupSpawner, removeNearbySpawners, toggleSpawnerDebug } from "./spawner_manager.js";

/**
 * デバッグハブメインメニュー (ChestGUI)
 */
export function openDebugHub(player) {
    const form = new ChestFormData("large");
    form.title("§c§l[DEBUG] 開発者メニュー");

    // Row 1: リソース系
    form.button(1, "§e§l+10000 XP", ["§7経験値を追加"], "textures/items/experience_bottle", 1, 0, true);
    form.button(2, "§6§l+1000 Gold", ["§7ゴールドを追加"], "textures/items/gold_ingot", 1, 0, true);
    form.button(3, "§4§lプロファイルリセット", ["§c全データをリセット"], "textures/items/barrier");

    // Row 2: アイテム・Mob
    form.button(10, "§b§lアイテム入手", ["§7カスタム装備を入手"], "textures/blocks/chest_front");
    form.button(11, "§c§lMob召喚", ["§7ボス・ダミーを召喚"], "textures/blocks/spawner");
    form.button(12, "§d§lスポナー管理", ["§7スポナー設置・削除"], "textures/blocks/mob_spawner");

    // Row 3: スキル管理
    form.button(19, "§a§lスキル取得", ["§7スキルを習得"], "textures/items/book_enchanted", 1, 0, true);
    form.button(20, "§c§lスキル放棄", ["§7習得スキルを削除"], "textures/items/book_writable");

    // 閉じる
    form.button(53, "§c§l閉じる", [], "textures/items/barrier");

    form.show(player).then(res => {
        if (res.canceled || res.selection === 53) return;

        const actions = {
            1: () => {
                addXP(player, 10000);
                player.playSound("random.levelup", { volume: 0.4 });
                player.sendMessage("§8» §e+10000 XP");
                system.runTimeout(() => openDebugHub(player), 10);
            },
            2: () => {
                const current = player.getDynamicProperty("deepcraft:gold") || 0;
                player.setDynamicProperty("deepcraft:gold", current + 1000);
                player.playSound("random.orb", { volume: 0.35 });
                player.sendMessage("§8» §6+1000 G");
                system.runTimeout(() => openDebugHub(player), 10);
            },
            3: () => {
                resetCurrentProfile(player);
                player.sendMessage("§8» §cプロファイルをリセットしました");
                system.runTimeout(() => openDebugHub(player), 10);
            },
            10: () => openDebugGiveMenu(player),
            11: () => openDebugSummonMenu(player),
            12: () => openSpawnerMenu(player),
            19: () => openDebugSkillGiveMenu(player),
            20: () => openDebugSkillRemoveMenu(player)
        };

        actions[res.selection]?.();
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
        if (res.selection === 3) openDebugHub(player);
    });
}

/**
 * スキル取得メニュー
 */
function openDebugSkillGiveMenu(player) {
    const form = new ChestFormData("large");
    form.title("§a§lスキル取得");

    const skillIds = Object.keys(SKILL_POOL);
    
    skillIds.forEach((id, index) => {
        if (index >= 53) return;
        const skill = SKILL_POOL[id];
        const hasSkill = player.hasTag(`spell:${id}`);
        const displayName = hasSkill ? `§a${skill.name}` : skill.name;
        const lore = [
            `§8ID: ${id}`,
            `§7CD: ${skill.cooldown / 20}s  §bMP: ${skill.manaCost}`,
            hasSkill ? "§a既に習得済み" : "§e[クリックで習得]"
        ];
        form.button(index, displayName, lore, "textures/items/book_enchanted", 1, 0, hasSkill);
    });

    form.button(53, "§c§l戻る", [], "textures/items/barrier");

    form.show(player).then(res => {
        if (res.canceled || res.selection === 53) {
            system.runTimeout(() => openDebugHub(player), 10);
            return;
        }

        const selectedId = skillIds[res.selection];
        if (selectedId) {
            player.addTag(`spell:${selectedId}`);
            player.playSound("random.orb", { volume: 0.35 });
            player.sendMessage(`§8» §aスキル習得: ${SKILL_POOL[selectedId].name}`);
            system.runTimeout(() => openDebugSkillGiveMenu(player), 10);
        }
    });
}

/**
 * スキル放棄メニュー
 */
function openDebugSkillRemoveMenu(player) {
    const form = new ChestFormData("large");
    form.title("§c§lスキル放棄");

    const skillIds = Object.keys(SKILL_POOL);
    const ownedSkills = skillIds.filter(id => player.hasTag(`spell:${id}`));

    if (ownedSkills.length === 0) {
        form.button(22, "§7習得スキルなし", [], "textures/items/barrier");
    } else {
        ownedSkills.forEach((id, index) => {
            if (index >= 53) return;
            const skill = SKILL_POOL[id];
            const lore = [
                `§8ID: ${id}`,
                `§7CD: ${skill.cooldown / 20}s  §bMP: ${skill.manaCost}`,
                "§c[クリックで放棄]"
            ];
            form.button(index, `§c${skill.name}`, lore, "textures/items/book_writable");
        });
    }

    form.button(53, "§c§l戻る", [], "textures/items/barrier");

    form.show(player).then(res => {
        if (res.canceled || res.selection === 53) {
            system.runTimeout(() => openDebugHub(player), 10);
            return;
        }

        const selectedId = ownedSkills[res.selection];
        if (selectedId) {
            player.removeTag(`spell:${selectedId}`);
            
            // グリモワールから削除
            const grimoireRaw = player.getDynamicProperty("deepcraft:grimoire");
            if (grimoireRaw) {
                try {
                    const grimoire = JSON.parse(grimoireRaw);
                    let changed = false;
                    for (const comboKey in grimoire) {
                        if (grimoire[comboKey] === `spell:${selectedId}`) {
                            delete grimoire[comboKey];
                            changed = true;
                        }
                    }
                    if (changed) {
                        player.setDynamicProperty("deepcraft:grimoire", JSON.stringify(grimoire));
                    }
                } catch (_) {}
            }
            
            player.playSound("random.break", { volume: 0.3 });
            player.sendMessage(`§8» §cスキル放棄: ${SKILL_POOL[selectedId].name}`);
            system.runTimeout(() => openDebugSkillRemoveMenu(player), 10);
        }
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
            openDebugHub(player);
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
            openDebugHub(player);
            return;
        }
        const selectedId = mobIds[res.selection];
        if (selectedId) {
            summonBoss(player, selectedId);
            player.sendMessage(`§8» §a召喚しました: ${selectedId}`);
        }
    });
}