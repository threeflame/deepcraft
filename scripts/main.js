// BP/scripts/main.js
import { world, system, ItemStack, EquipmentSlot } from "@minecraft/server";
import { ChestFormData } from "./extensions/forms.js";

// Data Imports
import { CONFIG } from "./config.js";
import { CARD_POOL } from "./data/talents.js";
import { QUEST_POOL } from "./data/quests.js";
import { EQUIPMENT_POOL } from "./data/equipment.js";
import { SKILL_POOL } from "./data/skills.js";
import { MOB_POOL } from "./data/mobs.js";

// --- Initialization ---

// ★キャッシュ変数の定義 (Global Scope)
const playerStateCache = new Map();

world.afterEvents.playerSpawn.subscribe((ev) => {
    const player = ev.player;
    if (!player.getDynamicProperty("deepcraft:active_profile")) {
        initializePlayer(player);
    }
});

// 退出時にキャッシュを消す処理
world.afterEvents.playerLeave.subscribe((ev) => {
    if (playerStateCache.has(ev.playerId)) {
        playerStateCache.delete(ev.playerId);
    }
});

function initializePlayer(player) {
    player.setDynamicProperty("deepcraft:active_profile", 1);
    loadProfile(player, 1);
    player.sendMessage("§aDeepCraft System Initialized.");
}

// --- System Loop (Main Cycle) ---

system.runInterval(() => {
    // 1. Player Loop
    world.getAllPlayers().forEach(player => {
        // HUD
        const level = player.getDynamicProperty("deepcraft:level") || 1;
        const xp = player.getDynamicProperty("deepcraft:xp") || 0;
        const reqXp = getXpCostForLevel(level);
        const profile = player.getDynamicProperty("deepcraft:active_profile") || 1;
        
        // HP情報の取得と表示
        const hpComp = player.getComponent("minecraft:health");
        const hpText = hpComp ? `§c${Math.ceil(hpComp.currentValue)}/${hpComp.effectiveMax}` : "§c?/?";
        
        player.onScreenDisplay.setActionBar(`§b[Slot ${profile}] §eLv.§l${level} §r§7| ${hpText} §7| §fXP: §a${xp}§f / §c${reqXp}§f`);

        // Checks
        applyEquipmentPenalties(player);
        applyNumericalPassives(player);
        applyStatsToEntity(player);
    });

    // 2. Boss Loop (AI Only)
    // HPバー更新(updateBossNameTag)は一時的に無効化
    world.getDimension("overworld").getEntities({ tags: ["deepcraft:boss"] }).forEach(boss => {
        // updateBossNameTag(boss); // <-- 保留のためコメントアウト
        processBossSkillAI(boss);
    });

}, 5); // 0.25秒ごとに実行

function getXpCostForLevel(level) {
    return CONFIG.XP_BASE_COST + (level * CONFIG.XP_LEVEL_MULTIPLIER);
}

// --- Boss Logic ---

function updateBossNameTag(boss) {
    if (!boss.isValid()) return;
    const hp = boss.getComponent("minecraft:health");
    const bossId = boss.getDynamicProperty("deepcraft:boss_id");
    const bossDef = MOB_POOL[bossId];
    
    if (hp && bossDef) {
        const current = Math.ceil(hp.currentValue);
        const max = hp.effectiveMax;
        const percent = Math.max(0, current / max);
        
        // HP Bar
        const barLen = 10;
        const fill = Math.ceil(percent * barLen);
        const bar = "§a" + "|".repeat(fill) + "§c" + "|".repeat(barLen - fill);
        
        boss.nameTag = `${bossDef.name}\n${bar} §f${current}/${max}`;
    }
}

function processBossSkillAI(boss) {
    if (!boss.isValid()) return;
    const bossId = boss.getDynamicProperty("deepcraft:boss_id");
    const bossDef = MOB_POOL[bossId];

    // ターゲットがいる時だけスキル抽選
    if (bossDef && bossDef.skills && boss.target) {
        bossDef.skills.forEach(skill => {
            if (Math.random() < skill.chance) {
                executeBossSkill(boss, skill);
            }
        });
    }
}

function executeBossSkill(boss, skill) {
    if (skill.msg) {
        boss.dimension.runCommand(`tellraw @a[r=30,x=${boss.location.x},y=${boss.location.y},z=${boss.location.z}] {"rawtext":[{"text":"§e[BOSS] ${skill.msg}"}]}`);
    }
    skill.action(boss);
}

// --- Player Skill (Right Click) ---

