// BP/scripts/systems/input_system.js
import { system, world } from "@minecraft/server";
import { safeSpawnParticle } from "../utils.js";
import { executeSkill } from "../player/skill_manager.js";
import { getGrimoire, normalizeActionId } from "../player/grimoire.js";
import { checkReq } from "../player/player_manager.js";
import { EQUIPMENT_POOL } from "../data/equipment.js";

const HOLD_TICKS = 6; // 0.3s @ 20tps
const COMBO_TIMEOUT_TICKS = 40; // 2s
const INPUT_FAILSAFE_TICKS = 60; // fail-safe to avoid stuck states

const INPUT_SOUND = {
    // Headphones-friendly (non-spatial): keep centered by using player.playSound only.
    L: { id: "random.click", volume: 0.1, pitch: 0.8 },
    R: { id: "random.click", volume: 0.1, pitch: 1.2 }
};

function playInputSound(player, key) {
    const cfg = INPUT_SOUND[key];
    if (!cfg) return;
    
    try {
        player.playSound(cfg.id, { volume: cfg.volume, pitch: cfg.pitch });
        return;
    } catch (_) {}

    // Fallback without options (still centered)
    try { player.playSound(cfg.id); } catch (_) {}
}

/** @typedef {{ startTick:number, released:boolean, holdTriggered:boolean, blockedUntilRelease:boolean, weaponSkillId?:string, weaponItem?: any, sawUseStart?:boolean }} RightClickState */

/** @type {Map<string, RightClickState>} */
const rightClickStateByPlayerId = new Map();

/** @type {Map<string, {buf:string[], lastTick:number}>} */
const comboByPlayerId = new Map();

function comboKey(buf, isShift) {
    const base = buf.join("-");
    return isShift ? `Shift+${base}` : base;
}

function renderCombo(buf) {
    const slots = [" ", " ", " "];
    for (let i = 0; i < Math.min(3, buf.length); i++) slots[i] = buf[i];
    return `§7[ §f${slots[0]} §7- §f${slots[1]} §7- §f${slots[2]} §7]`;
}

function showComboActionBar(player) {
    const entry = comboByPlayerId.get(player.id);
    if (!entry) return;
    const isShift = player.isSneaking;
    const prefix = isShift ? "§eShift §7" : "";
    player.onScreenDisplay.setActionBar(prefix + renderCombo(entry.buf));
}

export function getComboDisplay(player) {
    const entry = comboByPlayerId.get(player.id);
    const isShift = player.isSneaking;
    const prefix = isShift ? "§eShift §7" : "";
    const buf = entry ? entry.buf : [];
    return prefix + renderCombo(buf);
}

function clearCombo(player) {
    comboByPlayerId.delete(player.id);
}

function pushComboInput(player, key) {
    if (player.hasTag("deepcraft:knocked")) return;

    // Safe zone: suppress combat inputs.
    if (player.hasTag("deepcraft:safe")) {
        player.playSound("note.bass", { volume: 0.3, pitch: 0.8 });
        player.sendMessage("§8» §cセーフゾーン内では行動できません。");
        clearCombo(player);
        return;
    }
    const now = system.currentTick;
    const entry = comboByPlayerId.get(player.id) || { buf: [], lastTick: now };

    // timeout
    if (now - entry.lastTick > COMBO_TIMEOUT_TICKS) {
        entry.buf = [];
    }

    // コンボ始動は常に右クリック(R)
    if (entry.buf.length === 0 && key !== "R") {
        return;
    }

    // Feedback sound (left/right distinguishable, centered)
    playInputSound(player, key);

    entry.buf.push(key);
    if (entry.buf.length > 3) entry.buf.shift();
    entry.lastTick = now;
    comboByPlayerId.set(player.id, entry);

    if (entry.buf.length === 3) {
        const grimoire = getGrimoire(player);
        const keyNormal = comboKey(entry.buf, false);
        const keyShift = comboKey(entry.buf, true);
        const lookupKey = player.isSneaking ? keyShift : keyNormal;

        const action = grimoire[lookupKey];
        if (!action) {
            player.playSound("note.bass", { volume: 0.3 });
            player.sendMessage(`§8» §c未設定コンボ: ${lookupKey}`);
            clearCombo(player);
            return;
        }

        const skillId = normalizeActionId(action);
        if (!skillId) {
            player.playSound("note.bass", { volume: 0.3 });
            player.sendMessage(`§8» §c無効な設定: ${lookupKey}`);
            clearCombo(player);
            return;
        }

        // Execute skill immediately, but keep combo display briefly (5 ticks = 0.25s)
        executeSkill(player, skillId);
        system.runTimeout(() => {
            if (player.isValid) {
                clearCombo(player);
            }
        }, 5);
    }
}

function getWeaponSkillIdFromItem(player, itemStack) {
    if (!itemStack) return undefined;
    const customId = itemStack.getDynamicProperty("deepcraft:item_id");
    if (!customId) return undefined;

    const def = EQUIPMENT_POOL[customId];
    if (!def || !def.skillId) return undefined;

    const reqCheck = checkReq(player, itemStack);
    if (!reqCheck.valid) return { error: reqCheck.missing };

    return { skillId: def.skillId };
}

