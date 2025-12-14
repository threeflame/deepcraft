// BP/scripts/ui/ui_manager.js
import { system, world } from "@minecraft/server";
import { ModalFormData, ActionFormData } from "@minecraft/server-ui";
import { ChestFormData } from "../extensions/forms.js";
import { CONFIG } from "../config.js";
import { CARD_POOL } from "../data/talents.js";
import { QUEST_POOL } from "../data/quests.js";
import { openMarketMenu } from "../data/market.js";
import { addXP, getXpCostForLevel, loadProfile, saveProfile, applyStatsToEntity } from "../player/player_manager.js";
import { calculateEntityStats } from "../player/stat_calculator.js";
import { claimQuestReward } from "../player/quest_manager.js"; 
import { createParty, acceptInvite, inviteToParty, leaveParty, getPartyInfo } from "../systems/party_manager.js";
import { burstParticles } from "../utils.js";
import { SKILL_POOL } from "../data/skills.js";

function getGrimoire(player) {
    const raw = player.getDynamicProperty("deepcraft:grimoire");
    if (typeof raw === "string" && raw.length > 0) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") return parsed;
        } catch (_) {}
    }
    const defaults = {
        "R-R-R": "spell:test_spell_01",
        "R-R-L": "spell:test_spell_02",
        "R-L-R": "spell:test_spell_03",
        "R-L-L": "spell:test_spell_04",
        "Shift+R-R-R": "spell:test_spell_05",
        "Shift+R-R-L": "spell:test_spell_06",
        "Shift+R-L-R": "spell:test_spell_07",
        "Shift+R-L-L": "spell:test_spell_08"
    };
    try { player.setDynamicProperty("deepcraft:grimoire", JSON.stringify(defaults)); } catch (_) {}
    return defaults;
}

function setGrimoire(player, grimoire) {
    try { player.setDynamicProperty("deepcraft:grimoire", JSON.stringify(grimoire ?? {})); } catch (_) {}
}

function normalizeActionId(actionId) {
    if (typeof actionId !== "string") return undefined;
    if (actionId.startsWith("spell:")) return actionId.slice("spell:".length);
    if (actionId.startsWith("skill:")) return actionId.slice("skill:".length);
    return actionId;
}

function actionDisplayName(actionId) {
    const normalized = normalizeActionId(actionId);
    if (!normalized) return "(未設定)";
    const skill = SKILL_POOL[normalized];
    if (!skill) return normalized;
    return skill.name ?? normalized;
}

function listComboBases() {
    return [
        "R-R-R",
        "R-R-L",
        "R-L-R",
        "R-L-L"
    ];
}

