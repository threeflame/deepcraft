// BP/scripts/data/market.js
import { world, ItemStack } from "@minecraft/server";
import { ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { ChestFormData } from "../extensions/forms.js";
import { EQUIPMENT_POOL } from "./equipment.js";
import { getItemId, getItemExtraData } from "../systems/lore_manager.js";

// --- 設定 ---
const MARKET_CONFIG = {
    TAX_RATE: 0.05,            // 手数料 5%
    EXPIRE_HOURS: 72,          // 掲載期間 72時間
    MAX_LISTINGS_PER_PLAYER: 10, 
    ITEMS_PER_DATA_CHUNK: 30,  
    MAX_CHUNKS: 20             
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
        const activeListings = [];
        let hasExpired = false;

        allListings.forEach(item => {
            if (now - item.createdAt > MARKET_CONFIG.EXPIRE_HOURS * 3600000) {
                this.sendToMailbox(item.ownerId, item, "expired");
                hasExpired = true;
            } else {
                activeListings.push(item);
            }
        });

        if (hasExpired) {
            this.saveListings(activeListings);
        }

        return activeListings.sort((a, b) => b.createdAt - a.createdAt);
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
        // 販売可能チェック (念のためここでも行う)
        const extras = getItemExtraData(itemStack);
        if (!extras.sellable) {
             // return { success: false, message: "§cこのアイテムは販売できません。" };
             // ※UI側で弾くのでここは通すが、厳密にするならコメントアウトを外す
        }

        const listings = this.getAllListings();
        const playerListings = listings.filter(l => l.ownerId === player.id);
        if (playerListings.length >= MARKET_CONFIG.MAX_LISTINGS_PER_PLAYER) {
            return { success: false, message: "§c出品数の上限に達しています。" };
        }

        const savedProperties = {};
        try {
            const propIds = itemStack.getDynamicPropertyIds();
            for (const propId of propIds) {
                savedProperties[propId] = itemStack.getDynamicProperty(propId);
            }
        } catch (e) { console.warn("DP Save Error: " + e); }

        const newItem = {
            id: player.id + "_" + Date.now(),
            ownerId: player.id,
            ownerName: player.name,
            typeId: itemStack.typeId, 
            amount: itemStack.amount,
            nameTag: itemStack.nameTag,
            lore: itemStack.getLore(),
            properties: savedProperties,
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

        const itemData = listings[index];

        // 自分自身のアイテム -> 取り下げ処理へ
        if (itemData.ownerId === buyer.id) return "own_item";

        const buyerGold = buyer.getDynamicProperty("deepcraft:gold") || 0;
        if (buyerGold < itemData.price) return "no_money";

        buyer.setDynamicProperty("deepcraft:gold", buyerGold - itemData.price);
        
        const profit = Math.floor(itemData.price * (1.0 - MARKET_CONFIG.TAX_RATE));
        this.sendToMailbox(itemData.ownerId, { amount: profit, itemName: itemData.nameTag || "アイテム" }, "sold");
        this.sendToMailbox(buyer.id, itemData, "purchased");

        listings.splice(index, 1);
        this.saveListings(listings);
        return "success";
    }

    // ★追加: 出品取り下げ処理
    static cancelListing(player, listingId) {
        const listings = this.getAllListings();
        const index = listings.findIndex(l => l.id === listingId);
        if (index === -1) return { success: false, message: "§cアイテムが見つかりません。" };

        const itemData = listings[index];
        if (itemData.ownerId !== player.id) return { success: false, message: "§c権限がありません。" };

        // ポストに返却
        this.sendToMailbox(player.id, itemData, "expired"); // expired扱いとして返却

        listings.splice(index, 1);
        this.saveListings(listings);
        return { success: true, message: "§a出品を取り下げ、ポストに返却しました。" };
    }

    static sendToMailbox(playerId, data, type) {
        const key = `deepcraft:mailbox_${playerId}`;
        let mailbox = [];
        try {
            const json = world.getDynamicProperty(key);
            if (json) mailbox = JSON.parse(json);
        } catch (e) {}

        mailbox.push({ type: type, data: data, date: Date.now() });
        if (mailbox.length > 50) mailbox.shift();
        
        try {
            world.setDynamicProperty(key, JSON.stringify(mailbox));
        } catch(e) { console.warn("Mailbox Full: " + e); }
    }

    static reconstructItemStack(data) {
        let item;
        const customId = data.properties ? data.properties["deepcraft:item_id"] : null;
        
        if (customId && EQUIPMENT_POOL[customId]) {
            const def = EQUIPMENT_POOL[customId];
            item = new ItemStack(def.baseItem, data.amount);
        } else {
            item = new ItemStack(data.typeId, data.amount);
        }
        
        if (data.nameTag) item.nameTag = data.nameTag;
        if (data.lore) item.setLore(data.lore);
        
        if (data.properties) {
            for (const [key, value] of Object.entries(data.properties)) {
                try { item.setDynamicProperty(key, value); } catch(e) {}
            }
        }
        return item;
    }
}

// --- UI処理 ---

export function openMarketMenu(player, options = {}) {
    const { page = 0, searchKeyword = "" } = options;

    const form = new ChestFormData("double", false);
    form.title(searchKeyword ? `§l検索: ${searchKeyword}` : "§lグローバルマーケット");
    
    form.button(3, searchKeyword ? "§c§l検索クリア" : "§b§l検索", [], "minecraft:spyglass");
    form.button(4, "§a§l出品する", ["§r§7インベントリから選択"], "minecraft:emerald");
    form.button(8, "§d§lポスト (受け取り)", ["§r§e購入品・売上金・返却品"], "minecraft:chest_minecart");

    let listings = MarketDataManager.getAllListings();
    if (searchKeyword) {
        listings = listings.filter(l => 
            (l.nameTag && l.nameTag.toLowerCase().includes(searchKeyword.toLowerCase())) ||
            (l.ownerName && l.ownerName.toLowerCase().includes(searchKeyword.toLowerCase()))
        );
    }

    const itemsPerPage = 45;
    const maxPage = Math.max(0, Math.ceil(listings.length / itemsPerPage) - 1);
    const currentPage = Math.max(0, Math.min(page, maxPage));
    const startIndex = currentPage * itemsPerPage;
    const itemsToShow = listings.slice(startIndex, startIndex + itemsPerPage);

    if (currentPage > 0) form.button(0, "§e<< 前へ", [], "minecraft:arrow");
    if (currentPage < maxPage) form.button(2, "§e次へ >>", [], "minecraft:arrow");
    form.button(1, `§7ページ ${currentPage + 1}/${maxPage + 1}`, [`§7全 ${listings.length} 件`], "minecraft:paper");

    itemsToShow.forEach((item, index) => {
        let icon = item.typeId;
        if (item.properties && item.properties["deepcraft:item_id"]) {
            const cid = item.properties["deepcraft:item_id"];
            if (EQUIPMENT_POOL[cid]) icon = EQUIPMENT_POOL[cid].baseItem;
        }

        const slot = 9 + index;
        const isOwner = item.ownerId === player.id;
        const desc = [
            `§e価格: ${item.price} G`,
            `§7出品者: ${item.ownerName}`,
            isOwner ? "§c[あなたの出品] §eクリックで取り下げ" : "§a[クリックで購入]"
        ];
        
        if (item.lore && item.lore.length > 0) {
            desc.push("§8---");
            desc.push(...item.lore.slice(0, 3));
        }

        form.button(slot, `§f${item.nameTag || "アイテム"}`, desc, icon, item.amount);
    });

    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 0 && currentPage > 0) { openMarketMenu(player, { ...options, page: currentPage - 1 }); return; }
        if (res.selection === 2 && currentPage < maxPage) { openMarketMenu(player, { ...options, page: currentPage + 1 }); return; }
        if (res.selection === 3) {
            if (searchKeyword) openMarketMenu(player, {});
            else openSearchInput(player);
            return;
        }
        if (res.selection === 4) { openSellMenu(player); return; }
        if (res.selection === 8) { openMailbox(player); return; }

        const selectedItem = itemsToShow[res.selection - 9];
        if (selectedItem) {
            if (selectedItem.ownerId === player.id) {
                // 自分のアイテム -> 取り下げ確認
                confirmCancelListing(player, selectedItem, options);
            } else {
                // 他人のアイテム -> 購入確認
                confirmPurchase(player, selectedItem, options);
            }
        }
    });
}

