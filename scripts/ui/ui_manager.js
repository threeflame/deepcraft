// BP/scripts/ui/ui_manager.js
import { system, world } from "@minecraft/server";
import { ModalFormData, ActionFormData } from "@minecraft/server-ui";
import { ChestFormData } from "../extensions/forms.js";
import { CONFIG } from "../config.js";
import { CARD_POOL } from "../data/talents.js";
import { QUEST_POOL } from "../data/quests.js";
import { openMarketMenu } from "../data/market.js";
import { addXP, getXpCostForLevel, loadProfile, resetCurrentProfile, saveProfile, applyStatsToEntity } from "../player/player_manager.js";
import { calculateEntityStats } from "../player/stat_calculator.js";
import { claimQuestReward } from "../player/quest_manager.js"; 
import { createParty, acceptInvite, inviteToParty, leaveParty, getPartyInfo } from "../systems/party_manager.js";
import { openDebugGiveMenu, openDebugSummonMenu } from "../systems/debug_menu.js";

export function openMenuHub(player) {
    const form = new ChestFormData("small", false);
    form.title("§lメニューハブ");
    const pendingDraws = player.getDynamicProperty("deepcraft:pending_card_draws") || 0;
    const gold = player.getDynamicProperty("deepcraft:gold") || 0;

    // --- 1段目 (0-8): キャラクター関連 ---
    // 中央揃え: 2, 4, 6
    if (pendingDraws > 0) {
        // 絵文字削除
        form.button(4, `§6§l[DRAW TALENT] (${pendingDraws})`, ["§r§e未受取のタレントがあります", "§cクリックで抽選"], "minecraft:nether_star", pendingDraws, 0, true);
    } else {
        form.button(2, "§a§lステータス強化", ["§r§7能力値を管理する"], "minecraft:experience_bottle");
    }
    form.button(4, "§d§l📊 詳細ステータス", ["§r§7攻撃力・防御力などを確認"], "minecraft:spyglass");
    form.button(6, "§b§lタレント確認", ["§r§7所有タレントを見る"], "minecraft:enchanted_book");

    // デバッグ: XP (右上)
    form.button(8, "§e§lデバッグ: +XP", ["§r+10000XP"], "minecraft:emerald");


    // --- 2段目 (9-17): ワールド・ソーシャル ---
    // 中央揃え: 11, 13, 15
    form.button(11, "§6§lクエストログ", ["§r§7進行中のクエスト"], "minecraft:writable_book");
    form.button(13, `§6§lマーケット (${gold} G)`, ["§r§eプレイヤー間取引所"], "minecraft:gold_ingot");
    form.button(15, "§a§lパーティ", ["§r§7パーティの作成や招待"], "minecraft:totem_of_undying");

    // デバッグ: Gold (右中)
    form.button(17, "§e§lデバッグ: +1000 G", ["§r資金を追加"], "minecraft:sunflower");


    // --- 3段目 (18-26): システム ---
    // 中央: 22
    form.button(22, `§d§lプロファイル`, ["§r§7ビルド切り替え"], "minecraft:name_tag");

    // ★追加: デバッグ機能 (管理者のみ表示する制御も可能だが今回は全員表示)
    form.button(24, "§c§lデバッグ: アイテム入手", ["§r§7カスタム装備を入手"], "minecraft:chest");
    form.button(25, "§4§lデバッグ: Mob召喚", ["§r§7ボスやダミーを召喚"], "minecraft:spawner");
    
    // デバッグ: リセット (右下)
    form.button(26, "§c§lデバッグ: リセット", ["§r§cプロファイルをリセット"], "minecraft:barrier");

    form.show(player).then(res => {
        if (res.canceled) return;
        const actions = {
            // Row 1
            2: () => pendingDraws > 0 ? openCardSelection(player) : openStatusMenu(player),
            4: () => openDetailStats(player),
            6: () => openTalentViewer(player),
            
            // Row 2
            11: () => openQuestMenu(player),
            13: () => openMarketMenu(player, {}),
            15: () => openPartyMenu(player),
            
            // Row 3
            22: () => openProfileMenu(player),

            // Debug Column
            8: () => { addXP(player, 10000); openMenuHub(player); },
            17: () => {
                const current = player.getDynamicProperty("deepcraft:gold") || 0;
                player.setDynamicProperty("deepcraft:gold", current + 1000);
                player.playSound("random.orb");
                openMenuHub(player);
            },
            24: () => openDebugGiveMenu(player),   // ★追加
            25: () => openDebugSummonMenu(player), // ★追加
            26: () => { resetCurrentProfile(player); openMenuHub(player); }
        };
        actions[res.selection]?.();
    });
}

