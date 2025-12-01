// BP/scripts/systems/item_handler.js
import { ItemStack, EquipmentSlot, system } from "@minecraft/server";
import { openMenuHub } from "../ui/ui_manager.js";
import { EQUIPMENT_POOL } from "../data/equipment.js";
import { checkReq } from "../player/player_manager.js";
import { executeSkill } from "../player/skill_manager.js";
import { MOB_POOL } from "../data/mobs.js";
import { calculateEntityStats } from "../player/stat_calculator.js";
import { updateMobNameTag } from "./mob_manager.js";
// ★変更: 新しい関数をインポート
import { setItemData, getItemId } from "./lore_manager.js";

const SLOT_MAP = {
    "mainhand": EquipmentSlot.Mainhand,
    "offhand": EquipmentSlot.Offhand,
    "head": EquipmentSlot.Head,
    "chest": EquipmentSlot.Chest,
    "legs": EquipmentSlot.Legs,
    "feet": EquipmentSlot.Feet
};

export function handleItemUse(event) {
    const player = event.source;
    const item = event.itemStack;

    if (item.typeId === "minecraft:compass") {
        openMenuHub(player);
        return;
    }

    // ★変更: getItemIdを使用
    const customId = getItemId(item);
    if (customId) {
        const def = EQUIPMENT_POOL[customId];
        if (def && def.skillId) {
            if (checkReq(player, item).valid) {
                executeSkill(player, def.skillId);
            } else {
                player.playSound("random.break");
                player.sendMessage("§c能力不足のためスキルを発動できません！");
            }
        }
    }
}

export function giveCustomItem(player, itemId, isSellable = false) {
    const def = EQUIPMENT_POOL[itemId];
    if (!def) { player.sendMessage(`§cアイテムが見つかりません: ${itemId}`); return; }
    const item = createCustomItem(itemId, isSellable);
    player.getComponent("inventory").container.addItem(item);
    player.sendMessage(`§e入手: ${def.name}${isSellable ? " §a(販売可能)" : ""}`);
}

export function summonBoss(player, bossId) {
    const def = MOB_POOL[bossId];
    if (!def) { player.sendMessage(`§cボスIDが見つかりません。`); return; }
    try {
        const boss = player.dimension.spawnEntity(def.type, player.location);
        boss.addTag("deepcraft:boss"); 
        boss.setDynamicProperty("deepcraft:boss_id", bossId);
        boss.nameTag = def.name;

        const equip = boss.getComponent("equippable");
        if (equip && def.equipment) {
            Object.entries(def.equipment).forEach(([slotName, itemId]) => {
                const slotEnum = SLOT_MAP[slotName.toLowerCase()];
                if (slotEnum) {
                    equip.getEquipmentSlot(slotEnum).setItem(createCustomItem(itemId));
                }
            });
        }

        if (def.scale) {
            const scale = boss.getComponent("minecraft:scale");
            if (scale) scale.value = def.scale;
        }
        if (def.speed) {
            const movement = boss.getComponent("minecraft:movement");
            if (movement) movement.setCurrentValue(def.speed);
        }

        calculateEntityStats(boss);
        updateMobNameTag(boss);

        player.sendMessage(`§c§l警告: ${def.name} が出現しました！`);
        player.playSound("mob.enderdragon.growl");
    } catch (e) { player.sendMessage(`§cエラー: ${e}`); }
}

export function createCustomItem(itemId, isSellable = false) {
    const def = EQUIPMENT_POOL[itemId];
    if (!def) return new ItemStack(itemId, 1);
    const item = new ItemStack(def.baseItem, 1);
    item.nameTag = def.name;

    // ★変更: setItemDataを使用 (自動でDPかLoreか判断される)
    const extraData = {};
    if (isSellable) extraData.sellable = true;
    
    // 既存のLoreがあればセットしてからデータ埋め込み
    if (def.lore) item.setLore(def.lore);
    
    setItemData(item, itemId, extraData);

    return item;
}