function executeSkill(player, skillId) {
    const skill = SKILL_POOL[skillId];
    if (!skill) return;

    const cdTag = `cooldown:skill_${skillId}`;
    if (player.hasTag(cdTag)) {
        player.playSound("note.bass");
        player.sendMessage("§cSkill is on cooldown!");
        return;
    }

    const success = skill.onUse(player);
    if (success !== false) {
        player.addTag(cdTag);
        system.runTimeout(() => {
            if (player.isValid()) {
                player.removeTag(cdTag);
                player.playSound("random.orb");
                player.sendMessage(`§aSkill Ready: ${skill.name}`);
            }
        }, skill.cooldown * 20);
    }
}

// --- Events (Commands & Menu) ---

world.afterEvents.itemUse.subscribe((ev) => {
    const player = ev.source;
    const item = ev.itemStack;

    if (item.typeId === "minecraft:compass") {
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
});

// コマンド処理 (/scriptevent)
system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (!ev.sourceEntity) return;

    if (ev.id === "deepcraft:addxp") {
        const amount = parseInt(ev.message) || 1000;
        addXP(ev.sourceEntity, amount);
    }
    
    if (ev.id === "deepcraft:quest") {
        acceptQuest(ev.sourceEntity, ev.message);
    }

    if (ev.id === "deepcraft:give") {
        giveCustomItem(ev.sourceEntity, ev.message);
    }

    if (ev.id === "deepcraft:summon") {
        summonBoss(ev.sourceEntity, ev.message);
    }

    if (ev.id === "deepcraft:max") {
        const player = ev.sourceEntity;
        for (const key in CONFIG.STATS) player.setDynamicProperty(`deepcraft:${key}`, 100);
        player.setDynamicProperty("deepcraft:level", 100);
        applyStatsToEntity(player);
        player.sendMessage("§e§l[DEBUG] ALL STATS MAXED!");
    }
});

// --- Helper Functions ---

function giveCustomItem(player, itemId) {
    const def = EQUIPMENT_POOL[itemId];
    if (!def) { player.sendMessage(`§cItem not found: ${itemId}`); return; }
    const item = new ItemStack(def.baseItem, 1);
    item.nameTag = def.name;
    item.setLore(def.lore);
    item.setDynamicProperty("deepcraft:item_id", itemId);
    player.getComponent("inventory").container.addItem(item);
    player.sendMessage(`§eReceived: ${def.name}`);
}

// ★修正: summonBoss関数 (ダミー対応・弱体化削除)
function summonBoss(player, bossId) {
    const def = MOB_POOL[bossId];
    if (!def) { player.sendMessage(`§cBoss ID '${bossId}' not found.`); return; }
    
    try {
        const boss = player.dimension.spawnEntity(def.type, player.location);
        
        boss.setDynamicProperty("deepcraft:boss_id", bossId);
        boss.nameTag = def.name;
        
        // --- ★ダミー判定 ---
        if (def.isDummy) {
            boss.addTag("deepcraft:boss");
            
            // 移動停止 (Slowness 255)
            boss.addEffect("slowness", 20000000, { amplifier: 255, showParticles: false });
            
            // ※Weaknessは削除しました（攻撃を通すため）
            
            // HP全快
            const hp = boss.getComponent("minecraft:health");
            if (hp) hp.setCurrentValue(hp.effectiveMax);
            
            player.sendMessage(`§aTraining Dummy summoned!`);

        } else {
            // 通常ボス
            boss.addTag("deepcraft:boss");
            boss.addEffect("resistance", 20000000, { amplifier: 1, showParticles: false });
            
            if (def.speed !== undefined) {
                const movement = boss.getComponent("minecraft:movement");
                if (movement) movement.setCurrentValue(def.speed);
            }
            
            const hp = boss.getComponent("minecraft:health");
            if (hp) hp.setCurrentValue(hp.effectiveMax);

            player.sendMessage(`§c§lWARNING: ${def.name} has appeared!`);
            player.playSound("mob.enderdragon.growl");
        }

        if (def.equipment) {
            const equip = boss.getComponent("equippable");
            if (equip) {
                if (def.equipment.mainhand) equip.setEquipment(EquipmentSlot.Mainhand, createCustomItem(def.equipment.mainhand));
                if (def.equipment.head) equip.setEquipment(EquipmentSlot.Head, new ItemStack(def.equipment.head));
                if (def.equipment.chest) equip.setEquipment(EquipmentSlot.Chest, new ItemStack(def.equipment.chest));
                if (def.equipment.legs) equip.setEquipment(EquipmentSlot.Legs, new ItemStack(def.equipment.legs));
                if (def.equipment.feet) equip.setEquipment(EquipmentSlot.Feet, new ItemStack(def.equipment.feet));
            }
        }

    } catch (e) { 
        player.sendMessage(`§cError in summonBoss: ${e}`); 
    }
}

