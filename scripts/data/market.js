// BP/scripts/data/market.js
import { world, system, ItemStack } from "@minecraft/server";
import { ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { ChestFormData } from "../extensions/forms.js";
import { EQUIPMENT_POOL } from "./equipment.js";
import { decodeLoreData, encodeLoreData } from "../systems/lore_manager.js";
import { getItemId, getItemExtraData } from "../systems/lore_manager.js";

// --- 設定 ---
const MARKET_CONFIG = {
    TAX_RATE: 0.05,           
    EXPIRE_HOURS: 24,         
    MAX_LISTINGS_PER_PLAYER: 5, 
    ITEMS_PER_DATA_CHUNK: 50, 
    MAX_CHUNKS: 10            
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
        const id = getItemId(itemStack);
        const extras = getItemExtraData(itemStack);
        if (!id || !extras.sellable) {
            return { success: false, message: "§cそのアイテムはマーケットで販売できません。" };
        }

        const listings = this.getAllListings();
        const playerListings = listings.filter(l => l.ownerId === player.id);
        
        if (playerListings.length >= MARKET_CONFIG.MAX_LISTINGS_PER_PLAYER) {
            return { success: false, message: "§c出品数の上限に達しています。" };
        }

        const newItem = {
            id: Date.now().toString() + Math.floor(Math.random()*1000),
            ownerId: player.id,
            ownerName: player.name,
            typeId: itemStack.typeId, 
            customId: loreData.id,
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
        } else {
            item = new ItemStack(data.typeId, data.amount);
        }
        if (data.nameTag) item.nameTag = data.nameTag;
        if (data.lore) item.setLore(data.lore);
        return item;
    }
}

export function openMarketMenu(player, options = {}) {
    const { page = 0, searchKeyword = "" } = options;

    const form = new ChestFormData("double");
    form.title(searchKeyword ? `§lマーケット (検索: ${searchKeyword})` : "§lグローバルマーケット");
    
    form.button(3, searchKeyword ? "§c§l検索クリア" : "§b§l検索", [], "minecraft:spyglass");
    form.button(4, "§a§lアイテムを出品", ["§r§7インベントリから選択"], "minecraft:emerald");
    form.button(8, "§d§lポスト", [], "minecraft:chest_minecart");

    let listings = MarketDataManager.getAllListings();
    if (searchKeyword) {
        listings = listings.filter(l => 
            l.nameTag && l.nameTag.toLowerCase().includes(searchKeyword.toLowerCase())
        );
    }
    const itemsPerPage = 45;
    const playerListings = listings.filter(l => l.ownerId === player.id).length;
    form.button(5, `§7出品枠: ${MARKET_CONFIG.MAX_LISTINGS_PER_PLAYER - playerListings}/${MARKET_CONFIG.MAX_LISTINGS_PER_PLAYER}`, [], "minecraft:writable_book");

    const maxPage = Math.max(0, Math.ceil(listings.length / itemsPerPage) - 1);
    const currentPage = Math.max(0, Math.min(page, maxPage));

    form.button(1, `§8ページ ${currentPage + 1}/${maxPage + 1}`, [`§7全 ${listings.length} 件`], "minecraft:paper");

    if (page > 0) form.button(0, "§a<< 前のページ", [`§7ページ ${page}`], "minecraft:arrow");
    if (page < maxPage) form.button(2, "§a次のページ >>", [`§7ページ ${page + 2}/${maxPage + 1}`], "minecraft:arrow");

    const startIndex = currentPage * itemsPerPage;
    const itemsToShow = listings.slice(startIndex, startIndex + itemsPerPage);

    itemsToShow.forEach((item, index) => {
        let icon = item.typeId;
        if (item.customId && EQUIPMENT_POOL[item.customId]) {
            icon = EQUIPMENT_POOL[item.customId].baseItem; 
        }

        const slot = 9 + index;
        const desc = [
            `§e価格: ${item.price} G`,
            `§7出品者: ${item.ownerName}`,
            item.ownerId === player.id ? "§c[あなたの出品]" : "§a[クリックで購入]"
        ];
        if (item.lore && item.lore.length > 0) desc.push("§8----------------", ...item.lore);

        form.button(slot, `§f${item.nameTag || "Unknown Item"}`, desc, icon, item.amount);
    });

    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 0 && currentPage > 0) { openMarketMenu(player, { ...options, page: currentPage - 1 }); return; }
        if (res.selection === 2 && currentPage < maxPage) { openMarketMenu(player, { ...options, page: currentPage + 1 }); return; }
        if (res.selection === 3) {
            if (searchKeyword) openMarketMenu(player, {});
            else openMarketSearchByNameMenu(player, options);
            return;
        }
        if (res.selection === 4) { openSellItemSelection(player); return; }
        if (res.selection === 8) { openMailbox(player); return; }

        const selectedIndex = res.selection - 9;
        if (selectedIndex >= 0 && selectedIndex < itemsToShow.length) {
            confirmPurchase(player, itemsToShow[selectedIndex], options);
        }
    });
}

