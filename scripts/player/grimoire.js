// BP/scripts/player/grimoire.js
import { SKILL_POOL } from "../data/skills.js";

export function getDefaultGrimoire() {
    return {
        "R-R-R": "spell:fireball",
        "R-L-R": "spell:ice_shard",
        "L-L-L": "spell:thunder_smite",
        "Shift+R-R-R": "spell:target_mob"
    };
}

export function getGrimoire(player) {
    const raw = player.getDynamicProperty("deepcraft:grimoire");
    if (typeof raw === "string" && raw.length > 0) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") return parsed;
        } catch (_) {
            // fallthrough
        }
    }

    const defaults = getDefaultGrimoire();
    try {
        player.setDynamicProperty("deepcraft:grimoire", JSON.stringify(defaults));
    } catch (_) {}
    return defaults;
}

export function setGrimoire(player, grimoire) {
    try {
        player.setDynamicProperty("deepcraft:grimoire", JSON.stringify(grimoire ?? {}));
    } catch (_) {}
}

export function normalizeActionId(actionId) {
    if (typeof actionId !== "string") return undefined;
    if (actionId.startsWith("spell:")) return actionId.slice("spell:".length);
    if (actionId.startsWith("skill:")) return actionId.slice("skill:".length);
    return actionId;
}

export function actionDisplayName(actionId) {
    const normalized = normalizeActionId(actionId);
    if (!normalized) return "(未設定)";
    const skill = SKILL_POOL[normalized];
    if (!skill) return normalized;
    return skill.name ?? normalized;
}

export function listComboBases() {
    return [
        "R-R-R",
        "R-R-L",
        "R-L-R",
        "R-L-L",
        "L-R-R",
        "L-R-L",
        "L-L-R",
        "L-L-L"
    ];
}