function createCustomItem(itemId) {
    const def = EQUIPMENT_POOL[itemId];
    if (def) {
        const item = new ItemStack(def.baseItem, 1);
        item.nameTag = def.name;
        item.setLore(def.lore);
        item.setDynamicProperty("deepcraft:item_id", itemId);
        return item;
    }
    return new ItemStack(itemId, 1);
}

function addXP(player, amount) {
    let currentXP = player.getDynamicProperty("deepcraft:xp") || 0;
    player.setDynamicProperty("deepcraft:xp", currentXP + amount);
    player.sendMessage(`§e+${amount} XP`);
}

function applyNumericalPassives(player) {
    const hp = player.getComponent("minecraft:health");
    let regenAmount = 0;
    if (player.hasTag("talent:immortal")) regenAmount += 1;
    
    const headBlock = player.dimension.getBlock(player.getHeadLocation());
    if (player.hasTag("talent:aquatic_life") && headBlock && (headBlock.typeId === "minecraft:water" || headBlock.typeId === "minecraft:flowing_water")) {
        regenAmount += 1;
    }

    if (regenAmount > 0 && hp && hp.currentValue < hp.effectiveMax && hp.currentValue > 0) {
        hp.setCurrentValue(Math.min(hp.currentValue + regenAmount, hp.effectiveMax));
    }

    if (player.hasTag("talent:full_belly")) {
        player.runCommand("effect @s saturation 1 0 true"); 
    }
}

function applyEquipmentPenalties(player) {
    const equipment = player.getComponent("equippable");
    let armorPenalty = false;
    
    [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet].forEach(slot => {
        if (!checkReq(player, equipment.getEquipment(slot)).valid) armorPenalty = true;
    });

    if (armorPenalty) player.addTag("debuff:heavy_armor");
    else player.removeTag("debuff:heavy_armor");
}

function checkReq(player, item) {
    if (!item) return { valid: true };
    const customId = item.getDynamicProperty("deepcraft:item_id");
    if (!customId) return { valid: true };
    const def = EQUIPMENT_POOL[customId];
    if (!def) return { valid: true };

    for (const stat in def.req) {
        const required = def.req[stat];
        const current = player.getDynamicProperty(`deepcraft:${stat}`) || 1;
        if (current < required) return { valid: false, missing: `${CONFIG.STATS[stat]} ${required}` };
    }
    return { valid: true };
}

// ★修正: キャッシュ対応版 applyStatsToEntity
function applyStatsToEntity(player) {
    if (!player.isValid()) {
        playerStateCache.delete(player.id);
        return;
    }

    const stats = {};
    for (const key in CONFIG.STATS) stats[key] = player.getDynamicProperty(`deepcraft:${key}`) || 1;

    // --- 計算 ---
    let baseHealth = 18 + (stats.fortitude * 2);
    if (player.hasTag("talent:vitality_1")) baseHealth += 4;
    if (player.hasTag("talent:vitality_2")) baseHealth += 10;
    if (player.hasTag("talent:glass_cannon")) baseHealth = Math.floor(baseHealth * 0.5);
    const healthVal = Math.min(Math.max(baseHealth, 20), 300);

    let speedIndex = 10 + Math.floor(stats.agility * 0.2); 
    if (player.hasTag("talent:swift_1")) speedIndex += 5; 
    if (player.hasTag("talent:godspeed")) speedIndex += 15;
    if (player.hasTag("debuff:heavy_armor")) speedIndex = Math.max(5, speedIndex - 10);
    speedIndex = Math.min(Math.max(speedIndex, 0), 300);

    const hasHeavyStance = player.hasTag("talent:heavy_stance");

    // --- キャッシュチェック & 適用 ---
    let cache = playerStateCache.get(player.id);
    if (!cache) {
        cache = { health: -1, speed: -1, heavyStance: null };
        playerStateCache.set(player.id, cache);
    }

    // 値が変わった時だけイベントを発行
    if (cache.health !== healthVal) {
        player.triggerEvent(`health${healthVal}`);
        cache.health = healthVal;
    }

    if (cache.speed !== speedIndex) {
        player.triggerEvent(`movement${speedIndex}`);
        cache.speed = speedIndex;
    }

    if (cache.heavyStance !== hasHeavyStance) {
        if (hasHeavyStance) player.triggerEvent("knockback_resistance100");
        else player.triggerEvent("knockback_resistance_reset");
        cache.heavyStance = hasHeavyStance;
    }

    try { player.setProperty("status:arrow_damage", stats.light); } catch (e) {}
}

// --- Profile & Menu Logic ---