function openSearchInput(player) {
    const form = new ModalFormData()
        .title("検索")
        .textField("キーワードを入力 (アイテム名/出品者名)", "例: 剣");
    form.show(player).then(res => {
        if (!res.canceled && res.formValues[0]) {
            openMarketMenu(player, { searchKeyword: res.formValues[0], page: 0 });
        } else {
            openMarketMenu(player);
        }
    });
}

function openSellMenu(player) {
    const form = new ChestFormData("large", true);
    form.title("§l出品アイテム選択");

    const inventory = player.getComponent("inventory").container;
    const sellableSlots = [];
    let uiSlot = 0;

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (!item) continue;

        // ★修正: sellableチェックを導入
        const extras = getItemExtraData(item);
        const isSellable = extras && extras.sellable === true;

        // sellableフラグがないアイテムはリストに出さない
        if (!isSellable) continue;

        form.button(uiSlot, item.nameTag || "Item", [`§7Slot: ${i}`, "§e[クリックで価格設定]"], item.typeId, item.amount);
        sellableSlots[uiSlot] = i;
        uiSlot++;
        if (uiSlot >= 45) break;
    }
    
    if (uiSlot === 0) form.button(22, "§c販売可能なアイテムがありません", ["§7対象: カスタム武器・素材など"], "minecraft:barrier");
    form.button(53, "§c戻る", [], "minecraft:barrier");

    form.show(player).then(res => {
        if (res.canceled || res.selection === 53) { openMarketMenu(player); return; }
        
        const invSlot = sellableSlots[res.selection];
        if (invSlot !== undefined) {
            const item = inventory.getItem(invSlot);
            if (item) openPriceInput(player, item, invSlot);
        }
    });
}