function openDetailStats(player) {
    const stats = calculateEntityStats(player);
    const form = new ChestFormData("small", false);
    form.title("§lキャラクター詳細");

    const formatDesc = (title, details) => [`§7${title}`, "§8----------------", ...details, "§8----------------", "§e[クリックでチャットに出力]"];

    // ダメージ計算の例
    const damageTakenExample = Math.floor(100 * (100 / (100 + stats.def)));
    const damageDealtExample = Math.floor(stats.atk * (100 / (100 + 100)));

    form.button(1, `§4§l最大HP: ${stats.maxHP}`, formatDesc("最大体力", stats.details.hp), "minecraft:golden_apple");
    form.button(10, `§c§l攻撃力: ${stats.atk}`, formatDesc("物理攻撃力", stats.details.atk), "minecraft:iron_sword");
    form.button(11, `§b§l防御力: ${stats.def}`, formatDesc("ダメージ軽減率", stats.details.def), "minecraft:shield");
    form.button(12, `§e§l会心率: ${(stats.critChance * 100).toFixed(1)}%`, formatDesc("クリティカル率", stats.details.critChance), "minecraft:gold_nugget");
    form.button(13, `§6§l会心倍率: ${(stats.critMult * 100).toFixed(0)}%`, formatDesc("クリティカル倍率", stats.details.critMult), "minecraft:blaze_powder");
    
    form.button(19, `§c与ダメージ例: ${damageDealtExample}`, ["§7防御力100の敵に与えるダメージ", "§8(計算結果のみ)"], "minecraft:target");
    form.button(20, `§b被ダメージ例: ${damageTakenExample}`, ["§7攻撃力100の敵から受けるダメージ", "§8(計算結果のみ)"], "minecraft:creeper_head");
    
    form.button(14, `§3§lエーテル: ${stats.maxEther}`, formatDesc(`自然回復: ${stats.etherRegen.toFixed(1)}/秒`, [...stats.details.ether, ...stats.details.regen]), "minecraft:phantom_membrane");
    form.button(15, `§f§l速度: ${(stats.speed * 100).toFixed(0)}%`, formatDesc("移動速度", stats.details.speed), "minecraft:feather");
    form.button(16, `§a§l回避率: ${(stats.evasion * 100).toFixed(1)}%`, formatDesc("ダメージ無効化率", stats.details.evasion), "minecraft:sugar");
    const deaths = player.getDynamicProperty("deepcraft:death_count") || 0;
    const maxDeaths = CONFIG.MAX_DEATH_COUNT;
    let deathColor = "§a";
    if (deaths >= maxDeaths - 1) deathColor = "§c"; 
    else if (deaths > 0) deathColor = "§e"; 

    form.button(22, `§lLives: ${deathColor}${maxDeaths - deaths} / ${maxDeaths}`, ["§r現在の死亡カウント", `§7${deaths}回 死亡済み`, "§c3回でVoid行き"], "minecraft:skeleton_skull");

    form.button(25, "§c§l戻る", ["§rメニューへ戻る"], "minecraft:barrier");
    
    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 25) { openMenuHub(player); return; }

        const statMap = {
            1: { name: "最大HP", total: stats.maxHP, data: stats.details.hp },
            10: { name: "攻撃力", total: stats.atk, data: stats.details.atk },
            11: { name: "防御力", total: stats.def, data: stats.details.def },
            12: { name: "会心率", total: `${(stats.critChance * 100).toFixed(1)}%`, data: stats.details.critChance },
            13: { name: "会心倍率", total: `${(stats.critMult * 100).toFixed(0)}%`, data: stats.details.critMult },
            14: { name: "エーテル", total: stats.maxEther, data: [...stats.details.ether, ...stats.details.regen] },
            15: { name: "移動速度", total: `${(stats.speed * 100).toFixed(0)}%`, data: stats.details.speed },
            16: { name: "回避率", total: `${(stats.evasion * 100).toFixed(1)}%`, data: stats.details.evasion }
        };

        const target = statMap[res.selection];
        if (target) {
            player.sendMessage(`§l§a--- ${target.name} の詳細内訳 (合計: ${target.total}) ---§r`);
            if (target.data && target.data.length > 0) {
                target.data.forEach(line => player.sendMessage(line));
            } else {
                player.sendMessage("§7補正なし（基礎値のみ）");
            }
            player.playSound("random.orb");
            openDetailStats(player); 
        } else {
            openDetailStats(player);
        }
    });
}