function saveProfile(player, slot) {
    const questDataStr = player.getDynamicProperty("deepcraft:quest_data") || "{}";
    const data = {
        level: player.getDynamicProperty("deepcraft:level") || 1,
        xp: player.getDynamicProperty("deepcraft:xp") || 0,
        invested_points: player.getDynamicProperty("deepcraft:invested_points") || 0,
        pending_card_draws: player.getDynamicProperty("deepcraft:pending_card_draws") || 0,
        stats: {}, talents: [], quests: JSON.parse(questDataStr)
    };
    for (const key in CONFIG.STATS) data.stats[key] = player.getDynamicProperty(`deepcraft:${key}`) || 1;
    player.getTags().forEach(tag => { if (tag.startsWith("talent:")) data.talents.push(tag); });
    player.setDynamicProperty(`deepcraft:profile_${slot}`, JSON.stringify(data));
}

function loadProfile(player, slot) {
    const json = player.getDynamicProperty(`deepcraft:profile_${slot}`);
    let data;
    if (json) {
        data = JSON.parse(json);
    } else {
        data = { level: 1, xp: 0, invested_points: 0, pending_card_draws: 0, stats: {}, talents: [], quests: {} };
        for (const key in CONFIG.STATS) data.stats[key] = 1;
    }
    player.setDynamicProperty("deepcraft:level", data.level);
    player.setDynamicProperty("deepcraft:xp", data.xp);
    player.setDynamicProperty("deepcraft:invested_points", data.invested_points);
    player.setDynamicProperty("deepcraft:pending_card_draws", data.pending_card_draws);
    player.setDynamicProperty("deepcraft:quest_data", JSON.stringify(data.quests || {}));
    for (const key in CONFIG.STATS) player.setDynamicProperty(`deepcraft:${key}`, data.stats[key] || 1);
    player.getTags().forEach(tag => { if (tag.startsWith("talent:")) player.removeTag(tag); });
    data.talents.forEach(tag => player.addTag(tag));
    player.setDynamicProperty("deepcraft:active_profile", slot);
    applyStatsToEntity(player);
}

function openMenuHub(player) {
    const form = new ChestFormData("small");
    form.title("§lMenu Hub");
    const pendingDraws = player.getDynamicProperty("deepcraft:pending_card_draws") || 0;
    const activeProfile = player.getDynamicProperty("deepcraft:active_profile") || 1;

    form.button(2, "§b§lView Talents", ["§r§7Check unlocked talents"], "minecraft:enchanted_book");
    if (pendingDraws > 0) {
        form.button(4, "§6§l🎁 DRAW TALENT", ["§r§eUnclaimed Talents!", "§cClick to draw", "§8(Status menu locked)"], "minecraft:nether_star", pendingDraws, 0, true);
    } else {
        form.button(4, "§a§lStatus & Upgrade", ["§r§7Manage stats"], "minecraft:experience_bottle");
    }
    form.button(6, `§d§lProfile: Slot ${activeProfile}`, ["§r§7Switch Builds"], "minecraft:name_tag");
    form.button(20, "§6§lQuest Log", ["§r§7Active quests"], "minecraft:writable_book");
    form.button(26, "§c§lDEBUG: RESET", ["§r§cReset Profile"], "minecraft:barrier");
    form.button(25, "§e§lDEBUG: +XP", ["§r+1000 XP"], "minecraft:emerald");
    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 4) pendingDraws > 0 ? openCardSelection(player) : openStatusMenu(player);
        if (res.selection === 2) openTalentViewer(player);
        if (res.selection === 6) openProfileMenu(player);
        if (res.selection === 20) openQuestMenu(player);
        if (res.selection === 26) resetCurrentProfile(player);
        if (res.selection === 25) { addXP(player, 1000); openMenuHub(player); }
    });
}

function openProfileMenu(player) {
    const form = new ChestFormData("small");
    form.title("§lProfile Manager");
    const activeSlot = player.getDynamicProperty("deepcraft:active_profile") || 1;
    for (let i = 1; i <= CONFIG.MAX_PROFILES; i++) {
        const isCurrent = (i === activeSlot);
        const slotJson = player.getDynamicProperty(`deepcraft:profile_${i}`);
        let desc = "§7Empty / Default";
        let level = 1;
        if (slotJson) { try { const data = JSON.parse(slotJson); level = data.level || 1; desc = `§7Level: ${level}\n§7Traits: ${data.talents.length}`; } catch(e) {} }
        const uiPos = 9 + (i * 2);
        let icon = isCurrent ? "minecraft:ender_chest" : "minecraft:chest";
        let name = isCurrent ? `§a§lSlot ${i} (Active)` : `§lSlot ${i}`;
        form.button(uiPos, name, [desc, isCurrent ? "§a[Current]" : "§e[Click to Load]"], icon, level);
    }
    form.button(26, "§c§lBack", ["§rReturn to Hub"], "minecraft:barrier");
    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 26) { openMenuHub(player); return; }
        let targetSlot = 0;
        if (res.selection === 11) targetSlot = 1;
        if (res.selection === 13) targetSlot = 2;
        if (res.selection === 15) targetSlot = 3;
        if (targetSlot > 0 && targetSlot !== activeSlot) {
            saveProfile(player, activeSlot);
            loadProfile(player, targetSlot);
            player.playSound("random.orb");
            player.sendMessage(`§aLoaded Profile Slot ${targetSlot}.`);
            openMenuHub(player);
        } else if (targetSlot === activeSlot) { player.sendMessage("§cAlready active."); openProfileMenu(player); }
    });
}

