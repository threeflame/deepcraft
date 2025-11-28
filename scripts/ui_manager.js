// BP/scripts/ui/ui_manager.js
import { system } from "@minecraft/server";
import { ChestFormData } from "../extensions/forms.js";
import { CONFIG } from "../config.js";
import { CARD_POOL } from "../data/talents.js";
import { QUEST_POOL } from "../data/quests.js";
import { openMarketMenu } from "../data/market.js";
import { addXP, getXpCostForLevel, loadProfile, resetCurrentProfile, saveProfile, applyStatsToEntity } from "../player/player_manager.js";
import { calculateEntityStats } from "../player/stat_calculator.js";
import { claimQuestReward } from "../player/quest_manager.js";

export function openMenuHub(player) {
    const form = new ChestFormData("small");
    form.title("§lメニューハブ");
    const pendingDraws = player.getDynamicProperty("deepcraft:pending_card_draws") || 0;
    const gold = player.getDynamicProperty("deepcraft:gold") || 0;

    form.button(2, "§b§lタレント確認", ["§r§7所有タレントを見る"], "minecraft:enchanted_book");
    if (pendingDraws > 0) {
        form.button(4, "§6§l🎁 タレントを引く", ["§r§e未受取のタレントがあります！", "§cクリックで抽選"], "minecraft:nether_star", pendingDraws, 0, true);
    } else {
        form.button(4, "§a§lステータス強化", ["§r§7能力値を管理する"], "minecraft:experience_bottle");
    }
    form.button(6, `§d§lプロファイル`, ["§r§7ビルド切り替え"], "minecraft:name_tag");
    form.button(13, "§d§l📊 詳細ステータス", ["§r§7攻撃力・防御力などを確認"], "minecraft:spyglass");
    form.button(15, `§6§lマーケット (${gold} G)`, ["§r§eプレイヤー間取引所"], "minecraft:gold_ingot");
    form.button(20, "§6§lクエストログ", ["§r§7進行中のクエスト"], "minecraft:writable_book");
    form.button(26, "§c§lデバッグ: リセット", ["§r§cプロファイルをリセット"], "minecraft:barrier");

    form.show(player).then(res => {
        if (res.canceled) return;
        const actions = {
            2: () => openTalentViewer(player),
            4: () => pendingDraws > 0 ? openCardSelection(player) : openStatusMenu(player),
            6: () => openProfileMenu(player),
            13: () => openDetailStats(player),
            15: () => openMarketMenu(player),
            20: () => openQuestMenu(player),
            26: () => { resetCurrentProfile(player); openMenuHub(player); }
        };
        actions[res.selection]?.();
    });
}

function openDetailStats(player) {
    const stats = calculateEntityStats(player);
    const form = new ChestFormData("small");
    form.title("§lキャラクター詳細");

    const formatDesc = (title, details) => [`§7${title}`, "§8----------------", ...details];

    form.button(10, `§c§l攻撃力: ${stats.atk}`, formatDesc("物理攻撃力", stats.details.atk), "minecraft:iron_sword");
    form.button(11, `§b§l防御力: ${stats.def}`, formatDesc("ダメージ軽減量", stats.details.def), "minecraft:shield");
    form.button(12, `§e§l会心率: ${(stats.critChance * 100).toFixed(1)}%`, formatDesc("クリティカル率", stats.details.critChance), "minecraft:gold_nugget");
    form.button(13, `§6§l会心倍率: ${(stats.critMult * 100).toFixed(0)}%`, formatDesc("クリティカル倍率", stats.details.critMult), "minecraft:blaze_powder");
    form.button(14, `§3§lエーテル: ${stats.maxEther}`, formatDesc(`自然回復: ${stats.etherRegen.toFixed(1)}/秒`, [...stats.details.ether, ...stats.details.regen]), "minecraft:phantom_membrane");
    form.button(15, `§f§l速度: ${(stats.speed * 100).toFixed(0)}%`, formatDesc("移動速度", stats.details.speed), "minecraft:feather");
    form.button(16, `§a§l回避率: ${(stats.evasion * 100).toFixed(1)}%`, formatDesc("ダメージ無効化率", stats.details.evasion), "minecraft:sugar");

    form.button(26, "§c§l戻る", ["§rメニューへ戻る"], "minecraft:barrier");
    form.show(player).then(res => {
        if (!res.canceled && res.selection === 26) openMenuHub(player);
    });
}

function openProfileMenu(player) {
    const form = new ChestFormData("small");
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
    ];
    const slotToKeyMap = {};
    layout.forEach(item => {
        const val = player.getDynamicProperty(`deepcraft:${item.key}`) || 0;
        let lore = [`§r§7Lv: §f${val}`, `§r§e必要XP: ${getXpCostForLevel(level)}`, `§r§8(クリックで強化)`];
        if (val >= 100) lore = [`§r§a§l最大レベル (100)`];
        form.button(item.slot, `§l${CONFIG.STATS[item.key]}`, lore, item.icon, val);
        slotToKeyMap[item.slot] = item.key;
    });

    form.button(53, "§c§l戻る", ["§rメニューへ戻る"], "minecraft:barrier");
    form.show(player).then(res => {
        if (res.canceled || res.selection === 53) { openMenuHub(player); return; }
        const selectedKey = slotToKeyMap[res.selection];
        if (selectedKey) upgradeStat(player, selectedKey);
    });
}

function upgradeStat(player, statKey) {
    const invested = player.getDynamicProperty("deepcraft:invested_points") || 0;
    const level = player.getDynamicProperty("deepcraft:level") || 1;
    const currentXP = player.getDynamicProperty("deepcraft:xp") || 0;
    const cost = getXpCostForLevel(level);
    const currentVal = player.getDynamicProperty(`deepcraft:${statKey}`) || 0;

    if (currentVal >= 100) { player.sendMessage("§c既に最大レベルです！"); openStatusMenu(player); return; }
    if (currentXP < cost) { player.sendMessage(`§cXPが足りません！ 必要: ${cost}`); openStatusMenu(player); return; }

    player.setDynamicProperty("deepcraft:xp", currentXP - cost);
    player.setDynamicProperty(`deepcraft:${statKey}`, currentVal + 1);
    player.playSound("random.levelup");
    applyStatsToEntity(player);

    const nextInvested = invested + 1;
    if (nextInvested >= CONFIG.STAT_POINTS_PER_LEVEL) {
        player.setDynamicProperty("deepcraft:invested_points", 0);
        player.setDynamicProperty("deepcraft:level", level + 1);
        let pending = player.getDynamicProperty("deepcraft:pending_card_draws") || 0;
        player.setDynamicProperty("deepcraft:pending_card_draws", pending + 1);
        player.sendMessage(`§6§lレベルアップ！ §r(Lv.${level + 1})`);
        player.playSound("ui.toast.challenge_complete");
        system.runTimeout(() => openMenuHub(player), 20);
    } else {
        player.setDynamicProperty("deepcraft:invested_points", nextInvested);
        openStatusMenu(player);
    }
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