function openPriceInput(player, item, slot) {
    const form = new ModalFormData()
        .title("価格設定")
        .textField(`§a${item.nameTag || "アイテム"} (x${item.amount})\n§7販売価格を入力してください。`, "例: 1000");

    form.show(player).then(res => {
        if (res.canceled) { openSellMenu(player); return; }
        
        const price = parseInt(res.formValues[0]);
        if (isNaN(price) || price <= 0) {
            player.sendMessage("§c無効な価格です。");
            return;
        }

        const inventory = player.getComponent("inventory").container;
        const currentItem = inventory.getItem(slot);
        if (!currentItem) return;

        const result = MarketDataManager.addListing(player, currentItem, price);
        if (result.success) {
            inventory.setItem(slot, undefined);
            player.playSound("random.orb");
            player.sendMessage(result.message);
            openMarketMenu(player);
        } else {
            player.sendMessage(result.message);
        }
    });
}

// ★追加: 出品取り下げ確認画面
function confirmCancelListing(player, item, currentOptions) {
    const form = new MessageFormData()
        .title("出品取り下げ")
        .body(`§f商品: ${item.nameTag || "アイテム"}\n§7この出品を取り下げ、ポストに返却しますか？`)
        .button1("§c取り下げる")
        .button2("キャンセル");

    form.show(player).then(res => {
        if (res.canceled || res.selection !== 0) { openMarketMenu(player, currentOptions); return; }

        const result = MarketDataManager.cancelListing(player, item.id);
        if (result.success) {
            player.playSound("random.pop");
            player.sendMessage(result.message);
        } else {
            player.sendMessage(result.message);
        }
        openMarketMenu(player, currentOptions);
    });
}