function openProfileMenu(player) {
    const form = new ChestFormData("small", false);
    form.title("§lプロファイル管理");
    const activeSlot = player.getDynamicProperty("deepcraft:active_profile") || 1;
    const slotPositions = { 1: 11, 2: 13, 3: 15 };

    for (let i = 1; i <= CONFIG.MAX_PROFILES; i++) {
        const isCurrent = (i === activeSlot);
        const slotJson = player.getDynamicProperty(`deepcraft:profile_${i}`);
        let desc = "§7空 / 初期状態", level = 1;
        if (slotJson) { try { const data = JSON.parse(slotJson); level = data.level || 1; desc = `§7Lv: ${level}, タレント: ${data.talents.length}`; } catch (e) { } }
        
        form.button(slotPositions[i], isCurrent ? `§a§lスロット ${i} (使用中)` : `§lスロット ${i}`, [desc, isCurrent ? "§a[現在のデータ]" : "§e[クリックでロード]"], isCurrent ? "minecraft:ender_chest" : "minecraft:chest", level);
    }
    form.button(26, "§c§l戻る", ["§rメニューへ戻る"], "minecraft:barrier");

    form.show(player).then(res => {
        if (res.canceled || res.selection === 26) { openMenuHub(player); return; }
        const targetSlot = Object.keys(slotPositions).find(key => slotPositions[key] === res.selection);
        if (targetSlot && parseInt(targetSlot) !== activeSlot) {
            saveProfile(player, activeSlot);
            loadProfile(player, parseInt(targetSlot));
            player.playSound("random.orb");
            player.sendMessage(`§aプロファイル スロット${targetSlot} をロードしました。`);
        }
        openMenuHub(player);
    });
}

function openStatusMenu(player) {
    const form = new ChestFormData("large");
    const level = player.getDynamicProperty("deepcraft:level") || 1;
    const invested = player.getDynamicProperty("deepcraft:invested_points") || 0;
    const remaining = CONFIG.STAT_POINTS_PER_LEVEL - invested;
    form.title(`§lステータス | LvUpまで: ${remaining}pt`);

    const layout = [
        { key: "strength", slot: 1, icon: "minecraft:netherite_sword" }, { key: "fortitude", slot: 3, icon: "minecraft:golden_apple" },
        { key: "agility", slot: 5, icon: "minecraft:sugar" }, { key: "defense", slot: 7, icon: "minecraft:shield" },
        { key: "intelligence", slot: 11, icon: "minecraft:enchanted_book" }, { key: "willpower", slot: 13, icon: "minecraft:beacon" },
        { key: "charisma", slot: 15, icon: "minecraft:diamond" },
        { key: "flame", slot: 28, icon: "minecraft:fire_charge" }, { key: "frost", slot: 30, icon: "minecraft:snowball" },
        { key: "gale", slot: 32, icon: "minecraft:elytra" }, { key: "thunder", slot: 34, icon: "minecraft:lightning_rod" },
        { key: "heavy", slot: 47, icon: "minecraft:anvil" }, { key: "medium", slot: 49, icon: "minecraft:iron_chestplate" },
        { key: "light", slot: 51, icon: "minecraft:bow" }
    ];

    const slotToKeyMap = {};
    layout.forEach(item => {
        const val = player.getDynamicProperty(`deepcraft:${item.key}`) || 0;
        let lore = [`§r§7Lv: §f${val}`, `§r§eCost: ${getXpCostForLevel(level)}`, `§r§8[クリックで強化]`, `§r§a[SHIFT+クリック]で一括(未実装)`];
        if (val >= 100) lore = [`§r§a§lMAX (100)`];
        form.button(item.slot, `§l${CONFIG.STATS[item.key]}`, lore, item.icon, val);
        slotToKeyMap[item.slot] = item.key;
    });

    form.button(53, "§c§l戻る", ["§rメニューへ戻る"], "minecraft:barrier");
    form.show(player).then(res => {
        if (res.canceled || res.selection === 53) { openMenuHub(player); return; }
        const selectedKey = slotToKeyMap[res.selection];
        if (selectedKey) {
            // 直接アップグレードせず、数量選択メニューを開く
            openStatUpgradeSubMenu(player, selectedKey);
        }
    });
}

