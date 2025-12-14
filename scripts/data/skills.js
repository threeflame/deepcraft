// BP/scripts/data/skills.js
import { world, system, EntityDamageCause } from "@minecraft/server";
import { updateMobNameTag } from "../systems/mob_manager.js";
import { getAffiliationId } from "../combat/combat_system.js";
import { findNearbyEnemies, applySkillDamage } from "../combat/combat_system.js";

// --- Helper for LOS Targeting ---
// (他のスキルで使う可能性があるため関数定義は残しておきます)
function findTargetInLos(player, maxDistance, targetType) {
    const targets = player.dimension.getEntities({ 
        location: player.location,
        maxDistance: maxDistance,
        excludeTypes: ["minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:snowball"] 
    });

    const playerViewVector = player.getViewDirection();
    const playerLoc = player.getHeadLocation(); 
    let closestTarget = null;
    let maxAlignment = 0.8; 

    const playerPartyId = player.getDynamicProperty("deepcraft:party_id");

    for (const target of targets) {
        if (target.id === player.id || !target.isValid) continue;
        const collisionBox = target.getComponent('minecraft:collision_box');
        if (!collisionBox) continue;
        const targetAffiliationId = getAffiliationId(target);
        if (playerPartyId && targetAffiliationId && playerPartyId === targetAffiliationId) continue; 
        if (targetType === "mob" && target.typeId === "minecraft:player") continue;
        if (targetType === "player" && target.typeId !== "minecraft:player") continue;

        const dx = target.location.x - playerLoc.x;
        const dy = (target.location.y + collisionBox.height / 2) - playerLoc.y;
        const dz = target.location.z - playerLoc.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist === 0) continue;

        const vectorToTarget = { x: dx / dist, y: dy / dist, z: dz / dist };
        const alignment = playerViewVector.x * vectorToTarget.x + playerViewVector.y * vectorToTarget.y + playerViewVector.z * vectorToTarget.z;

        if (alignment > maxAlignment) {
            maxAlignment = alignment;
            closestTarget = target;
        }
    }
    return closestTarget;
}

