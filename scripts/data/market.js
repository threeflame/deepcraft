// BP/scripts/data/market.js
import { world, system, ItemStack, EquipmentSlot } from "@minecraft/server";
import { ModalFormData, MessageFormData } from "@minecraft/server-ui"; // ★MessageFormDataを追加
import { ChestFormData } from "../extensions/forms.js";
import { EQUIPMENT_POOL } from "./equipment.js";

// --- 設定 ---
const MARKET_CONFIG = {
    TAX_RATE: 0.05,           // 手数料 5%
    EXPIRE_HOURS: 24,         // 掲載期間 24時間
    MAX_LISTINGS_PER_PLAYER: 5, // 1人あたりの最大出品数
    ITEMS_PER_DATA_CHUNK: 50, // 1つのプロパティに保存する最大件数
    MAX_CHUNKS: 10            // 最大プロパティ数
};

// --- データ管理クラス ---
export class MarketDataManager {
    static getAllListings() {
        let allListings = [];
        for (let i = 0; i < MARKET_CONFIG.MAX_CHUNKS; i++) {
            const json = world.getDynamicProperty(`deepcraft:market_${i}`);
            if (json) {
                try {
                    allListings = allListings.concat(JSON.parse(json));
                } catch (e) { console.warn(`Market Load Error [${i}]: ${e}`); }
            }
        }
        const now = Date.now();
        return allListings.filter(item => {
            if (now - item.createdAt > MARKET_CONFIG.EXPIRE_HOURS * 3600000) {
                this.sendToMailbox(item.ownerId, item, "expired");
                return false;
            }
            return true;
        }).sort((a, b) => b.createdAt - a.createdAt);
    }

    static saveListings(listings) {
        for (let i = 0; i < MARKET_CONFIG.MAX_CHUNKS; i++) {
            world.setDynamicProperty(`deepcraft:market_${i}`, undefined);
        }
        for (let i = 0; i < listings.length; i += MARKET_CONFIG.ITEMS_PER_DATA_CHUNK) {
            const chunkIndex = Math.floor(i / MARKET_CONFIG.ITEMS_PER_DATA_CHUNK);
            if (chunkIndex >= MARKET_CONFIG.MAX_CHUNKS) break;
            const chunkData = listings.slice(i, i + MARKET_CONFIG.ITEMS_PER_DATA_CHUNK);
            world.setDynamicProperty(`deepcraft:market_${chunkIndex}`, JSON.stringify(chunkData));
        }
    }

    static addListing(player, itemStack, price) {
        // ★追加: アイテムが販売可能かチェック
        if (!itemStack.getDynamicProperty("deepcraft:sellable")) {
            return { success: false, message: "§cそのアイテムはマーケットで販売できません。" };
        }

        const listings = this.getAllListings();
        const playerListings = listings.filter(l => l.ownerId === player.id);
        
        if (playerListings.length >= MARKET_CONFIG.MAX_LISTINGS_PER_PLAYER) {
            return { success: false, message: "§c出品数の上限に達しています。" };
        }

        const customId = itemStack.getDynamicProperty("deepcraft:item_id");
        
        const newItem = {
            id: Date.now().toString() + Math.floor(Math.random()*1000),
            ownerId: player.id,
            ownerName: player.name,
            typeId: itemStack.typeId,
            customId: customId,
            amount: itemStack.amount,
            nameTag: itemStack.nameTag,
            lore: itemStack.getLore(),
            price: price,
            createdAt: Date.now()
        };

        listings.unshift(newItem);
        this.saveListings(listings);
        return { success: true, message: `§a出品しました！ (§e${price} G§a)` };
    }

    static purchaseListing(buyer, listingId) {
        const listings = this.getAllListings();
        const index = listings.findIndex(l => l.id === listingId);
        if (index === -1) return "sold_out";

        const item = listings[index];
        if (item.ownerId === buyer.id) return "own_item";

        const buyerGold = buyer.getDynamicProperty("deepcraft:gold") || 0;
        if (buyerGold < item.price) return "no_money";

        buyer.setDynamicProperty("deepcraft:gold", buyerGold - item.price);
        
        const profit = Math.floor(item.price * (1.0 - MARKET_CONFIG.TAX_RATE));
        this.sendToMailbox(item.ownerId, { amount: profit }, "gold");

        const itemStack = this.reconstructItemStack(item);
        buyer.getComponent("inventory").container.addItem(itemStack);

        listings.splice(index, 1);
        this.saveListings(listings);
        return "success";
    }

