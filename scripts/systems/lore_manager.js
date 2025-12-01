// BP/scripts/systems/lore_manager.js
import { ItemStack } from "@minecraft/server";

const LORE_PREFIX = "§d§c§:"; // Lore用接頭辞

export function encodeLoreData(data) {
    const jsonString = JSON.stringify(data);
    let encoded = LORE_PREFIX;
    for (const char of jsonString) {
        encoded += `§${char}`;
    }
    return encoded;
}

export function decodeLoreData(itemStack) {
    // ★修正: アイテムがない場合は即座にnullを返す（エラー防止）
    if (!itemStack) return null;
    
    const lore = itemStack.getLore();
    if (!lore || lore.length === 0) return null;
    const dataLine = lore.find(line => line.startsWith(LORE_PREFIX));
    if (!dataLine) return null;
    try {
        const jsonString = dataLine.substring(LORE_PREFIX.length).replace(/§/g, "");
        return JSON.parse(jsonString);
    } catch (e) {
        return null;
    }
}

export function setItemData(itemStack, id, extraData = {}) {
    if (itemStack.maxAmount > 1) {
        const data = { id, ...extraData };
        const currentLore = itemStack.getLore() || [];
        const cleanLore = currentLore.filter(l => !l.startsWith(LORE_PREFIX));
        itemStack.setLore([...cleanLore, encodeLoreData(data)]);
    } else {
        itemStack.setDynamicProperty("deepcraft:item_id", id);
        if (Object.keys(extraData).length > 0) {
            itemStack.setDynamicProperty("deepcraft:extra_data", JSON.stringify(extraData));
        }
    }
}

export function getItemId(itemStack) {
    if (!itemStack) return null;
    
    const dpId = itemStack.getDynamicProperty("deepcraft:item_id");
    if (dpId) return dpId;

    const loreData = decodeLoreData(itemStack);
    return loreData ? loreData.id : null;
}

export function getItemExtraData(itemStack) {
    if (!itemStack) return {};

    const dpJson = itemStack.getDynamicProperty("deepcraft:extra_data");
    if (dpJson) {
        try { return JSON.parse(dpJson); } catch(e) {}
    }

    const loreData = decodeLoreData(itemStack);
    if (loreData) {
        const { id, ...extras } = loreData;
        return extras;
    }

    return {};
}