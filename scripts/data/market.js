// BP/scripts/data/market.js
import { world, system, ItemStack } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { ChestFormData } from "../extensions/forms.js";
import { EQUIPMENT_POOL } from "./equipment.js";

// --- 設定 ---
const MARKET_CONFIG = {
    TAX_RATE: 0.05,           // 手数料 5%
    EXPIRE_HOURS: 24,         // 掲載期間 24時間
    MAX_LISTINGS_PER_PLAYER: 5, // 1人あたりの最大出品数
    ITEMS_PER_DATA_CHUNK: 50, // 1つのプロパティに保存する最大件数 (32KB対策)
    MAX_CHUNKS: 10            // 最大プロパティ数 (50 * 10 = 500件まで)
};

// --- データ管理クラス (分割保存対応) ---
class MarketDataManager {
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
        // 期限切れチェックとソート（新しい順）
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
        // 全データを一旦削除（クリア）
        for (let i = 0; i < MARKET_CONFIG.MAX_CHUNKS; i++) {
            world.setDynamicProperty(`deepcraft:market_${i}`, undefined);
        }
        
        // チャンクに分割して保存
        for (let i = 0; i < listings.length; i += MARKET_CONFIG.ITEMS_PER_DATA_CHUNK) {
            const chunkIndex = Math.floor(i / MARKET_CONFIG.ITEMS_PER_DATA_CHUNK);
            if (chunkIndex >= MARKET_CONFIG.MAX_CHUNKS) break; // 上限
            
            const chunkData = listings.slice(i, i + MARKET_CONFIG.ITEMS_PER_DATA_CHUNK);
            world.setDynamicProperty(`deepcraft:market_${chunkIndex}`, JSON.stringify(chunkData));
        }
    }

    static addListing(player, itemStack, price) {
        const listings = this.getAllListings();
        const playerListings = listings.filter(l => l.ownerId === player.id);
        
        if (playerListings.length >= MARKET_CONFIG.MAX_LISTINGS_PER_PLAYER) {
            player.sendMessage("§c出品数の上限に達しています。");
            return false;
        }

        // カスタム装備IDがあれば記録
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

        listings.unshift(newItem); // 先頭に追加
        this.saveListings(listings);
        return true;
    }

    static purchaseListing(buyer, listingId) {
        const listings = this.getAllListings();
        const index = listings.findIndex(l => l.id === listingId);
        if (index === -1) return "sold_out";

        const item = listings[index];
        if (item.ownerId === buyer.id) return "own_item";

        // 支払い処理
        const buyerGold = buyer.getDynamicProperty("deepcraft:gold") || 0;
        if (buyerGold < item.price) return "no_money";

        // 決済
        buyer.setDynamicProperty("deepcraft:gold", buyerGold - item.price);
        
        // 売上金を出品者のポストへ (手数料を引く)
        const profit = Math.floor(item.price * (1.0 - MARKET_CONFIG.TAX_RATE));
        this.sendToMailbox(item.ownerId, { amount: profit }, "gold");

        // アイテムをバイヤーへ渡す
        const itemStack = this.reconstructItemStack(item);
        buyer.getComponent("inventory").container.addItem(itemStack);

        // リストから削除
        listings.splice(index, 1);
        this.saveListings(listings);
        return "success";
    }

    static sendToMailbox(playerId, data, type) {
        // 個人ごとのポストデータ (メールボックス)
        const key = `deepcraft:mailbox_${playerId}`;
        let mailbox = [];
        try {
            const json = world.getDynamicProperty(key);
            if (json) mailbox = JSON.parse(json);
        } catch (e) {}

        mailbox.push({ type: type, data: data, date: Date.now() });
        // 容量オーバー対策: 古いものから削除（簡易）
        if (JSON.stringify(mailbox).length > 30000) mailbox.shift();
        
        world.setDynamicProperty(key, JSON.stringify(mailbox));
    }

    static reconstructItemStack(data) {
        let item;
        // カスタム装備の復元
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

// --- UIロジック ---

export function openMarketMenu(player) {
    const form = new ChestFormData("double"); // 大容量チェスト
    form.title("§lグローバルマーケット");

    // ヘッダー
    const gold = player.getDynamicProperty("deepcraft:gold") || 0;
    form.button(4, `§e所持金: ${gold} G`, ["§7欲しいアイテムをクリックで購入"], "minecraft:gold_nugget");
    
    form.button(0, "§a§l出品する", ["§r§7インベントリから選択して出品"], "minecraft:emerald");
    form.button(8, "§d§lポスト / 売上受取", ["§r§7売上金や返却アイテムを確認"], "minecraft:chest_minecart");

    // 商品一覧 (最新45件を表示)
    const listings = MarketDataManager.getAllListings();
    const displayLimit = 45;
    
    listings.slice(0, displayLimit).forEach((item, index) => {
        // カスタム装備ならそのアイコン、なければバニラアイコン
        let icon = item.typeId;
        if (item.customId && EQUIPMENT_POOL[item.customId]) {
            // ※Chest-UIでアイコン指定が必要なら定義から取得するが、簡易的にベースアイテムを使用
            icon = EQUIPMENT_POOL[item.customId].baseItem; 
        }

        // スロットは 9 (2段目左) から開始
        const slot = 9 + index;
        const desc = [
            `§r§f${item.nameTag || "Unknown Item"} x${item.amount}`,
            `§e価格: ${item.price} G`,
            `§7出品者: ${item.ownerName}`,
            item.ownerId === player.id ? "§c[あなたの出品]" : "§a[クリックで購入]"
        ];
        // Loreを追加
        if (item.lore && item.lore.length > 0) desc.push("§8----------------", ...item.lore);

        form.button(slot, `§6${item.price} G`, desc, icon, item.amount);
    });

    form.show(player).then(res => {
        if (res.canceled) return;
        
        if (res.selection === 0) { openSellMenu(player); return; }
        if (res.selection === 8) { openMailbox(player); return; }

        // 商品クリック時の購入処理
        const selectedIndex = res.selection - 9;
        if (selectedIndex >= 0 && selectedIndex < listings.length) {
            const targetItem = listings[selectedIndex];
            confirmPurchase(player, targetItem);
        }
    });
}

// クリック出品メニュー (インベントリ表示)
function openSellMenu(player) {
    const form = new ChestFormData("small");
    form.title("§l出品: アイテムを選択");
    
    // 説明ボタン
    form.button(13, "§7アイテムを選択してください", ["§r下のインベントリから", "§r売りたい物をクリック"], "minecraft:paper");

    form.show(player).then(res => {
        if (res.canceled) return;
        
        // Chest-UIの仕様上、selection 27以降がインベントリスロットに対応
        // small(27)の場合、inventoryの0番目は27になるはず
        const invSlot = res.selection - 27;
        
        if (invSlot >= 0) {
            const container = player.getComponent("inventory").container;
            const item = container.getItem(invSlot);
            
            if (!item) {
                player.sendMessage("§c空のスロットです。");
                return;
            }
            
            // 価格入力フォームへ
            showPriceInput(player, item, invSlot);
        }
    });
}

function showPriceInput(player, item, slot) {
    const form = new ModalFormData()
        .title("出品価格の設定")
        .textField(`§a${item.nameTag || item.typeId} (x${item.amount})\n§7価格を入力してください (手数料 5%)`, "例: 1000")
        .submitButton("出品確定");

    form.show(player).then(res => {
        if (res.canceled) return;
        const priceStr = res.formValues[0];
        const price = parseInt(priceStr);

        if (isNaN(price) || price <= 0) {
            player.sendMessage("§c無効な価格です。");
            return;
        }

        // アイテム再確認と削除
        const container = player.getComponent("inventory").container;
        const currentItem = container.getItem(slot);
        
        // アイテムが変わっていないか簡易チェック
        if (!currentItem || currentItem.typeId !== item.typeId) {
            player.sendMessage("§cアイテムが存在しません。");
            return;
        }

        const success = MarketDataManager.addListing(player, currentItem, price);
        if (success) {
            container.setItem(slot, null); // インベントリから削除
            player.playSound("random.orb");
            player.sendMessage(`§a出品しました！ (§e${price} G§a)`);
        }
    });
}

function confirmPurchase(player, item) {
    if (item.ownerId === player.id) {
        // 自分のアイテムなら取り下げ処理にする？今回は簡易的に購入不可メッセージ
        player.sendMessage("§c自分の出品物は購入できません。");
        openMarketMenu(player);
        return;
    }

    const form = new ModalFormData()
        .title("購入確認")
        .content(`§f商品: ${item.nameTag || item.typeId} x${item.amount}\n§e価格: ${item.price} G\n\n§7購入しますか？`)
        .submitButton("§a購入する"); // キャンセルボタンはないが、閉じればキャンセル扱い

    form.show(player).then(res => {
        if (res.canceled) { openMarketMenu(player); return; }

        const result = MarketDataManager.purchaseListing(player, item.id);
        if (result === "success") {
            player.playSound("random.levelup");
            player.sendMessage("§a購入しました！");
        } else if (result === "sold_out") {
            player.playSound("note.bass");
            player.sendMessage("§c売り切れ、または存在しない商品です。");
        } else if (result === "no_money") {
            player.playSound("note.bass");
            player.sendMessage("§c所持金が足りません。");
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

    // 一括受取ロジック
    let totalGold = 0;
    let itemReceived = 0;
    const container = player.getComponent("inventory").container;
    const newMailbox = [];

    mailbox.forEach(mail => {
        if (mail.type === "gold") {
            totalGold += mail.data.amount;
        } else if (mail.type === "expired") {
            // アイテム返却
            const item = MarketDataManager.reconstructItemStack(mail.data);
            // インベントリに空きがあれば追加、なければポストに残す
            if (container.emptySlotsCount > 0) {
                container.addItem(item);
                itemReceived++;
            } else {
                newMailbox.push(mail); // 戻す
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