function openStatusMenu(player) {
    const form = new ChestFormData("large");
    const level = player.getDynamicProperty("deepcraft:level");
    const invested = player.getDynamicProperty("deepcraft:invested_points");
    const remaining = CONFIG.STAT_POINTS_PER_LEVEL - invested;
    const currentXP = player.getDynamicProperty("deepcraft:xp");
    const cost = getXpCostForLevel(level);
    form.title(`§lStatus | Pts: ${remaining} | XP: ${currentXP}`);
    const layout = [
        { key: "strength", slot: 1 }, { key: "fortitude", slot: 3 }, { key: "agility", slot: 5 }, { key: "defense", slot: 7 },
        { key: "intelligence", slot: 11 }, { key: "willpower", slot: 13 }, { key: "charisma", slot: 15 },
        { key: "flame", slot: 28 }, { key: "frost", slot: 30 }, { key: "gale", slot: 32 }, { key: "thunder", slot: 34 },
        { key: "heavy", slot: 47 }, { key: "medium", slot: 49 }, { key: "light", slot: 51 }
    ];
    const slotToKeyMap = {};
    layout.forEach(item => {
        const key = item.key;
        const slot = item.slot;
        const val = player.getDynamicProperty(`deepcraft:${key}`) || 1;
        const name = CONFIG.STATS[key];
        let icon = "minecraft:book";
        if (key === "strength") icon = "minecraft:netherite_sword";
        if (key === "fortitude") icon = "minecraft:golden_apple";
        if (key === "agility") icon = "minecraft:sugar";
        if (key === "defense") icon = "minecraft:shield";
        if (key === "intelligence") icon = "minecraft:enchanted_book";
        if (key === "willpower") icon = "minecraft:beacon";
        if (key === "charisma") icon = "minecraft:diamond";
        if (key === "flame") icon = "minecraft:fire_charge";
        if (key === "frost") icon = "minecraft:snowball";
        if (key === "gale") icon = "minecraft:elytra";
        if (key === "thunder") icon = "minecraft:lightning_rod";
        if (key === "heavy") icon = "minecraft:anvil";
        if (key === "medium") icon = "minecraft:iron_chestplate";
        if (key === "light") icon = "minecraft:bow";
        form.button(slot, `§l${name}`, [`§r§7Lv: §f${val}`, `§r§eCost: ${cost} XP`, `§r§8(Click to Upgrade)`], icon, val);
        slotToKeyMap[slot] = key;
    });
    form.button(53, "§c§lBack", ["§rBack to Hub"], "minecraft:barrier");
    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 53) { openMenuHub(player); return; }
        const selectedKey = slotToKeyMap[res.selection];
        if (selectedKey) upgradeStat(player, selectedKey);
    });
}

function openTalentViewer(player) {
    const form = new ChestFormData("large");
    form.title("§lOwned Talents");
    let slot = 0;
    const tags = player.getTags();
    CARD_POOL.forEach(card => {
        if (tags.includes(`talent:${card.id}`)) {
            form.button(slot, card.name, [card.description, `§oRarity: ${card.rarity}`], "minecraft:enchanted_book");
            slot++;
        }
    });
    if (slot === 0) form.button(22, "§7No Talents", ["§rYou have no talents yet."], "minecraft:barrier");
    form.button(53, "§c§lBack", ["§rBack to Hub"], "minecraft:barrier");
    form.show(player).then(res => { if (!res.canceled && res.selection === 53) openMenuHub(player); });
}