function openSellItemSelection(player) {
    const form = new ChestFormData("large");
    form.title("§l出品アイテムを選択");
    
    const inventory = player.getComponent("inventory").container;
    const sellableSlots = [];
    
    let uiSlot = 0;
    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (item) {
            const loreData = decodeLoreData(item);
            const isSellable = loreData && loreData.sellable;
            
            if (isSellable) {
                form.button(uiSlot, item.nameTag || "Item", [`§a[販売可能]`, `§7Slot: ${i}`], item.typeId, item.amount);
                sellableSlots[uiSlot] = i; 
                uiSlot++;
            }
        }
    }

    if (uiSlot === 0) {
        form.button(22, "§c販売可能なアイテムがありません", ["§7カスタムアイテムのみ販売可能です"], "minecraft:barrier");
    }
    
    form.button(53, "§c§l戻る", [], "minecraft:barrier");

    form.show(player).then(res => {
        if (res.canceled || res.selection === 53) { openMarketMenu(player); return; }
        
        const invSlot = sellableSlots[res.selection];
        if (invSlot !== undefined) {
            const item = inventory.getItem(invSlot);
            if (item) {
                openSellPriceInput(player, item, invSlot);
            }
        }
    });
}

function openSellPriceInput(player, item, invSlot) {
    const form = new ModalFormData()
        .title("価格設定")
        .textField(`§a${item.nameTag || "アイテム"} (x${item.amount})\n§7販売価格を入力してください (手数料 5%)`, "例: 1000");

    form.show(player).then(res => {
        if (res.canceled) { openSellItemSelection(player); return; }
        
        const price = parseInt(res.formValues[0]);
        if (isNaN(price) || price <= 0) {
            player.sendMessage("§c無効な価格です。");
            return;
        }

        const inventory = player.getComponent("inventory").container;
        const currentItem = inventory.getItem(invSlot);
        
        if (!currentItem) {
            player.sendMessage("§cアイテムが見つかりません。");
            return;
        }

        const result = MarketDataManager.addListing(player, currentItem, price);
        if (result.success) {
            inventory.setItem(invSlot, undefined);
            player.playSound("random.orb");
            player.sendMessage(result.message);
            openMarketMenu(player);
        } else {
            player.sendMessage(result.message);
        }
    });
}

export function processCommandSell(player, priceInput) {
    const price = parseInt(priceInput);
    if (isNaN(price) || price <= 0) {
        player.sendMessage("§cInvalid price. Usage: /sell <price>");
        return;
    }

    const equip = player.getComponent("equippable");
    const mainHandSlot = equip ? equip.getEquipmentSlot(EquipmentSlot.Mainhand) : undefined;
    const item = mainHandSlot ? mainHandSlot.getItem() : undefined;

    if (!item) {
        player.sendMessage("§cYou must hold an item to sell.");
        return;
    }

    const result = MarketDataManager.addListing(player, item, price);
    if (result.success) {
        mainHandSlot.setItem(undefined);
        player.playSound("random.orb");
        player.sendMessage(result.message);
    } else {
        player.sendMessage(result.message);
    }
}

function confirmPurchase(player, item, currentOptions) {
    const form = new MessageFormData()
        .title("購入確認")
        .body(`§f商品: ${item.nameTag || "アイテム"} x${item.amount}\n§e価格: ${item.price} G\n\n§7購入しますか？`)
        .button1("§a購入する")
        .button2("キャンセル");

    form.show(player).then(res => {
        if (res.canceled || res.selection !== 0) { 
            openMarketMenu(player, currentOptions); 
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
        }
        openMarketMenu(player, currentOptions);
    });
}

function openMarketSearchByNameMenu(player, currentOptions) {
    const form = new ModalFormData()
        .title("アイテム名で検索")
        .textField("検索したいアイテム名の一部を入力してください", "例: sword");

    form.show(player).then(res => {
        if (res.canceled) {
            openMarketMenu(player, currentOptions);
            return;
        }
        const keyword = res.formValues[0];
        openMarketMenu(player, { ...currentOptions, searchKeyword: keyword, page: 0 });
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