export function openMenuHub(player) {
    const form = new ChestFormData("small", false);
    form.title("§lメニューハブ");
    const pendingDraws = player.getDynamicProperty("deepcraft:pending_card_draws") || 0;
    const gold = player.getDynamicProperty("deepcraft:gold") || 0;

    // --- 1段目 (0-8): キャラクター関連 ---
    // タレント抽選がある場合はステータス強化を無効化
    if (pendingDraws > 0) {
        form.button(0, `§6§lタレント抽選 (${pendingDraws})`, ["§r§e未受取のタレントがあります", "§cクリックで抽選"], "textures/items/nether_star", pendingDraws, 0, true);
        form.button(2, "§8§lステータス強化", ["§r§cタレント抽選を先に行ってください"], "textures/items/experience_bottle");
    } else {
        form.button(2, "§a§lステータス強化", ["§r§7能力値を管理する"], "textures/items/experience_bottle");
    }
    
    form.button(4, "§d§l📊 詳細ステータス", ["§r§7攻撃力・防御力などを確認"], "textures/items/spyglass");
    form.button(6, "§b§lタレント確認", ["§r§7所有タレントを見る"], "textures/items/book_enchanted");

    // --- 2段目 (9-17): ワールド・ソーシャル ---
    // 中央揃え: 11, 13, 15
    form.button(11, "§6§lクエストログ", ["§r§7進行中のクエスト"], "textures/items/book_writable");
    form.button(13, `§6§lマーケット (${gold} G)`, ["§r§eプレイヤー間取引所"], "textures/items/gold_ingot");
    form.button(15, "§a§lパーティ", ["§r§7パーティの作成や招待"], "textures/items/totem");

    // --- 3段目 (18-26): システム ---
    // 中央: 22
    form.button(22, `§d§lプロファイル`, ["§r§7ビルド切り替え"], "textures/items/name_tag");

    // グリモワール設定
    form.button(20, "§5§lグリモワール設定", ["§r§7コンボに魔法を割り当てる", "§8通常/Shiftの両方を設定できます"], "textures/items/book_enchanted");

    form.show(player).then(res => {
        if (res.canceled) return;
        const pendingDrawsNow = player.getDynamicProperty("deepcraft:pending_card_draws") || 0;
        const actions = {
            // Row 1
            0: () => pendingDrawsNow > 0 ? openCardSelection(player) : openMenuHub(player), // タレント抽選
            2: () => {
                // タレント抽選がある場合はステータス強化をブロック
                if (pendingDrawsNow > 0) {
                    player.playSound("note.bass", { volume: 0.3 });
                    player.sendMessage("§8» §cタレント抽選を先に行ってください。");
                    openMenuHub(player);
                } else {
                    openStatusMenu(player);
                }
            },
            4: () => openDetailStats(player),
            6: () => openTalentViewer(player),
            
            // Row 2
            11: () => openQuestMenu(player),
            13: () => openMarketMenu(player, {}),
            15: () => openPartyMenu(player),
            
            // Row 3
            22: () => openProfileMenu(player),
            20: () => openGrimoireMenu(player)
        };
        actions[res.selection]?.();
    });
}

function openGrimoireMenu(player) {
    const grimoire = getGrimoire(player);

    const form = new ChestFormData("small", false);
    form.title("§lグリモワール");

    const combos = listComboBases();
    const normalSlots = [0, 1, 2, 3];
    const shiftSlots = [9, 10, 11, 12];

    for (let i = 0; i < combos.length; i++) {
        const base = combos[i];

        const normalKey = base;
        const normalAssigned = grimoire[normalKey];
        const normalDisplay = actionDisplayName(normalAssigned);
        form.button(normalSlots[i], `§d§l${base}`, [
            `§7現在: ${normalDisplay}`,
            "§eクリックで変更"
        ], "textures/items/book_writable");

        const shiftKey = `Shift+${base}`;
        const shiftAssigned = grimoire[shiftKey];
        const shiftDisplay = actionDisplayName(shiftAssigned);
        form.button(shiftSlots[i], `§e§lShift+${base}`, [
            `§7現在: ${shiftDisplay}`,
            "§eクリックで変更"
        ], "textures/items/book_writable");
    }

    form.button(26, "§c§l戻る", ["§rメニューハブへ戻る"], "textures/items/barrier");

    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 26) {
            system.runTimeout(() => openMenuHub(player), 10);
            return;
        }

        const idxNormal = normalSlots.indexOf(res.selection);
        if (idxNormal >= 0) {
            openGrimoireAssignMenu(player, combos[idxNormal]);
            return;
        }

        const idxShift = shiftSlots.indexOf(res.selection);
        if (idxShift >= 0) {
            openGrimoireAssignMenu(player, `Shift+${combos[idxShift]}`);
            return;
        }

        system.runTimeout(() => openGrimoireMenu(player), 10);
    });
}