function openStatUpgradeSubMenu(player, statKey) {
    const form = new ActionFormData()
        .title(`${CONFIG.STATS[statKey]} の強化`)
        .body("強化するポイント数を選択してください。")
        .button("§l+1 ポイント")
        .button("§l+5 ポイント")
        .button("§l+10 ポイント")
        .button("§c戻る");

    form.show(player).then(res => {
        if (res.canceled || res.selection === 3) { openStatusMenu(player); return; }
        
        let amount = 1;
        if (res.selection === 1) amount = 5;
        if (res.selection === 2) amount = 10;

        upgradeStat(player, statKey, amount);
    });
}

function upgradeStat(player, statKey, amount = 1) {
    let loopCount = 0;
    let successCount = 0;

    // 指定回数分ループして強化を試みる (一括処理)
    while (loopCount < amount) {
        const invested = player.getDynamicProperty("deepcraft:invested_points") || 0;

        const level = player.getDynamicProperty("deepcraft:level") || 1;
        if (level >= 20) { // 20でストップ
             if (successCount === 0) player.sendMessage("§c最大レベル(20)に到達しています！");
             break;
        }
        
        // レベルアップ直前なら、強制的に1回だけで止めてレベルアップ処理へ回す
        if (invested >= CONFIG.STAT_POINTS_PER_LEVEL) {
            processLevelUp(player);
            return; // ループを抜けて終了
        }

        const currentXP = player.getDynamicProperty("deepcraft:xp") || 0;
        const cost = getXpCostForLevel(level);
        const currentVal = player.getDynamicProperty(`deepcraft:${statKey}`) || 0;

        if (currentVal >= 100) {
            if (successCount === 0) player.sendMessage("§cこれ以上強化できません！");
            break;
        }
        if (currentXP < cost) {
            if (successCount === 0) player.sendMessage(`§cXPが足りません！ 必要: ${cost}`);
            break;
        }

        // コスト支払いと強化
        player.setDynamicProperty("deepcraft:xp", currentXP - cost);
        player.setDynamicProperty(`deepcraft:${statKey}`, currentVal + 1);
        player.setDynamicProperty("deepcraft:invested_points", invested + 1);
        
        successCount++;
        loopCount++;
    }

    if (successCount > 0) {
        player.playSound("random.levelup");
        player.sendMessage(`§a${CONFIG.STATS[statKey]} を +${successCount} 強化しました。`);
        applyStatsToEntity(player);
        
        // 強化後にレベルアップ条件を満たしているかチェック
        const finalInvested = player.getDynamicProperty("deepcraft:invested_points") || 0;
        if (finalInvested >= CONFIG.STAT_POINTS_PER_LEVEL) {
            processLevelUp(player);
        } else {
            // 続けてステータス画面を開く
            system.runTimeout(() => openStatusMenu(player), 10);
        }
    } else {
        system.runTimeout(() => openStatusMenu(player), 10);
    }
}

