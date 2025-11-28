// BP/scripts/systems/item_handler.js
import { ItemStack, EquipmentSlot } from "@minecraft/server";
import { openMenuHub } from "../ui/ui_manager.js";
import { EQUIPMENT_POOL } from "../data/equipment.js";
import { checkReq } from "../player/player_manager.js";
import { executeSkill } from "../player/skill_manager.js";
import { MOB_POOL } from "../data/mobs.js";

export function handleItemUse(event) {
    const player = event.source;
    const item = event.itemStack;

    if (item.typeId === "minecraft:compass") {
        const combatTimer = player.getDynamicProperty("deepcraft:combat_timer") || 0;
        if (combatTimer > 0) {
            player.playSound("note.bass");
            player.sendMessage(`§c§l戦闘中はメニューを開けません！ (§c${combatTimer.toFixed(1)}s§c)`);
            return;
        }
        openMenuHub(player);
        return;
    }

    const customId = item.getDynamicProperty("deepcraft:item_id");
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

export function giveCustomItem(player, itemId) {
    const def = EQUIPMENT_POOL[itemId];
    if (!def) { player.sendMessage(`§cアイテムが見つかりません: ${itemId}`); return; }
    const item = createCustomItem(itemId);
    player.getComponent("inventory").container.addItem(item);
    player.sendMessage(`§e入手: ${def.name}`);
}

export function summonBoss(player, bossId) {
    const def = MOB_POOL[bossId];
    if (!def) { player.sendMessage(`§cボスIDが見つかりません。`); return; }
    try {
        const boss = player.dimension.spawnEntity(def.type, player.location);
        boss.addTag("deepcraft:boss");
        boss.setDynamicProperty("deepcraft:boss_id", bossId);
        boss.nameTag = def.name;

        if (boss.getComponent("minecraft:health")) boss.addEffect("resistance", 20000000, { amplifier: 1, showParticles: false });

        const equip = boss.getComponent("equippable");
        if (equip && def.equipment) {
            Object.entries(def.equipment).forEach(([slot, itemId]) => {
                equip.setEquipment(slot, createCustomItem(itemId));
            });
        }
        player.sendMessage(`§c§l警告: ${def.name} が出現しました！`);
        player.playSound("mob.enderdragon.growl");
    } catch (e) { player.sendMessage(`§cエラー: ${e}`); }
}

export function createCustomItem(itemId) {
    const def = EQUIPMENT_POOL[itemId];
    if (!def) return new ItemStack(itemId, 1);
    const item = new ItemStack(def.baseItem, 1);
    item.nameTag = def.name;
    item.setLore(def.lore);
    item.setDynamicProperty("deepcraft:item_id", itemId);
    return item;
}