function openGrimoireAssignMenu(player, key) {
    const grimoire = getGrimoire(player);
    const current = grimoire[key];
    const currentNorm = normalizeActionId(current);

    // 全スキルから所持しているものだけを表示
    const allSkillIds = Object.keys(SKILL_POOL);
    const ownedSpellIds = allSkillIds.filter(id => player.hasTag(`spell:${id}`));

    const form = new ChestFormData("large", false);
    form.title(key.startsWith("Shift+") ? "§lグリモワール設定 (Shift)" : "§lグリモワール設定");

    // ヘッダ情報
    form.button(4, `§d§l${key}`, [
        `§7現在: ${actionDisplayName(current)}`,
        ownedSpellIds.length ? `§7所持魔法: §b${ownedSpellIds.length}` : "§c所持している魔法がありません"
    ], "textures/items/book_enchanted");

    // 未設定
    form.button(8, "§7未設定にする", ["§8クリックで解除"], "textures/items/barrier");

    // 候補（10個）を並べる
    const slots = [
        9, 10, 11, 12, 13,
        18, 19, 20, 21, 22
    ];

    for (let i = 0; i < ownedSpellIds.length && i < slots.length; i++) {
        const id = ownedSpellIds[i];
        const name = SKILL_POOL[id]?.name ?? id;
        const isCurrent = currentNorm === id;
        form.button(slots[i], isCurrent ? `§a§l${name}` : `${name}`, [
            isCurrent ? "§a現在の割り当て" : "§eクリックで割り当て",
            `§8ID: ${id}`
        ], "textures/items/book_writable", 1, 0, isCurrent);
    }

    form.button(53, "§c§l戻る", ["§rグリモワールへ戻る"], "textures/items/barrier");

    form.show(player).then(res => {
        if (res.canceled) {
            system.runTimeout(() => openGrimoireMenu(player), 10);
            return;
        }

        if (res.selection === 53) {
            system.runTimeout(() => openGrimoireMenu(player), 10);
            return;
        }

        if (res.selection === 8) {
            delete grimoire[key];
            setGrimoire(player, grimoire);
            player.playSound("random.orb", { volume: 0.3, pitch: 0.8 });
            player.sendMessage(`§8» §7${key} を未設定にしました`);
            system.runTimeout(() => openGrimoireMenu(player), 10);
            return;
        }

        const idx = slots.indexOf(res.selection);
        if (idx < 0 || idx >= ownedSpellIds.length) {
            system.runTimeout(() => openGrimoireAssignMenu(player, key), 10);
            return;
        }

        const selectedSkillId = ownedSpellIds[idx];
        grimoire[key] = `spell:${selectedSkillId}`;
        setGrimoire(player, grimoire);
        player.playSound("random.orb", { volume: 0.35, pitch: 1.2 });
        player.sendMessage(`§8» §a${key} → ${SKILL_POOL[selectedSkillId]?.name ?? selectedSkillId}`);
        system.runTimeout(() => openGrimoireMenu(player), 10);
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
    
    // Void状態の判定
    const isVoid = player.hasTag("deepcraft:void");
    const deaths = player.getDynamicProperty("deepcraft:overworld_deaths") || 0;
    const maxDeaths = CONFIG.VOID_MAX_DEATHS;
    
    if (isVoid) {
        // Void状態
        form.button(22, `§4§lVOID状態`, [
            "§c§l⚠ 危険状態 ⚠",
            "§r次に死亡するとプロファイルがリセットされます",
            "§7Voidから脱出して生還せよ"
        ], "minecraft:wither_skeleton_skull");
    } else {
        // 通常状態
        let deathColor = "§a";
        if (deaths >= maxDeaths - 1) deathColor = "§c"; 
        else if (deaths > 0) deathColor = "§e"; 
        
        form.button(22, `§lライフ: ${deathColor}${maxDeaths - deaths} / ${maxDeaths}`, [
            "§r現在の死亡カウント",
            `§7${deaths}回 死亡済み`,
            `§c${maxDeaths}回でVoid転送`
        ], "minecraft:skeleton_skull");
    }

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
            player.playSound("random.orb", { volume: 0.35 });
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
        
        form.button(slotPositions[i], isCurrent ? `§a§lスロット ${i} (使用中)` : `§lスロット ${i}`, [desc, isCurrent ? "§a[現在のデータ]" : "§e[クリックでロード]"], isCurrent ? "textures/blocks/ender_chest_front" : "textures/blocks/chest_front", level);
    }
    form.button(26, "§c§l戻る", ["§rメニューへ戻る"], "textures/items/barrier");

    form.show(player).then(res => {
        if (res.canceled || res.selection === 26) { openMenuHub(player); return; }
        const targetSlot = Object.keys(slotPositions).find(key => slotPositions[key] === res.selection);
        if (targetSlot && parseInt(targetSlot) !== activeSlot) {
            saveProfile(player, activeSlot);
            loadProfile(player, parseInt(targetSlot));
            player.playSound("random.orb", { volume: 0.35 });
            player.sendMessage(`§8» §aプロファイル スロット${targetSlot} をロードしました。`);
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
        { key: "strength", slot: 1, icon: "textures/items/netherite_sword" }, { key: "fortitude", slot: 3, icon: "textures/items/apple_golden" },
        { key: "agility", slot: 5, icon: "textures/items/sugar" }, { key: "defense", slot: 7, icon: "textures/items/shield" },
        { key: "intelligence", slot: 11, icon: "textures/items/book_enchanted" }, { key: "willpower", slot: 13, icon: "textures/blocks/beacon" },
        { key: "charisma", slot: 15, icon: "textures/items/diamond" },
        { key: "flame", slot: 28, icon: "textures/items/fire_charge" }, { key: "frost", slot: 30, icon: "textures/items/snowball" },
        { key: "gale", slot: 32, icon: "textures/items/elytra" }, { key: "thunder", slot: 34, icon: "textures/items/lightning_rod" },
        { key: "heavy", slot: 47, icon: "textures/blocks/anvil_top" }, { key: "medium", slot: 49, icon: "textures/items/iron_chestplate" },
        { key: "light", slot: 51, icon: "textures/items/bow_standby" }
    ];

    const slotToKeyMap = {};
    layout.forEach(item => {
        const val = player.getDynamicProperty(`deepcraft:${item.key}`) || 0;
        let lore = [`§r§7Lv: §f${val}`, `§r§eCost: ${getXpCostForLevel(level)}`, `§r§8[クリックで強化]`, `§r§a[SHIFT+クリック]で一括(未実装)`];
        if (val >= 100) lore = [`§r§a§lMAX (100)`];
        form.button(item.slot, `§l${CONFIG.STATS[item.key]}`, lore, item.icon, val);
        slotToKeyMap[item.slot] = item.key;
    });

    form.button(53, "§c§l戻る", ["§rメニューへ戻る"], "textures/items/barrier");
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
             if (successCount === 0) player.sendMessage("§8» §c最大レベル(20)に到達しています！");
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
            if (successCount === 0) player.sendMessage("§8» §cこれ以上強化できません！");
            break;
        }
        if (currentXP < cost) {
            if (successCount === 0) player.sendMessage(`§8» §cXPが足りません！ 必要: ${cost}`);
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
        player.playSound("random.levelup", { volume: 0.4 });
        player.sendMessage(`§8» §a${CONFIG.STATS[statKey]} を +${successCount} 強化しました。`);
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
    player.sendMessage(`§8» §6[LEVEL UP] Lv.${currentLvl + 1} になりました！`);
    player.playSound("ui.toast.challenge_complete", { volume: 0.4 });

    // レベルアップ時だけ、控えめに見える粒子
    burstParticles(player, [
        "minecraft:totem_particle",
        "minecraft:villager_happy",
    ], { count: 8, yOffset: 1.1, spread: 1.2 });

    system.runTimeout(() => openMenuHub(player), 20);
}

function openTalentViewer(player) {
    const form = new ChestFormData("large");
    form.title("§l習得済みタレント");
    let slot = 0;
    const tags = player.getTags();
    CARD_POOL.forEach(card => {
        if (tags.includes(`talent:${card.id}`)) {
            form.button(slot++, card.name, [card.description, `§o${card.rarity}`], "textures/items/book_enchanted");
        }
    });
    if (slot === 0) form.button(22, "§7タレントなし", [], "textures/items/barrier");
    form.button(53, "§c§l戻る", [], "textures/items/barrier");
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
        form.button(slot, def.name, [def.description, statusText, clickText], "textures/items/book_writable", 1, 0, isGlint);
        questIds[slot] = qId;
        slot++;
    });

    if (slot === 0) form.button(22, "§7進行中のクエストなし", [], "textures/items/barrier");
    form.button(53, "§c§l戻る", [], "textures/items/barrier");
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
        if (response.canceled) { player.sendMessage("§8» §cタレントを選択してください。"); openMenuHub(player); return; }
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
    player.sendMessage(`§8» §aタレント獲得: ${card.name}`);

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