function processLevelUp(player) {
    const currentLvl = player.getDynamicProperty("deepcraft:level");
    player.setDynamicProperty("deepcraft:level", currentLvl + 1);
    player.setDynamicProperty("deepcraft:invested_points", 0);
    let pending = player.getDynamicProperty("deepcraft:pending_card_draws") || 0;
    player.setDynamicProperty("deepcraft:pending_card_draws", pending + 3);
    player.sendMessage(`§6[LEVEL UP] Lv.${currentLvl + 1} になりました！`);
    player.playSound("ui.toast.challenge_complete");
    system.runTimeout(() => openMenuHub(player), 20);
}

function openTalentViewer(player) {
    const form = new ChestFormData("large");
    form.title("§l習得済みタレント");
    let slot = 0;
    const tags = player.getTags();
    CARD_POOL.forEach(card => {
        if (tags.includes(`talent:${card.id}`)) {
            form.button(slot++, card.name, [card.description, `§o${card.rarity}`], "minecraft:enchanted_book");
        }
    });
    if (slot === 0) form.button(22, "§7タレントなし", [], "minecraft:barrier");
    form.button(53, "§c§l戻る", [], "minecraft:barrier");
    form.show(player).then(res => { if (!res.canceled && res.selection === 53) openMenuHub(player); });
}

export function openQuestMenu(player) {
    const form = new ChestFormData("large");
    form.title("§lクエストログ");
    const questData = JSON.parse(player.getDynamicProperty("deepcraft:quest_data") || "{}");
    let slot = 0;
    const questIds = [];
    const sortedKeys = Object.keys(questData).sort((a, b) => {
        const order = { "completed": 0, "active": 1, "claimed": 2 };
        return (order[questData[a].status] ?? 99) - (order[questData[b].status] ?? 99);
    });

    sortedKeys.forEach(qId => {
        const userQuest = questData[qId];
        const def = QUEST_POOL[qId];
        if (!def) return;
        let statusText = "", clickText = "", isGlint = false;
        if (userQuest.status === "active") { statusText = `§7進行度: §f${userQuest.progress}/${def.amount}`; }
        else if (userQuest.status === "completed") { statusText = "§a§l完了！"; clickText = "§e[報酬を受け取る]"; isGlint = true; }
        else if (userQuest.status === "claimed") { statusText = "§8(報酬受取済み)"; }
        form.button(slot, def.name, [def.description, statusText, clickText], "minecraft:writable_book", 1, 0, isGlint);
        questIds[slot] = qId;
        slot++;
    });

    if (slot === 0) form.button(22, "§7進行中のクエストなし", [], "minecraft:barrier");
    form.button(53, "§c§l戻る", [], "minecraft:barrier");
    form.show(player).then(res => {
        if (res.canceled || res.selection === 53) { openMenuHub(player); return; }
        const qId = questIds[res.selection];
        if (qId && questData[qId]?.status === "completed") {
            claimQuestReward(player, qId);
        }
    });
}

function openCardSelection(player) {
    const form = new ChestFormData("small");
    form.title("§lタレント選択");

    let selectionIds = [];
    const tempJson = player.getDynamicProperty("deepcraft:temp_talent_roll");
    if (tempJson) { try { selectionIds = JSON.parse(tempJson); } catch (e) { } }

    if (!selectionIds || selectionIds.length === 0) {
        const availableCards = CARD_POOL.filter(card => !player.hasTag(`talent:${card.id}`) && card.condition(player));
        selectionIds = availableCards.sort(() => 0.5 - Math.random()).slice(0, 3).map(c => c.id);
        if (selectionIds.length === 0) selectionIds.push("basic_training");
        player.setDynamicProperty("deepcraft:temp_talent_roll", JSON.stringify(selectionIds));
    }

    const positions = [11, 13, 15];
    selectionIds.forEach((cardId, index) => {
        const card = CARD_POOL.find(c => c.id === cardId);
        if (card) form.button(positions[index], card.name, [card.description, `§o${card.rarity.toUpperCase()}`], "minecraft:enchanted_book", 1, 0, true);
    });

    form.show(player).then((response) => {
        if (response.canceled) { player.sendMessage("§cタレントを選択してください。"); openMenuHub(player); return; }
        const idx = positions.indexOf(response.selection);
        if (idx !== -1 && selectionIds[idx]) {
            const card = CARD_POOL.find(c => c.id === selectionIds[idx]);
            if (card) applyCardEffect(player, card);
        }
    });
}