function openQuestMenu(player) {
    const form = new ChestFormData("large");
    form.title("§lQuest Log");
    const questData = JSON.parse(player.getDynamicProperty("deepcraft:quest_data") || "{}");
    let slot = 0;
    const questIds = [];
    const sortedKeys = Object.keys(questData).sort((a, b) => {
        const order = { "completed": 0, "active": 1, "claimed": 2 };
        return order[questData[a].status] - order[questData[b].status];
    });
    sortedKeys.forEach(qId => {
        const userQuest = questData[qId];
        const def = QUEST_POOL[qId];
        if (!def) return;
        let icon = "minecraft:book";
        let statusText = "";
        let clickText = "";
        let isGlint = false;
        if (userQuest.status === "active") { icon = "minecraft:book"; statusText = `§7Progress: §f${userQuest.progress} / ${def.amount}`; clickText = "§8(In Progress)"; }
        else if (userQuest.status === "completed") { icon = "minecraft:emerald"; statusText = "§a§lCOMPLETED!"; clickText = "§e[Click to Claim Reward]"; isGlint = true; }
        else if (userQuest.status === "claimed") { icon = "minecraft:paper"; statusText = "§8(Reward Claimed)"; clickText = "§8Done"; }
        form.button(slot, def.name, [def.description, statusText, clickText], icon, 1, 0, isGlint);
        questIds[slot] = qId;
        slot++;
    });
    if (slot === 0) form.button(22, "§7No Active Quests", ["§rExplore to find quests!"], "minecraft:barrier");
    form.button(53, "§c§lBack", ["§rReturn to Hub"], "minecraft:barrier");
    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 53) { openMenuHub(player); return; }
        const qId = questIds[res.selection];
        if (qId) {
            const userQuest = questData[qId];
            if (userQuest && userQuest.status === "completed") { claimQuestReward(player, qId); }
            else { openQuestMenu(player); }
        }
    });
}

function upgradeStat(player, statKey) {
    const invested = player.getDynamicProperty("deepcraft:invested_points");
    if (invested >= CONFIG.STAT_POINTS_PER_LEVEL) { processLevelUp(player); return; }
    const currentXP = player.getDynamicProperty("deepcraft:xp");
    const level = player.getDynamicProperty("deepcraft:level");
    const cost = getXpCostForLevel(level);
    if (currentXP < cost) { player.sendMessage(`§cNot enough XP! Need: ${cost}, Have: ${currentXP}`); openStatusMenu(player); return; }
    player.setDynamicProperty("deepcraft:xp", currentXP - cost);
    const currentVal = player.getDynamicProperty(`deepcraft:${statKey}`) || 1;
    player.setDynamicProperty(`deepcraft:${statKey}`, currentVal + 1);
    player.setDynamicProperty("deepcraft:invested_points", invested + 1);
    player.playSound("random.levelup");
    player.sendMessage(`§aUpgraded: ${CONFIG.STATS[statKey]} -> ${currentVal + 1}`);
    applyStatsToEntity(player);
    if (invested + 1 >= CONFIG.STAT_POINTS_PER_LEVEL) { processLevelUp(player); } else { openStatusMenu(player); }
}

function processLevelUp(player) {
    const currentLvl = player.getDynamicProperty("deepcraft:level");
    player.setDynamicProperty("deepcraft:level", currentLvl + 1);
    player.setDynamicProperty("deepcraft:invested_points", 0);
    let pending = player.getDynamicProperty("deepcraft:pending_card_draws") || 0;
    player.setDynamicProperty("deepcraft:pending_card_draws", pending + 1);
    player.sendMessage(`§6§lLEVEL UP! §r(Lv.${currentLvl + 1})`);
    player.playSound("ui.toast.challenge_complete");
    system.runTimeout(() => openMenuHub(player), 20);
}

function openCardSelection(player) {
    const form = new ChestFormData("small");
    form.title("§lSelect a Talent");
    const availableCards = CARD_POOL.filter(card => {
        const hasTalent = player.hasTag(`talent:${card.id}`);
        const conditionsMet = card.condition(player);
        return conditionsMet && !hasTalent;
    });
    const shuffled = availableCards.sort(() => 0.5 - Math.random());
    const selection = shuffled.slice(0, 3);
    const positions = [11, 13, 15];
    if (selection.length === 0) { const filler = CARD_POOL.find(c => c.id === "basic_training"); if (filler) selection.push(filler); }
    selection.forEach((card, index) => {
        let icon = "minecraft:enchanted_book";
        if (card.rarity === "legendary") icon = "minecraft:nether_star";
        form.button(positions[index], card.name, [card.description, `§o${card.rarity.toUpperCase()}`, `§8Req: ${card.conditionText}`], icon, 1, 0, true);
    });
    form.show(player).then((response) => {
        if (response.canceled) { player.sendMessage("§cPlease select a talent."); openMenuHub(player); return; }
        const idx = positions.indexOf(response.selection);
        if (idx !== -1 && selection[idx]) { applyCardEffect(player, selection[idx]); }
    });
}