export function startRightClickInput(player, itemStack) {
    const existing = rightClickStateByPlayerId.get(player.id);
    if (existing?.blockedUntilRelease) return;
    if (existing && !existing.released) return;

    const currentTick = system.currentTick;
    player.setDynamicProperty("deepcraft:input_start_tick", currentTick);

    const weaponSkillInfo = getWeaponSkillIdFromItem(player, itemStack);

    if (weaponSkillInfo?.error) {
        player.playSound("random.break", { volume: 0.3 });
        player.sendMessage(`§8» §c能力不足: ${weaponSkillInfo.error}`);
    }

    rightClickStateByPlayerId.set(player.id, {
        startTick: currentTick,
        released: false,
        holdTriggered: false,
        blockedUntilRelease: false,
        weaponSkillId: weaponSkillInfo?.skillId,
        weaponItem: itemStack,
        sawUseStart: false
    });
}

export function handleDeepcraftInputItemUse(player, itemStack) {
    if (!player || !itemStack) return false;
    const isDeepcraftItem = typeof itemStack?.typeId === "string" && itemStack.typeId.startsWith("deepcraft:");
    const customId = itemStack.getDynamicProperty("deepcraft:item_id");
    if (!isDeepcraftItem && !customId) return false;

    startRightClickInput(player, itemStack);
    return true;
}

function markRightClickUseStart(player) {
    const state = rightClickStateByPlayerId.get(player.id);
    if (!state) return;
    state.sawUseStart = true;
    rightClickStateByPlayerId.set(player.id, state);
}

function markRightClickReleased(player) {
    const state = rightClickStateByPlayerId.get(player.id);
    if (!state) return;
    state.released = true;
    rightClickStateByPlayerId.set(player.id, state);
}

function processRightClickState(player) {
    const state = rightClickStateByPlayerId.get(player.id);
    if (!state) return;

    const now = system.currentTick;
    const elapsed = now - state.startTick;

    // use_start が来ない（= アイテムが「使用状態」にならない）場合は、Tap扱いで即確定する
    if (!state.holdTriggered && !state.released && state.sawUseStart === false && elapsed >= 1 && elapsed < HOLD_TICKS) {
        pushComboInput(player, "R");
        rightClickStateByPlayerId.delete(player.id);
        return;
    }

    // Charge visuals while waiting.
    try {
        const head = player.getHeadLocation();
        const dir = player.getViewDirection();
        safeSpawnParticle(player.dimension, "minecraft:enchanting_table_particle", {
            x: head.x + dir.x * 0.6,
            y: head.y - 0.2,
            z: head.z + dir.z * 0.6
        });
    } catch (_) {}

    // fail-safe
    if (elapsed > INPUT_FAILSAFE_TICKS) {
        rightClickStateByPlayerId.delete(player.id);
        return;
    }

    // 右クリックを押している間は、始動用の表示だけ先に見せる
    if (!comboByPlayerId.has(player.id) && !state.holdTriggered) {
        const prefix = player.isSneaking ? "§eShift §7" : "";
        player.onScreenDisplay.setActionBar(prefix + "§7[ §fR §7- §f? §7- §f? §7]");
    }

    // Hold: trigger weapon art once we cross threshold.
    if (!state.holdTriggered && elapsed >= HOLD_TICKS) {
        state.holdTriggered = true;
        state.blockedUntilRelease = true;
        rightClickStateByPlayerId.set(player.id, state);

        // Discard combo buffer
        clearCombo(player);

        if (state.weaponSkillId) {
            // Hold-cast doesn't go through pushComboInput, so play R sound here.
            playInputSound(player, "R");
            executeSkill(player, state.weaponSkillId);
        } else {
            player.playSound("note.bass", { volume: 0.3, pitch: 0.9 });
        }
        return;
    }

    // Tap: only on release within threshold.
    if (state.released && !state.holdTriggered) {
        if (elapsed < HOLD_TICKS) {
            pushComboInput(player, "R");
        }
        rightClickStateByPlayerId.delete(player.id);
        return;
    }

    // After a hold, wait until release to unlock.
    if (state.released && state.holdTriggered) {
        rightClickStateByPlayerId.delete(player.id);
        return;
    }
}

function processComboTimeout(player) {
    const entry = comboByPlayerId.get(player.id);
    if (!entry) return;

    const now = system.currentTick;
    if (now - entry.lastTick > COMBO_TIMEOUT_TICKS) {
        comboByPlayerId.delete(player.id);
    }
}

export function initializeInputSystem() {
    // Right-click release detection (from animation controller)
    system.afterEvents.scriptEventReceive.subscribe((ev) => {
        if (ev.id === "deepcraft:use_start") {
            const player = ev.sourceEntity;
            if (!player || player.typeId !== "minecraft:player") return;
            markRightClickUseStart(player);
        }

        if (ev.id === "deepcraft:use_end") {
            const player = ev.sourceEntity;
            if (!player || player.typeId !== "minecraft:player") return;
            markRightClickReleased(player);
        }

        // Left click (swing)
        if (ev.id === "deepcraft:swing") {
            const player = ev.sourceEntity;
            if (!player || player.typeId !== "minecraft:player") return;
            pushComboInput(player, "L");
        }
    });

    // Tick loop
    system.runInterval(() => {
        for (const player of world.getAllPlayers()) {
            if (!player.isValid) continue;
            processRightClickState(player);
            processComboTimeout(player);
        }
    }, 1);
}