export const SKILL_POOL = {
    "earth_ascension": {
        name: "§6Earth Ascension",
        cooldown: 8,
        manaCost: 20,
        onUse: (player) => {
            // 1行でターゲット取得（パーティ除外・近い順）
            const targets = findNearbyEnemies(player, 10, 1);
            const target = targets[0];

            if (!target) {
                // 自分のみに聞こえるエラー音
                player.playSound("note.bass", { volume: 1.0, pitch: 0.5 });
                return false;
            }

            // 発動音 (音量1.0)
            player.playSound("mob.shulker.bullet_hit", { volume: 1.0, pitch: 1.0 });

            // 即時浮遊開始
            try { target.clearVelocity(); } catch(e){}
            target.applyImpulse({ x: 0, y: 0.1, z: 0 }); 

            // 浮遊ループ
            let ticks = 0;
            const liftId = system.runInterval(() => {
                if (!target.isValid) { system.clearRun(liftId); return; }

                // ふわっと浮く
                target.applyImpulse({ x: 0, y: 0.12, z: 0 });

                // 土パーティクル
                const angle = (ticks / 10) * Math.PI * 2;
                const r = 1.0;
                player.dimension.spawnParticle("minecraft:falling_dust_red_sand_particle", {
                    x: target.location.x + Math.cos(angle) * r,
                    y: target.location.y + (ticks * 0.05),
                    z: target.location.z + Math.sin(angle) * r
                });

                ticks++;
                if (ticks >= 20) {
                    system.clearRun(liftId);
                    if (target.isValid) {
                        // ★修正: 共通関数で「確実に仮想HPを削る」
                        applySkillDamage(player, target, 10);
                        
                        // 叩きつけ
                        target.applyImpulse({ x: 0, y: -1.5, z: 0 });
                        
                        // インパクト音 (音量1.0)
                        player.playSound("random.heavy_hit", { volume: 1.0 });
                        player.dimension.spawnParticle("minecraft:knockback_roar_particle", target.location);
                    }
                }
            }, 1);
            return true;
        }
    },

    // 火の玉 (Fireball)
    "fireball": {
        name: "§cFireball",
        cooldown: 8,
        manaCost: 25,
        onUse: (player) => {
            const headLoc = player.getHeadLocation();
            const viewDir = player.getViewDirection();
            
            const projectile = player.dimension.spawnEntity("minecraft:snowball", {
                x: headLoc.x + viewDir.x * 1.5,
                y: headLoc.y + viewDir.y * 1.5,
                z: headLoc.z + viewDir.z * 1.5
            });
            
            const projComp = projectile.getComponent("minecraft:projectile");
            if (projComp) {
                projComp.owner = player;
                projComp.shoot(viewDir, { velocity: 1.5, uncertainty: 0 });
            }

            player.playSound("mob.ghast.fireball");

            const intervalId = system.runInterval(() => {
                if (projectile && projectile.isValid()) {
                    try {
                        player.dimension.spawnParticle("minecraft:basic_flame_particle", projectile.location);
                        player.dimension.spawnParticle("minecraft:lava_particle", projectile.location);
                    } catch(e) {}
                } else {
                    system.clearRun(intervalId);
                }
            }, 1);
            system.runTimeout(() => system.clearRun(intervalId), 100);
        }
    },

    // 落雷 (Thunder Smite)
    "thunder_smite": {
        name: "§eThunder Smite",
        cooldown: 15,
        manaCost: 40,
        onUse: (player) => {
            const dimension = player.dimension;
            const loc = player.location;
            const options = {
                location: loc,
                maxDistance: 6,
                excludeFamilies: ["player"], 
                excludeTypes: ["minecraft:item", "minecraft:xp_orb"]
            };

            const targets = dimension.getEntities(options);
            
            if (targets.length === 0) {
                player.sendMessage("§8» §c近くに対象がいません。");
                return false;
            }

            targets.forEach(target => {
                if (target.id !== player.id) {
                    dimension.spawnEntity("minecraft:lightning_bolt", target.location);
                    target.applyDamage(5);
                    for(let i=0; i<8; i++) {
                        try {
                            dimension.spawnParticle("minecraft:endrod", {
                                x: target.location.x + (Math.random() - 0.5) * 2,
                                y: target.location.y + Math.random() * 2,
                                z: target.location.z + (Math.random() - 0.5) * 2
                            });
                        } catch(e){}
                    }
                }
            });
            player.playSound("item.trident.thunder");
        }
    },

    // 氷の弾丸 (Ice Shard)
    "ice_shard": {
        name: "§bIce Shard",
        cooldown: 3,
        manaCost: 10,
        onUse: (player) => {
            const headLoc = player.getHeadLocation();
            const viewDir = player.getViewDirection();
            
            const snowball = player.dimension.spawnEntity("minecraft:snowball", {
                x: headLoc.x + viewDir.x * 1.5,
                y: headLoc.y + viewDir.y * 1.5,
                z: headLoc.z + viewDir.z * 1.5
            });
            
            const proj = snowball.getComponent("minecraft:projectile");
            if (proj) {
                proj.owner = player;
                proj.shoot(viewDir, { velocity: 2.0, uncertainty: 0 });
            }
            player.playSound("random.bow");

            player.dimension.spawnParticle("minecraft:snowflake_particle", headLoc);
            player.dimension.spawnParticle("minecraft:snowballpoof_particle", {
                x: headLoc.x + viewDir.x,
                y: headLoc.y + viewDir.y,
                z: headLoc.z + viewDir.z
            });
        }
    },

    // 癒やしの波動 (Healing Aura)
    "healing_aura": {
        name: "§aHealing Aura",
        cooldown: 20,
        manaCost: 50,
        onUse: (player) => {
            player.addEffect("regeneration", 100, { amplifier: 1 });
            player.playSound("random.levelup");
            player.sendMessage("§8» §a癒やしの波動発動！");

            const steps = 20;
            for(let i=0; i<steps; i++) {
                system.runTimeout(() => {
                    if (!player.isValid()) return;
                    const angle = (i / 3) * Math.PI * 2;
                    const r = 1.2;
                    const pX = player.location.x + Math.cos(angle) * r;
                    const pY = player.location.y + (i * 0.1); 
                    const pZ = player.location.z + Math.sin(angle) * r;
                    try {
                        player.dimension.spawnParticle("minecraft:heart_particle", { x: pX, y: pY, z: pZ });
                        player.dimension.spawnParticle("minecraft:villager_happy", { x: pX, y: pY, z: pZ });
                    } catch(e){}
                }, i);
            }
        }
    },

    // グランドスマッシュ (Ground Smash)
    "ground_smash": {
        name: "§6Ground Smash",
        cooldown: 12,
        manaCost: 30,
        onUse: (player) => {
            const dimension = player.dimension;
            const loc = player.location;
            const radius = 5;

            const options = { location: loc, maxDistance: radius, excludeFamilies: ["player"] };
            const targets = dimension.getEntities(options);
            
            targets.forEach(t => {
                if (t.id !== player.id) {
                    t.applyDamage(8);
                    const dx = t.location.x - loc.x;
                    const dz = t.location.z - loc.z;
                    // 新API: applyKnockback(Vector3, horizontalStrength)
                    t.applyKnockback({ x: dx, y: 0.5, z: dz }, 2.0);
                }
            });
            
            player.playSound("random.explode");
            dimension.spawnParticle("minecraft:large_explosion", loc);

            for (let i = 0; i < 20; i++) {
                const angle = (i / 20) * Math.PI * 2;
                const x = loc.x + Math.cos(angle) * radius;
                const z = loc.z + Math.sin(angle) * radius;
                try {
                    dimension.spawnParticle("minecraft:basic_flame_particle", { x: x, y: loc.y + 0.5, z: z });
                    dimension.spawnParticle("minecraft:basic_smoke_particle", { x: x*0.8 + loc.x*0.2, y: loc.y+0.5, z: z*0.8 + loc.z*0.2 });
                } catch (e) {}
            }
        }
    },

    "raise_dead": {
        name: "§5Raise Dead",
        cooldown: 20,
        manaCost: 60,
        onUse: (player) => {
            const dimension = player.dimension;
            const loc = player.location;
            
            const existingMinions = dimension.getEntities({ 
                tags: [`owner:${player.id}`, "deepcraft:minion"] 
            });
            if (existingMinions.length >= 3) {
                player.sendMessage("§8» §cこれ以上召喚できません。");
                return false;
            }

            // ★ステータス計算 (プレイヤーの能力依存)
            const intelligence = player.getDynamicProperty("deepcraft:intelligence") || 0;
            const charisma = player.getDynamicProperty("deepcraft:charisma") || 0;
            
            // HP: 基礎20 + (INT * 2)
            const minionMaxHP = 20 + (intelligence * 2);
            // ATK: 基礎5 + (CHA * 0.5)
            const minionAtk = 5 + Math.floor(charisma * 0.5);

            for (let i = 0; i < 2; i++) {
                if (existingMinions.length + i >= 3) break;

                const spawnPos = {
                    x: loc.x + (Math.random() - 0.5) * 3,
                    y: loc.y,
                    z: loc.z + (Math.random() - 0.5) * 3
                };

                try {
                    const minion = dimension.spawnEntity("deepcraft:minion_zombie", spawnPos);
                    
                    const tameComp = minion.getComponent("minecraft:tameable");
                    if (tameComp) tameComp.tame(player);

                    minion.addTag("deepcraft:minion");
                    minion.addTag(`owner:${player.id}`);
                    minion.setDynamicProperty("deepcraft:owner_id", player.id);
                    minion.setDynamicProperty("deepcraft:owner_name", player.name);
                    
                    // ★ここが重要: 仮想ステータスの初期化
                    minion.setDynamicProperty("deepcraft:max_hp", minionMaxHP);
                    minion.setDynamicProperty("deepcraft:hp", minionMaxHP);
                    minion.setDynamicProperty("deepcraft:atk", minionAtk); // 攻撃力を保存

                    // HPバーの即時反映
                    updateMobNameTag(minion);

                    // 出現エフェクト
                    dimension.spawnParticle("minecraft:evoker_spell", spawnPos);
                    dimension.playSound("mob.zombie.say", spawnPos);

                } catch (e) {
                    player.sendMessage("§8» §c召喚失敗: " + e);
                }
            }
            
            return true;
        }
    },

    // ウォークライ (War Cry)
    "war_cry": {
        name: "§cWar Cry",
        cooldown: 30,
        manaCost: 45,
        onUse: (player) => {
            player.addEffect("strength", 200, { amplifier: 1 });
            player.addEffect("speed", 200, { amplifier: 0 });
            player.playSound("mob.ravager.roar");
            player.sendMessage("§8» §cウォークライ！！！");

            const loc = player.location;
            for(let i=0; i<10; i++) {
                player.dimension.spawnParticle("minecraft:lava_particle", {
                    x: loc.x + (Math.random() - 0.5),
                    y: loc.y + 1.0 + (Math.random() - 0.5),
                    z: loc.z + (Math.random() - 0.5)
                });
            }
            for(let i=0; i<8; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = 2.0;
                player.dimension.spawnParticle("minecraft:note_particle", {
                    x: loc.x + Math.cos(angle) * r,
                    y: loc.y + 1.5,
                    z: loc.z + Math.sin(angle) * r
                });
            }
        }
    },
    // 【検証用】パーティ保護テスト (Party Safe Test)
    "party_safe_test": {
        name: "§bParty Safe Test",
        cooldown: 2,
        manaCost: 0,
        onUse: (player) => {
            const dimension = player.dimension;
            const loc = player.location;
            
            // 1. 検索設定 (プレイヤーも対象に含めるため excludeFamilies は設定しない)
            const options = {
                location: loc,
                maxDistance: 10,
                excludeTypes: ["minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:snowball"]
            };
            
            const targets = dimension.getEntities(options);
            const myPartyId = player.getDynamicProperty("deepcraft:party_id");
            
            let foundTarget = false;

            targets.forEach(target => {
                if (target.id === player.id) return; // 自分自身は除外

                // 2. パーティ判定ロジック
                let isAlly = false;
                if (target.typeId === "minecraft:player") {
                    const targetPartyId = target.getDynamicProperty("deepcraft:party_id");
                    // 自分も相手もパーティに入っており、かつIDが一致する場合
                    if (myPartyId && targetPartyId && targetPartyId === myPartyId) {
                        isAlly = true;
                    }
                }

                // 3. 結果の実行
                if (isAlly) {
                    // --- 味方の場合 (防いだ) ---
                    player.sendMessage(`§8» §a${target.name} はパーティメンバーのため保護。`);
                    // 安全を示す緑のパーティクル
                    dimension.spawnParticle("minecraft:villager_happy", target.location);
                } else {
                    // --- 敵の場合 (防がない) ---
                    target.applyDamage(5);
                    // 新API: applyKnockback(Vector3, horizontalStrength)
                    target.applyKnockback({ x: 0, y: 0.3, z: 0 }, 0.5);
                    // 攻撃を示す爆発パーティクル
                    dimension.spawnParticle("minecraft:huge_explosion_emitter", target.location);
                    
                    if (target.typeId === "minecraft:player") {
                        player.sendMessage(`§8» §c${target.name} に命中！`);
                    }
                }
                foundTarget = true;
            });

            if (foundTarget) {
                player.playSound("random.orb"); // 発動音
                return true;
            } else {
                player.sendMessage("§8» §7範囲内に誰もいません。");
                return false;
            }
        }
    }

    // --- Debug/Test Spells (chat only) ---
    ,"test_spell_01": {
        name: "§dTest Spell 01",
        cooldown: 0,
        manaCost: 0,
        onUse: (player) => {
            player.sendMessage("§8» Test Spell 01");
            return false;
        }
    }
    ,"test_spell_02": {
        name: "§dTest Spell 02",
        cooldown: 0,
        manaCost: 0,
        onUse: (player) => {
            player.sendMessage("§8» Test Spell 02");
            return false;
        }
    }
    ,"test_spell_03": {
        name: "§dTest Spell 03",
        cooldown: 0,
        manaCost: 0,
        onUse: (player) => {
            player.sendMessage("§8» Test Spell 03");
            return false;
        }
    }
    ,"test_spell_04": {
        name: "§dTest Spell 04",
        cooldown: 0,
        manaCost: 0,
        onUse: (player) => {
            player.sendMessage("§8» Test Spell 04");
            return false;
        }
    }
    ,"test_spell_05": {
        name: "§dTest Spell 05",
        cooldown: 0,
        manaCost: 0,
        onUse: (player) => {
            player.sendMessage("§8» Test Spell 05");
            return false;
        }
    }
    ,"test_spell_06": {
        name: "§dTest Spell 06",
        cooldown: 0,
        manaCost: 0,
        onUse: (player) => {
            player.sendMessage("§8» Test Spell 06");
            return false;
        }
    }
    ,"test_spell_07": {
        name: "§dTest Spell 07",
        cooldown: 0,
        manaCost: 0,
        onUse: (player) => {
            player.sendMessage("§8» Test Spell 07");
            return false;
        }
    }
    ,"test_spell_08": {
        name: "§dTest Spell 08",
        cooldown: 0,
        manaCost: 0,
        onUse: (player) => {
            player.sendMessage("§8» Test Spell 08");
            return false;
        }
    }
    ,"test_spell_09": {
        name: "§dTest Spell 09",
        cooldown: 0,
        manaCost: 0,
        onUse: (player) => {
            player.sendMessage("§8» Test Spell 09");
            return false;
        }
    }
    ,"test_spell_10": {
        name: "§dTest Spell 10",
        cooldown: 0,
        manaCost: 0,
        onUse: (player) => {
            player.sendMessage("§8» Test Spell 10");
            return false;
        }
    }
};