function applyCardEffect(player, card) {
    let pending = player.getDynamicProperty("deepcraft:pending_card_draws") || 0;
    if (pending > 0) player.setDynamicProperty("deepcraft:pending_card_draws", pending - 1);
    player.sendMessage(`§aAcquired Talent: ${card.name}`);
    if (card.id !== "basic_training") player.addTag(`talent:${card.id}`);
    if (card.type === "xp") {
        addXP(player, card.value);
        const currentSlot = player.getDynamicProperty("deepcraft:active_profile") || 1;
        saveProfile(player, currentSlot);
        system.runTimeout(() => openMenuHub(player), 10);
        return;
    }
    // Stat type logic kept for compatibility
    if (card.type === "stat") {
        if (Array.isArray(card.stat)) { card.stat.forEach(s => { const val = player.getDynamicProperty(`deepcraft:${s}`) || 1; player.setDynamicProperty(`deepcraft:${s}`, val + card.value); }); }
        else if (card.stat === "all") { for (const key in CONFIG.STATS) { const val = player.getDynamicProperty(`deepcraft:${key}`) || 1; player.setDynamicProperty(`deepcraft:${key}`, val + card.value); } }
        else { const val = player.getDynamicProperty(`deepcraft:${card.stat}`) || 1; player.setDynamicProperty(`deepcraft:${card.stat}`, val + card.value); }
        applyStatsToEntity(player);
    }
    const currentSlot = player.getDynamicProperty("deepcraft:active_profile") || 1;
    saveProfile(player, currentSlot);
    system.runTimeout(() => openMenuHub(player), 10);
}

function resetCurrentProfile(player) {
    const currentSlot = player.getDynamicProperty("deepcraft:active_profile") || 1;
    player.setDynamicProperty(`deepcraft:profile_${currentSlot}`, undefined);
    player.setDynamicProperty("deepcraft:quest_data", undefined);
    loadProfile(player, currentSlot);
    player.playSound("random.break");
    player.sendMessage(`§c[DEBUG] Profile Slot ${currentSlot} has been reset.`);
}

// --- Combat Logic (AfterEvents Only) ---

world.afterEvents.entityHurt.subscribe((ev) => {
    const victim = ev.hurtEntity;
    const attacker = ev.damageSource.damagingEntity;
    const damageTaken = ev.damage;

    // Boss HP Update & Counter
    if (victim.hasTag("deepcraft:boss")) {
        // updateBossNameTag(victim); // <-- 保留のためコメントアウト
        const bossId = victim.getDynamicProperty("deepcraft:boss_id");
        const bossDef = MOB_POOL[bossId];
        if (bossDef && bossDef.skills && Math.random() < 0.15) {
            const skill = bossDef.skills[Math.floor(Math.random() * bossDef.skills.length)];
            executeBossSkill(victim, skill);
        }
    }

    // 1. Attacker (Player)
    if (attacker && attacker.typeId === "minecraft:player") {
        const equipment = attacker.getComponent("equippable");
        const weapon = equipment.getEquipment(EquipmentSlot.Mainhand);
        
        // Namakura Check (Damage Refund)
        if (!checkReq(attacker, weapon).valid) {
            attacker.playSound("random.break");
            if (victim.getComponent("minecraft:health")) {
                const vHealth = victim.getComponent("minecraft:health");
                if (vHealth.currentValue > 0) {
                    const refund = Math.max(0, damageTaken - 1); 
                    vHealth.setCurrentValue(Math.min(vHealth.currentValue + refund, vHealth.effectiveMax));
                }
            }
            return;
        }

        // Talent Bonus
        let bonus = 0;
        let multiplier = 1.0;

        if (attacker.hasTag("talent:brute_force")) bonus += 2;
        if (attacker.hasTag("talent:battle_cry")) bonus += 3;
        if (attacker.hasTag("talent:sharp_blade")) multiplier += 0.1;
        if (attacker.hasTag("talent:glass_cannon")) multiplier += 1.0;
        
        const aHp = attacker.getComponent("minecraft:health");
        if (attacker.hasTag("talent:berserker") && aHp.currentValue < aHp.effectiveMax * 0.3) multiplier += 0.5;
        if (attacker.hasTag("talent:assassin") && attacker.isSneaking) multiplier += 1.0;

        // 追加ダメージ
        if (bonus > 0 || multiplier > 1.0) {
            const extraDmg = Math.floor(damageTaken * (multiplier - 1)) + bonus;
            if (extraDmg > 0) victim.applyDamage(extraDmg);
        }

        if (attacker.hasTag("talent:vampirism")) {
            if (aHp && aHp.currentValue > 0) aHp.setCurrentValue(Math.min(aHp.currentValue + 2, aHp.effectiveMax));
        }
    }

    // 2. Victim (Player)
    if (victim && victim.typeId === "minecraft:player") {
        const vHealth = victim.getComponent("minecraft:health");
        if (!vHealth || vHealth.currentValue <= 0) return;

        // Evasion
        if (victim.hasTag("talent:evasion") && Math.random() < 0.15) {
            vHealth.setCurrentValue(Math.min(vHealth.currentValue + damageTaken, vHealth.effectiveMax));
            victim.playSound("random.orb");
            victim.sendMessage("§aDodge!");
            return; 
        }

        // Immunity
        const cause = ev.damageSource.cause;
        if (["fire", "lava", "magma"].includes(cause) && (victim.hasTag("talent:fire_walker") || victim.hasTag("talent:elemental_lord"))) {
            vHealth.setCurrentValue(Math.min(vHealth.currentValue + damageTaken, vHealth.effectiveMax));
            return;
        }
        if (cause === "fall" && victim.hasTag("talent:acrobat")) {
            vHealth.setCurrentValue(Math.min(vHealth.currentValue + damageTaken, vHealth.effectiveMax));
            return;
        }

        // Defense Calculation
        let flatReduction = 0;
        let defense = victim.getDynamicProperty("deepcraft:defense") || 1;

        if (victim.hasTag("talent:tough_skin")) flatReduction += 1;
        if (victim.hasTag("talent:iron_wall")) flatReduction += 2;
        if (victim.hasTag("talent:last_stand") && vHealth.currentValue < vHealth.effectiveMax * 0.3) defense += 50;

        let reducedAmount = 0;
        if (defense > 1) {
            const reductionRate = defense / (defense + 50);
            reducedAmount = Math.floor(damageTaken * reductionRate);
        }

        const totalBlocked = reducedAmount + flatReduction;
        if (totalBlocked > 0) {
            const actualHeal = Math.min(totalBlocked, damageTaken);
            vHealth.setCurrentValue(Math.min(vHealth.currentValue + actualHeal, vHealth.effectiveMax));
        }

        // Thorns
        if (attacker) {
            if (victim.hasTag("talent:thorns_aura")) attacker.applyDamage(2);
            if (victim.hasTag("talent:thorns_master")) attacker.applyDamage(Math.floor(damageTaken * 0.3));
        }
    }
});

