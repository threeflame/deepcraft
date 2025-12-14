// BP/scripts/player/stat_calculator.js
import { EquipmentSlot } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { EQUIPMENT_POOL } from "../data/equipment.js";
import { MOB_POOL } from "../data/mobs.js";
import { decodeLoreData, getItemId } from "../systems/lore_manager.js";

export function calculateEntityStats(entity) {
    const stats = {
        atk: 0, def: 0, 
        critChance: CONFIG.COMBAT.BASE_CRIT_CHANCE, 
        critMult: CONFIG.COMBAT.BASE_CRIT_MULT,
        speed: 1.0, 
        maxEther: CONFIG.ETHER_BASE, 
        etherRegen: CONFIG.ETHER_REGEN_BASE, 
        maxHP: 100, 
        evasion: 0,
        penetration: 0,
        magicPower: 1.0, // 魔法威力倍率 (初期値 1.0, INT依存なし)
        magicResist: 0,  // ★魔法耐性: 常に0 (Defenseで一括管理するため不要)
        details: { atk: [], def: [], critChance: [], critMult: [], hp: [], speed: [], other: [], ether: [], regen: [], evasion: [] } 
    };

    if (entity.typeId === "minecraft:player") {
        calculatePlayerStats(entity, stats);
    } else {
        calculateMobStats(entity, stats);
    }
    return stats;
}