function applyCardEffect(player, card) {
    let pending = player.getDynamicProperty("deepcraft:pending_card_draws") || 0;
    if (pending > 0) player.setDynamicProperty("deepcraft:pending_card_draws", pending - 1);
    player.setDynamicProperty("deepcraft:temp_talent_roll", undefined);
    player.sendMessage(`§aタレント獲得: ${card.name}`);

    if (card.id !== "basic_training") player.addTag(`talent:${card.id}`);
    if (card.type === "xp") addXP(player, card.value);
    
    saveProfile(player, player.getDynamicProperty("deepcraft:active_profile") || 1);
    system.runTimeout(() => openMenuHub(player), 10);
}

function openPartyMenu(player) {
    const form = new ChestFormData("small");
    form.title("§lパーティ管理");

    const partyInfo = getPartyInfo(player);

    if (partyInfo) {
        const leader = world.getEntity(partyInfo.leader);
        form.button(1, "§eパーティ情報", [`§7リーダー: ${leader?.name || "不明"}`, `§7メンバー数: ${partyInfo.members.length}人`], "minecraft:book");
        form.button(3, "§bメンバー一覧", ["§7現在のパーティメンバーを確認"], "minecraft:spyglass");
        
        if (partyInfo.leader === player.id) {
            form.button(5, "§aメンバーを招待", ["§7他のプレイヤーをパーティに招待"], "minecraft:writable_book");
        }

        form.button(8, "§cパーティから離脱", ["§7現在のパーティから抜けます"], "minecraft:barrier");

    } else {
        form.button(3, "§aパーティを作成", ["§7新しいパーティを結成します"], "minecraft:banner");
        form.button(5, "§b招待を受ける", ["§7届いているパーティの招待を承諾"], "minecraft:paper");
    }

    form.button(26, "§c§l戻る", ["§rメニューへ戻る"], "minecraft:barrier");

    form.show(player).then(res => {
        if (res.canceled || res.selection === 26) {
            openMenuHub(player);
            return;
        }

        if (partyInfo) {
            if (res.selection === 3) openPartyMembersMenu(player, partyInfo);
            if (res.selection === 5 && partyInfo.leader === player.id) openPartyInviteMenu(player);
            if (res.selection === 8) {
                leaveParty(player);
                system.runTimeout(() => openPartyMenu(player), 10);
            }
        } else {
            if (res.selection === 3) {
                createParty(player);
                system.runTimeout(() => openPartyMenu(player), 10);
            }
            if (res.selection === 5) {
                acceptInvite(player);
                system.runTimeout(() => openPartyMenu(player), 10);
            }
        }
    });
}

function openPartyInviteMenu(player) {
    const form = new ModalFormData()
        .title("パーティ招待")
        .textField("招待するプレイヤーの名前を入力してください", "プレイヤー名");

    form.show(player).then(res => {
        if (res.canceled) { openPartyMenu(player); return; }
        const targetName = res.formValues[0];
        if (targetName) inviteToParty(player, targetName);
        system.runTimeout(() => openPartyMenu(player), 10);
    });
}

function openPartyMembersMenu(player, partyInfo) {
    const form = new ChestFormData("small");
    form.title("§lパーティメンバー");

    partyInfo.members.forEach((memberId, index) => {
        const member = world.getEntity(memberId);
        const isLeader = memberId === partyInfo.leader;
        form.button(index, `${isLeader ? "§e👑 " : ""}${member?.name || "不明なメンバー"}`, [], "minecraft:player_head");
    });

    form.button(26, "§c§l戻る", ["§rパーティ管理へ戻る"], "minecraft:barrier");
    form.show(player).then(res => { if (!res.canceled || res.selection === 26) openPartyMenu(player); });
}