world.afterEvents.entityDie.subscribe((ev) => {
    const victim = ev.deadEntity;
    const attacker = ev.damageSource.damagingEntity;

    if (attacker && attacker.typeId === "minecraft:player") {
        checkQuestProgress(attacker, "kill", victim.typeId);
        
        if (victim.hasTag("deepcraft:boss")) {
            const bossId = victim.getDynamicProperty("deepcraft:boss_id");
            const def = MOB_POOL[bossId];
            if (def && def.drops) {
                def.drops.forEach(drop => {
                    if (drop.chance && Math.random() > drop.chance) return;
                    if (drop.type === "xp") {
                        addXP(attacker, drop.amount);
                        attacker.sendMessage(`§eBoss Defeated! +${drop.amount} XP`);
                    }
                    if (drop.type === "item") {
                        const itemDef = EQUIPMENT_POOL[drop.id];
                        if (itemDef) {
                            const item = new ItemStack(itemDef.baseItem, 1);
                            item.nameTag = itemDef.name;
                            item.setLore(itemDef.lore);
                            item.setDynamicProperty("deepcraft:item_id", drop.id);
                            attacker.dimension.spawnItem(item, victim.location);
                            attacker.sendMessage(`§6§lRARE DROP! §rYou found: ${itemDef.name}`);
                        }
                    }
                });
            }
        }
        if (attacker.hasTag("talent:exp_boost")) addXP(attacker, 50);
    }

    if (victim.typeId === "minecraft:player") {
        const player = victim;
        const lostXP = player.getDynamicProperty("deepcraft:xp") || 0;
        player.setDynamicProperty("deepcraft:xp", 0);
        if (lostXP > 0) player.sendMessage(`§cYou died and lost ${lostXP} XP...`);

        const inventory = player.getComponent("inventory").container;
        const location = player.location;
        let droppedItems = [];
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (item) {
                if (Math.random() < CONFIG.DEATH_ITEM_DROP_RATE) {
                    droppedItems.push(item.clone());
                    inventory.setItem(i, null);
                }
            }
        }
        if (droppedItems.length > 0) {
            const spawnLoc = { x: location.x, y: location.y + 1.0, z: location.z };
            try {
                const soul = player.dimension.spawnEntity("minecraft:chest_minecart", spawnLoc);
                soul.nameTag = "§bSoul";
                const soulContainer = soul.getComponent("inventory").container;
                droppedItems.forEach(item => soulContainer.addItem(item));
                player.sendMessage(`§bItems dropped in Soul at [${Math.floor(spawnLoc.x)}, ${Math.floor(spawnLoc.y)}, ${Math.floor(spawnLoc.z)}].`);
            } catch (e) {}
        }
    }
});