function calculatePlayerStats(player, stats) {
    const p = (prop) => player.getDynamicProperty(prop) || 0;
    
    const str = p("deepcraft:strength");
    const fort = p("deepcraft:fortitude");
    const agi = p("deepcraft:agility");
    const int = p("deepcraft:intelligence");
    const will = p("deepcraft:willpower");
    
    const heavy = p("deepcraft:heavy");
    const medium = p("deepcraft:medium");
    const light = p("deepcraft:light");

    let level = p("deepcraft:level");
    if (level < 1) level = 1;

    const addD = (list, label, val) => {
        stats.details[list].push(`§f${label}: ${val}`);
    };

    // --- 1. HP ---
    let hp = 270 + (level * 30) + (fort * 15);
    addD('hp', 'Base+Lv', 270 + level * 30);
    addD('hp', 'Fortitude', `+${fort * 15}`);
    if (player.hasTag("talent:vitality_1")) { hp += 100; addD('hp', 'Vitality I', '+100'); }
    if (player.hasTag("talent:vitality_2")) { hp += 200; addD('hp', 'Vitality II', '+200'); }
    if (player.hasTag("talent:glass_cannon")) { hp = Math.floor(hp * 0.6); addD('hp', 'Glass Cannon', 'x0.6'); }
    stats.maxHP = Math.floor(hp);

    // --- 2. 装備 ---
    const equip = player.getComponent("equippable");
    const mainHandItem = equip ? equip.getEquipmentSlot(EquipmentSlot.Mainhand).getItem() : undefined;
    const equipStats = getEquipmentStats(mainHandItem);
    
    let equipDef = 0;
    if (equip) {
        [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand].forEach(slot => {
            equipDef += getEquipmentStats(equip.getEquipmentSlot(slot).getItem()).def;
        });
    }

    // --- 3. 物理攻撃力 (ATK) ---
    let atk = equipStats.atk + (level * 3) + (str * 0.2);
    
    addD('atk', 'Weapon', equipStats.atk);
    addD('atk', 'Level Bonus', `+${level * 3}`);
    addD('atk', 'Strength', `+${Math.floor(str * 0.2)}`);

    if (medium > 0) {
        const bonus = 1.0 + (medium * 0.005);
        atk *= bonus;
        addD('atk', 'Medium Mastery', `x${bonus.toFixed(2)}`);
    }

    if (player.hasTag("talent:brute_force")) { atk += 15; addD('atk', 'Brute Force', '+15'); }
    
    // タレント補正 (物理・魔法共通)
    if (player.hasTag("talent:glass_cannon")) { 
        atk *= 1.3; 
        stats.magicPower *= 1.3; 
        addD('atk', 'Glass Cannon', 'x1.3'); 
        addD('other', 'Magic: Glass Cannon', 'x1.3');
    }
    if (player.hasTag("talent:berserker")) {
        const currentHP = player.getDynamicProperty("deepcraft:hp") || 1;
        if (currentHP / stats.maxHP <= 0.3) {
            atk *= 1.5;
            stats.magicPower *= 1.5;
            addD('atk', 'Berserker', 'x1.5');
            addD('other', 'Magic: Berserker', 'x1.5');
        }
    }
    if (player.hasTag("talent:assassin") && player.isSneaking) {
        atk *= 2.0;
        stats.magicPower *= 2.0;
        addD('atk', 'Assassin', 'x2.0');
        addD('other', 'Magic: Assassin', 'x2.0');
    }

    stats.atk = Math.floor(atk);

    // スケーリング (物理のみ)
    if (mainHandItem) {
        const weaponId = getItemId(mainHandItem);
        if (weaponId && EQUIPMENT_POOL[weaponId]) {
            const def = EQUIPMENT_POOL[weaponId];
            if (def.scaling) {
                for (const [statKey, scaleVal] of Object.entries(def.scaling)) {
                    const statVal = p(`deepcraft:${statKey}`);
                    if (statVal > 0) {
                        const bonus = statVal * (scaleVal / 10);
                        addD('atk', `Scale (${CONFIG.STATS[statKey]})`, `+${bonus.toFixed(1)}`);
                        stats.atk += bonus; 
                    }
                }
            }
        }
    }
    stats.atk = Math.floor(stats.atk);

    // --- 4. 防御スコア (DEF) ---
    let defScore = equipDef + (level * 4) + (fort * 2);
    addD('def', 'Armor', equipDef);
    addD('def', 'Level Bonus', `+${level * 4}`);
    addD('def', 'Fortitude', `+${fort * 2}`);
    
    if (player.hasTag("talent:iron_wall")) { defScore += 30; addD('def', 'Iron Wall', '+30'); }
    if (player.hasTag("talent:last_stand")) {
        const currentHP = player.getDynamicProperty("deepcraft:hp") || 1;
        if (currentHP / stats.maxHP <= 0.3) {
            defScore += 50;
            addD('def', 'Last Stand', '+50');
        }
    }
    stats.def = Math.floor(defScore);

    // --- 5. クリティカル ---
    let crit = CONFIG.COMBAT.BASE_CRIT_CHANCE + (light * 0.003) + (agi * 0.001);
    addD('critChance', 'Base', `${(CONFIG.COMBAT.BASE_CRIT_CHANCE * 100).toFixed(1)}%`);
    if (light > 0) addD('critChance', 'Light Mastery', `+${(light * 0.3).toFixed(1)}%`);
    if (agi > 0) addD('critChance', 'Agility', `+${(agi * 0.1).toFixed(1)}%`);
    if (player.hasTag("talent:eagle_eye")) { crit += 0.15; addD('critChance', 'Eagle Eye', '+15.0%'); }
    stats.critChance = Math.min(crit, 1.0);
    addD('critMult', 'Base', `x${stats.critMult.toFixed(1)}`);

    stats.penetration = Math.min(heavy * 0.005, 0.6);
    if (heavy > 0) addD('other', 'Penetration (Heavy)', `${(stats.penetration * 100).toFixed(1)}%`);
    
    // --- 6. エーテル関連 ---
    stats.maxEther += (int * 5);
    addD('ether', 'Base', CONFIG.ETHER_BASE);
    addD('ether', 'Intelligence', `+${int * 5}`);

    // ★修正: IntelligenceによるMagic Power増加を完全削除 (常に1.0 + タレント補正のみ)
    // stats.magicPower = 1.0; 

    const willRegen = will * CONFIG.ETHER_REGEN_PER_WILL;
    stats.etherRegen += willRegen;
    addD('regen', 'Base', CONFIG.ETHER_REGEN_BASE);
    addD('regen', 'Willpower', `+${willRegen.toFixed(1)}`);

    // ★修正: 魔法耐性ボーナスを完全削除
    stats.magicResist = 0;

    // Speed / Evasion
    stats.speed = 1.0 + (agi * 0.002);
    addD('speed', 'Base', '100%');
    if (agi > 0) addD('speed', 'Agility', `+${(agi * 0.2).toFixed(1)}%`);
    if (player.hasTag("talent:swift_1")) { stats.speed += 0.05; addD('speed', 'Swift I', '+5%'); }
    if (player.hasTag("talent:godspeed")) { stats.speed += 0.15; addD('speed', 'Godspeed', '+15%'); }
    if (player.hasTag("debuff:heavy_armor")) { stats.speed -= 0.1; addD('speed', 'Heavy Armor', '-10%'); }

    stats.evasion = Math.min(agi * 0.002, 0.3);
    if (agi > 0) addD('evasion', 'Agility', `${(stats.evasion * 100).toFixed(1)}%`);
    if (player.hasTag("talent:evasion")) { stats.evasion += 0.1; addD('evasion', 'Evasion', '+10%'); }
}

function calculateMobStats(mob, stats) {
    let maxHP = mob.getDynamicProperty("deepcraft:max_hp");
    let atk = mob.getDynamicProperty("deepcraft:atk");

    if (maxHP === undefined) {
        const bossId = mob.getDynamicProperty("deepcraft:boss_id");
        if (bossId && MOB_POOL[bossId]) {
            maxHP = MOB_POOL[bossId].health;
            atk = 50; 
        } else {
            const hpComp = mob.getComponent("minecraft:health");
            maxHP = hpComp ? hpComp.effectiveMax * 10 : 200;
            atk = 40;
        }
        mob.setDynamicProperty("deepcraft:max_hp", maxHP);
        mob.setDynamicProperty("deepcraft:hp", maxHP);
        mob.setDynamicProperty("deepcraft:atk", atk);
    }
    stats.maxHP = maxHP || 200;
    stats.atk = atk || 40;
    stats.def = 50; 
}

export function getEquipmentStats(itemStack) {
    if (!itemStack) return { atk: 0, def: 0 };
    const id = getItemId(itemStack);
    if (!id) return { atk: 0, def: 0 };
    const def = EQUIPMENT_POOL[id];
    if (!def || !def.stats) return { atk: 0, def: 0 };
    return def.stats;
}