    static sendToMailbox(playerId, data, type) {
        const key = `deepcraft:mailbox_${playerId}`;
        let mailbox = [];
        try {
            const json = world.getDynamicProperty(key);
            if (json) mailbox = JSON.parse(json);
        } catch (e) {}

        mailbox.push({ type: type, data: data, date: Date.now() });
        if (JSON.stringify(mailbox).length > 30000) mailbox.shift();
        
        world.setDynamicProperty(key, JSON.stringify(mailbox));
    }

    static reconstructItemStack(data) {
        let item;
        if (data.customId && EQUIPMENT_POOL[data.customId]) {
            const def = EQUIPMENT_POOL[data.customId];
            item = new ItemStack(def.baseItem, data.amount);
            item.setDynamicProperty("deepcraft:item_id", data.customId);
        } else {
            item = new ItemStack(data.typeId, data.amount);
        }
        if (data.nameTag) item.nameTag = data.nameTag;
        if (data.lore) item.setLore(data.lore);
        return item;
    }
}

// --- UI & コマンドロジック ---

export function openMarketMenu(player) {
    const form = new ChestFormData("double");
    form.title("§lグローバルマーケット");

    const gold = player.getDynamicProperty("deepcraft:gold") || 0;
    form.button(4, `§e所持金: ${gold} G`, ["§7欲しいアイテムをクリックで購入"], "minecraft:gold_nugget");
    
    form.button(0, "§a§l手持ちを出品", ["§r§7右手に持っているアイテムを", "§7出品します"], "minecraft:emerald");
    form.button(8, "§d§lポスト / 売上受取", ["§r§7売上金や返却アイテムを確認"], "minecraft:chest_minecart");

    const listings = MarketDataManager.getAllListings();
    listings.slice(0, 45).forEach((item, index) => {
        let icon = item.typeId;
        if (item.customId && EQUIPMENT_POOL[item.customId]) {
            icon = EQUIPMENT_POOL[item.customId].baseItem; 
        }

        const slot = 9 + index;
        const desc = [
            `§r§f${item.nameTag || "Unknown Item"} x${item.amount}`,
            `§e価格: ${item.price} G`,
            `§7出品者: ${item.ownerName}`,
            item.ownerId === player.id ? "§c[あなたの出品]" : "§a[クリックで購入]"
        ];
        if (item.lore && item.lore.length > 0) desc.push("§8----------------", ...item.lore);

        form.button(slot, `§6${item.price} G`, desc, icon, item.amount);
    });

    form.show(player).then(res => {
        if (res.canceled) return;
        
        if (res.selection === 0) { openSellMenu_Hand(player); return; }
        if (res.selection === 8) { openMailbox(player); return; }

        const selectedIndex = res.selection - 9;
        if (selectedIndex >= 0 && selectedIndex < listings.length) {
            confirmPurchase(player, listings[selectedIndex]);
        }
    });
}

// 手持ちアイテム出品フォーム (ModalFormData)
function openSellMenu_Hand(player) {
    const equip = player.getComponent("equippable");
    const item = equip.getEquipment(EquipmentSlot.Mainhand);

    if (!item) {
        player.sendMessage("§c右手にアイテムを持ってください。");
        return;
    }

    // ★修正: submitButtonを削除
    const form = new ModalFormData()
        .title("出品設定")
        .textField(`§a${item.nameTag || "アイテム"} (x${item.amount})\n§7価格を入力してください (手数料 5%)`, "例: 1000");

    form.show(player).then(res => {
        if (res.canceled) return;
        const price = parseInt(res.formValues[0]);

        if (isNaN(price) || price <= 0) {
            player.sendMessage("§c無効な価格です。");
            return;
        }

        const currentItem = equip.getEquipment(EquipmentSlot.Mainhand);
        if (!currentItem) return;

        const result = MarketDataManager.addListing(player, currentItem, price);
        if (result.success) {
            equip.setEquipment(EquipmentSlot.Mainhand, undefined);
            player.playSound("random.orb");
            player.sendMessage(result.message);
        } else {
            player.sendMessage(result.message);
        }
    });
}