function confirmPurchase(player, item, options) {
    const form = new MessageFormData()
        .title("購入確認")
        .body(`§f商品: ${item.nameTag || "アイテム"} x${item.amount}\n§e価格: ${item.price} G\n\n§7購入しますか？\n§8(商品はポストに送られます)`)
        .button1("§a購入する")
        .button2("キャンセル");

    form.show(player).then(res => {
        if (res.canceled || res.selection !== 0) { openMarketMenu(player, options); return; }

        const result = MarketDataManager.purchaseListing(player, item.id);
        if (result === "success") {
            player.playSound("random.levelup");
            player.sendMessage("§a購入完了！ ポストを確認してください。");
        } else if (result === "own_item") {
            // ここには来ないはずだが念のため
            player.sendMessage("§c自分の商品は購入できません。");
        } else if (result === "no_money") {
            player.sendMessage("§c所持金が足りません。");
        } else {
            player.sendMessage("§cエラー: すでに売り切れか削除されました。");
        }
        openMarketMenu(player, options);
    });
}

function openMailbox(player) {
    const key = `deepcraft:mailbox_${player.id}`;
    const json = world.getDynamicProperty(key);
    const mailbox = json ? JSON.parse(json) : [];

    const form = new ChestFormData("large", false);
    form.title(`§lポスト (${mailbox.length})`);

    if (mailbox.length === 0) {
        form.button(22, "§7ポストは空です", [], "minecraft:chest_minecart");
    } else {
        mailbox.forEach((mail, index) => {
            if (index >= 45) return; 

            if (mail.type === "gold" || mail.type === "sold") {
                form.button(index, "§e売上金", [`§7${mail.data.itemName || "アイテム"} が売れました。`, `§e+${mail.data.amount} G`, "§a[受け取る]"], "minecraft:gold_nugget");
            } else {
                const itemData = mail.data;
                let icon = itemData.typeId;
                if (itemData.properties && itemData.properties["deepcraft:item_id"]) {
                     const cid = itemData.properties["deepcraft:item_id"];
                     if (EQUIPMENT_POOL[cid]) icon = EQUIPMENT_POOL[cid].baseItem;
                }
                const title = mail.type === "expired" ? "§c期限切れ/返却" : "§a購入品";
                form.button(index, title, [`§f${itemData.nameTag}`, `§7x${itemData.amount}`, "§a[受け取る]"], icon);
            }
        });
    }
    
    form.button(53, "§c戻る", [], "minecraft:barrier");

    form.show(player).then(res => {
        if (res.canceled || res.selection === 53) { openMarketMenu(player); return; }
        
        const index = res.selection;
        if (mailbox[index]) {
            receiveMail(player, index, mailbox);
        }
    });
}

function receiveMail(player, index, mailbox) {
    const mail = mailbox[index];
    const key = `deepcraft:mailbox_${player.id}`;

    if (mail.type === "gold" || mail.type === "sold") {
        const currentGold = player.getDynamicProperty("deepcraft:gold") || 0;
        player.setDynamicProperty("deepcraft:gold", currentGold + mail.data.amount);
        player.playSound("random.orb");
        player.sendMessage(`§e${mail.data.amount} G を受け取りました。`);
        
        mailbox.splice(index, 1);
        world.setDynamicProperty(key, JSON.stringify(mailbox));
        openMailbox(player);

    } else {
        const container = player.getComponent("inventory").container;
        if (container.emptySlotsCount <= 0) {
            player.playSound("note.bass");
            player.sendMessage("§cインベントリがいっぱいです！");
            openMailbox(player);
            return;
        }

        const item = MarketDataManager.reconstructItemStack(mail.data);
        container.addItem(item);
        player.playSound("random.pop");
        player.sendMessage(`§a${item.nameTag} を受け取りました。`);

        mailbox.splice(index, 1);
        world.setDynamicProperty(key, JSON.stringify(mailbox));
        openMailbox(player);
    }
}

export function processCommandSell(player, price) {
    // コマンド売却は一旦無効化するか、手持ちアイテムがsellableかチェックする必要がある
    // 今回は簡略化のため「出品メニューを開く」に誘導する
    openMarketMenu(player);
    player.sendMessage("§e/sell コマンドは廃止されました。マーケットメニューから出品してください。");
}