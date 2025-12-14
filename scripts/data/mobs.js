// BP/scripts/data/mobs.js

export const MOB_POOL = {
    // --- 一般Mob & ダミー ---
    "training_dummy": {
        name: "§e§lTraining Dummy",
        type: "minecraft:husk",      
        health: 1000,                
        scale: 1.0,
        isDummy: true,
        equipment: {},
        drops: [
            { type: "xp", amount: 10 } 
        ],
        skills: []
    },

    "goblin": {
        name: "§aGoblin",
        type: "minecraft:husk", 
        health: 30,            
        scale: 0.8,     
        speed: 0.25,
        equipment: {
            mainhand: "trainee_sword" 
        },
        drops: [
            { type: "xp", amount: 50 },
            { type: "item", id: "goblin_ear", chance: 0.5, sellable: true, amount: 1 },
            { type: "item", id: "trainee_sword", chance: 0.05 } 
        ],
        skills: []
    },

    // --- ボス ---
    "bandit_leader": {
        name: "§c§lBandit Leader",
        type: "minecraft:husk", 
        health: 60, 
        scale: 1.1, 
        speed: 0.3, 
        equipment: {
            mainhand: "soldier_blade",
            head: "minecraft:iron_helmet",
            chest: "minecraft:leather_chestplate",
            legs: "minecraft:iron_leggings",
            feet: "minecraft:leather_boots"
        },
        drops: [
            { type: "xp", amount: 500 },
            { type: "item", id: "soldier_blade", chance: 0.3 },
            { type: "item", id: "thief_dagger", chance: 0.3 }
        ],
        skills: [
            {
                id: "summon_minions",
                chance: 0.05, 
                msg: "§cMinions, aid me!",
                action: (entity) => {
                    entity.dimension.spawnEntity("minecraft:zombie", entity.location);
                    entity.dimension.spawnEntity("minecraft:zombie", entity.location);
                    entity.dimension.playSound("mob.zombie.say", entity.location);
                }
            }
        ]
    },

    "corrupted_knight": {
        name: "§4§lCorrupted Knight",
        type: "minecraft:zombie_pigman", 
        health: 150,
        scale: 1.2,
        speed: 0.25,
        equipment: {
            mainhand: "heavy_claymore",
            head: "minecraft:netherite_helmet",
            chest: "minecraft:netherite_chestplate",
            legs: "minecraft:netherite_leggings",
            feet: "minecraft:netherite_boots"
        },
        drops: [
            { type: "xp", amount: 1500 },
            { type: "item", id: "heavy_claymore", chance: 0.2 },
            { type: "item", id: "battle_axe", chance: 0.3 }
        ],
        skills: [
            {
                id: "charge",
                chance: 0.08,
                msg: "§4§lCHARGE!",
                action: (entity) => {
                    const view = entity.getViewDirection();
                    // 新API: applyKnockback(Vector3, horizontalStrength)
                    entity.applyKnockback({ x: view.x, y: 0.0, z: view.z }, 5.0); 
                    entity.addEffect("speed", 60, { amplifier: 4 });
                    entity.dimension.playSound("mob.ravager.roar", entity.location);
                }
            },
            {
                id: "ground_smash",
                chance: 0.05,
                msg: "§cCRUSH!",
                action: (entity) => {
                    entity.dimension.spawnParticle("minecraft:large_explosion", entity.location);
                    entity.dimension.playSound("random.explode", entity.location);
                    
                    const players = entity.dimension.getPlayers({ location: entity.location, maxDistance: 5 });
                    players.forEach(p => {
                        p.applyDamage(10);
                        // 新API: applyKnockback(Vector3, horizontalStrength)
                        p.applyKnockback({ x: 0, y: 0.5, z: 0 }, 3);
                    });
                }
            }
        ]
    },

    "elder_lich": {
        name: "§5§lElder Lich",
        type: "minecraft:stray", 
        health: 100,
        scale: 1.0,
        speed: 0.2,
        equipment: {
            mainhand: "spell_blade",
            head: "minecraft:golden_helmet",
            chest: "minecraft:golden_chestplate"
        },
        drops: [
            { type: "xp", amount: 2500 },
            { type: "item", id: "spell_blade", chance: 0.25 },
            { type: "item", id: "flame_sword", chance: 0.1 }
        ],
        skills: [
            {
                id: "fireball_barrage",
                chance: 0.1, 
                msg: "§5Burn to ash...",
                action: (entity) => {
                    for(let i=0; i<3; i++) {
                        const fb = entity.dimension.spawnEntity("minecraft:small_fireball", {
                            x: entity.location.x, y: entity.location.y + 2, z: entity.location.z
                        });
                        fb.applyImpulse({ x: (Math.random()-0.5)*2, y: (Math.random()-0.5)*2, z: (Math.random()-0.5)*2 });
                    }
                    entity.dimension.playSound("mob.ghast.shoot", entity.location);
                }
            },
            {
                id: "ice_nova",
                chance: 0.05,
                msg: "§bFreeze!",
                action: (entity) => {
                    entity.dimension.spawnParticle("minecraft:snowflake_particle", entity.location);
                    const players = entity.dimension.getPlayers({ location: entity.location, maxDistance: 8 });
                    players.forEach(p => {
                        p.addEffect("slowness", 100, { amplifier: 3 });
                        p.applyDamage(5);
                    });
                    entity.dimension.playSound("random.glass", entity.location);
                }
            }
        ]
    }
};