// コマンドからの出品処理
export function processCommandSell(player, message) {
    const price = parseInt(message);
    if (isNaN(price) || price <= 0) {
        player.sendMessage("§c価格を指定してください。例: /scriptevent deepcraft:sell 1000");
        return;
    }

    const equip = player.getComponent("equippable");
    const item = equip.getEquipment(EquipmentSlot.Mainhand);

    if (!item) {
        player.sendMessage("§c右手にアイテムを持ってください。");
        return;
    }

    const result = MarketDataManager.addListing(player, item, price);
    if (result.success) {
        equip.setEquipment(EquipmentSlot.Mainhand, undefined);
        player.playSound("random.orb");
        player.sendMessage(result.message);
    } else {
        player.sendMessage(result.message);
    }
}

// 購入確認フォーム (MessageFormData)
function confirmPurchase(player, item) {
    if (item.ownerId === player.id) {
        player.sendMessage("§c自分の出品物は購入できません。");
        openMarketMenu(player);
        return;
    }

    // ★修正: ModalFormData -> MessageFormData に変更
    // ★修正: content -> body に変更
    // ★修正: submitButton -> button1, button2 に変更
    const form = new MessageFormData()
        .title("購入確認")
        .body(`§f商品: ${item.nameTag || "アイテム"} x${item.amount}\n§e価格: ${item.price} G\n\n§7購入しますか？`)
        .button1("§a購入する")
        .button2("キャンセル");

    form.show(player).then(res => {
        // MessageFormDataの場合、canceledがtrue または selectionが0(購入)以外ならキャンセル扱い
        if (res.canceled || res.selection !== 0) { 
            openMarketMenu(player); 
            return; 
        }

        const result = MarketDataManager.purchaseListing(player, item.id);
        if (result === "success") {
            player.playSound("random.levelup");
            player.sendMessage("§a購入しました！");
        } else if (result === "sold_out") {
            player.playSound("note.bass");
            player.sendMessage("§c売り切れです。");
        } else if (result === "no_money") {
            player.playSound("note.bass");
            player.sendMessage("§c所持金が足りません。");
        } else if (result === "own_item") {
            player.sendMessage("§c自分の出品物は購入できません。");
        }
        openMarketMenu(player);
    });
}

function openMailbox(player) {
    const key = `deepcraft:mailbox_${player.id}`;
    const json = world.getDynamicProperty(key);
    const mailbox = json ? JSON.parse(json) : [];

    if (mailbox.length === 0) {
        player.sendMessage("§7ポストは空です。");
        openMarketMenu(player);
        return;
    }

    let totalGold = 0;
    let itemReceived = 0;
    const container = player.getComponent("inventory").container;
    const newMailbox = [];

    mailbox.forEach(mail => {
        if (mail.type === "gold") {
            totalGold += mail.data.amount;
        } else if (mail.type === "expired") {
            const item = MarketDataManager.reconstructItemStack(mail.data);
            if (container.emptySlotsCount > 0) {
                container.addItem(item);
                itemReceived++;
            } else {
                newMailbox.push(mail);
            }
        }
    });

    if (totalGold > 0) {
        const current = player.getDynamicProperty("deepcraft:gold") || 0;
        player.setDynamicProperty("deepcraft:gold", current + totalGold);
        player.sendMessage(`§e売上金 ${totalGold} G を受け取りました。`);
    }
    if (itemReceived > 0) {
        player.sendMessage(`§a${itemReceived}個の返却アイテムを受け取りました。`);
    }
    if (newMailbox.length > 0 && totalGold === 0 && itemReceived === 0) {
        player.sendMessage("§cインベントリがいっぱいで受け取れませんでした。");
    }

    world.setDynamicProperty(key, JSON.stringify(newMailbox));
    player.playSound("random.orb");
}