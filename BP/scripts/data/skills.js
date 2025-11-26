// BP/scripts/data/skills.js
import { world, system } from "@minecraft/server";

export const SKILL_POOL = {
    // 風の突進 (Gale Dash)
    "gale_dash": {
        name: "§fGale Dash",
        cooldown: 5,
        onUse: (player) => {
            const viewDir = player.getViewDirection();
            player.applyKnockback(viewDir.x, viewDir.z, 3.0, 0.5);
            player.playSound("item.trident.riptide_1");
            player.addEffect("slow_falling", 20, { showParticles: false });
            
            player.dimension.spawnParticle("minecraft:knockback_roar_particle", player.location);
            for (let i = 0; i < 5; i++) {
                system.runTimeout(() => {
                    if (player.isValid()) {
                        player.dimension.spawnParticle("minecraft:exploration_smoke_particle", player.location);
                    }
                }, i * 2);
            }
        }
    },

    // 火の玉 (Fireball) - ★修正: 雪玉ベースに変更
    "fireball": {
        name: "§cFireball",
        cooldown: 8,
        onUse: (player) => {
            const headLoc = player.getHeadLocation();
            const viewDir = player.getViewDirection();
            
            // 雪玉を召喚 (Small Fireballは召喚不可のため)
            const projectile = player.dimension.spawnEntity("minecraft:snowball", {
                x: headLoc.x + viewDir.x * 1.5,
                y: headLoc.y + viewDir.y * 1.5,
                z: headLoc.z + viewDir.z * 1.5
            });
            
            // 発射
            const projComp = projectile.getComponent("minecraft:projectile");
            if (projComp) {
                projComp.owner = player;
                projComp.shoot(viewDir, { velocity: 1.5, uncertainty: 0 });
            }

            player.playSound("mob.ghast.fireball");

            // ★追加: 炎のパーティクルを纏わせるループ処理
            // 弾が消えるか、一定時間が経つまで炎を出し続ける
            const intervalId = system.runInterval(() => {
                if (projectile && projectile.isValid()) {
                    try {
                        // 炎と溶岩のパーティクル
                        player.dimension.spawnParticle("minecraft:basic_flame_particle", projectile.location);
                        player.dimension.spawnParticle("minecraft:lava_particle", projectile.location);
                    } catch(e) {}
                } else {
                    // 弾が消えたらループ終了
                    system.clearRun(intervalId);
                }
            }, 1); // 1tickごとに実行

            // 安全策: 5秒経ったら強制終了 (無限ループ防止)
            system.runTimeout(() => system.clearRun(intervalId), 100);
        }
    },

    // 落雷 (Thunder Smite)
    "thunder_smite": {
        name: "§eThunder Smite",
        cooldown: 15,
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
                player.sendMessage("§cNo targets nearby.");
                return false; 
            }

            targets.forEach(target => {
                if (target.id !== player.id) {
                    dimension.spawnEntity("minecraft:lightning_bolt", target.location);
                    target.applyDamage(5);

                    // スパーク演出
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

            // 発射エフェクト
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
        onUse: (player) => {
            player.addEffect("regeneration", 100, { amplifier: 1 });
            player.playSound("random.levelup");
            player.sendMessage("§aHealing Aura Activated!");

            // 螺旋エフェクト
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
                    t.applyKnockback(dx, dz, 2.0, 0.5);
                }
            });
            
            player.playSound("random.explode");
            dimension.spawnParticle("minecraft:large_explosion", loc);

            // 炎のリング
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

    // ウォークライ (War Cry)
    "war_cry": {
        name: "§cWar Cry",
        cooldown: 30,
        onUse: (player) => {
            player.addEffect("strength", 200, { amplifier: 1 });
            player.addEffect("speed", 200, { amplifier: 0 });
            player.playSound("mob.ravager.roar");
            player.sendMessage("§cWAR CRY!!!");

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
    }
};