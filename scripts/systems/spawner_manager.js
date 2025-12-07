// BP/scripts/systems/spawner_manager.js
import { world, system } from "@minecraft/server";
import { MOB_POOL } from "../data/mobs.js";
import { calculateEntityStats } from "../player/stat_calculator.js";
import { updateMobNameTag } from "./mob_manager.js";

/**
 * スポナーを設置する
 */
export function setupSpawner(player, mobId, respawnTime = 60, radius = 16) {
    if (!MOB_POOL[mobId]) {
        player.sendMessage(`§c無効なMobIDです: ${mobId}`);
        return;
    }

    try {
        const spawnPos = {
            x: Math.floor(player.location.x) + 0.5,
            y: player.location.y, 
            z: Math.floor(player.location.z) + 0.5
        };

        const marker = player.dimension.spawnEntity("deepcraft:spawner_marker", spawnPos);
        
        marker.setDynamicProperty("spawner:mob_id", mobId);
        marker.setDynamicProperty("spawner:respawn_time", respawnTime);
        marker.setDynamicProperty("spawner:radius", radius);
        marker.setDynamicProperty("spawner:next_spawn_at", 0); 

        marker.nameTag = " "; 
        
        player.sendMessage(`§aスポナーを設置しました。\nMob: ${mobId}, Time: ${respawnTime}s, Radius: ${radius}m`);
        player.playSound("random.orb");

    } catch (e) {
        player.sendMessage(`§c設置エラー: ${e}`);
    }
}

/**
 * 近くのスポナーを削除する
 */
export function removeNearbySpawners(player, radius = 2) {
    const dimension = player.dimension;
    const markers = dimension.getEntities({
        type: "deepcraft:spawner_marker",
        location: player.location,
        maxDistance: radius
    });

    if (markers.length === 0) {
        player.sendMessage("§c近くにスポナーが見つかりません。");
        return;
    }

    let count = 0;
    markers.forEach(marker => {
        dimension.spawnParticle("minecraft:large_explosion", marker.location);
        marker.remove();
        count++;
    });

    player.sendMessage(`§e${count} 個のスポナーを撤去しました。`);
    player.playSound("random.break");
}

/**
 * [変更] スポナーのデバッグ表示を切り替える (グローバル)
 */
export function toggleSpawnerDebug(player) {
    const current = world.getDynamicProperty("deepcraft:global_debug") || false;
    const newState = !current;
    world.setDynamicProperty("deepcraft:global_debug", newState);
    
    const status = newState ? "§aON (全員可視)" : "§cOFF";
    player.sendMessage(`§7[Spawner] グローバルデバッグ表示: ${status}`);
    if (newState) player.playSound("random.orb");
    else player.playSound("random.click");
}

/**
 * メインループ処理
 */
export function runSpawnerLoop() {
    system.runInterval(() => {
        try {
            // ★変更: 全体フラグを確認
            const isDebugMode = world.getDynamicProperty("deepcraft:global_debug") || false;
            
            const markers = world.getDimension("overworld").getEntities({ type: "deepcraft:spawner_marker" });
            const now = Date.now();

            for (const marker of markers) {
                if (!marker.isValid) continue;

                const mobId = marker.getDynamicProperty("spawner:mob_id");
                const respawnTime = marker.getDynamicProperty("spawner:respawn_time") || 60;
                const radius = marker.getDynamicProperty("spawner:radius") || 16;
                const nextSpawnAt = marker.getDynamicProperty("spawner:next_spawn_at") || 0;
                const activeMobId = marker.getDynamicProperty("spawner:active_mob_id");

                // --- A. 生存確認 ---
                let isActive = false;
                if (activeMobId) {
                    const mob = world.getEntity(activeMobId);
                    if (mob && mob.isValid) {
                        isActive = true;
                    } else {
                        if (nextSpawnAt === 0) { 
                            marker.setDynamicProperty("spawner:next_spawn_at", now + (respawnTime * 1000));
                            marker.setDynamicProperty("spawner:active_mob_id", undefined);
                        }
                    }
                }

                // --- B. スポーン実行 ---
                if (!isActive && now >= nextSpawnAt) {
                    const players = marker.dimension.getPlayers({ location: marker.location, maxDistance: radius });
                    if (players.length > 0) {
                        spawnMob(marker, mobId);
                    }
                }

                // --- C. デバッグ表示 (グローバル) ---
                if (isDebugMode) {
                    // 近くに誰か（プレイヤー）がいる場合のみ描画して負荷軽減
                    // Adminでなくても見えるようにする
                    const viewers = marker.dimension.getPlayers({ location: marker.location, maxDistance: 32 });
                    
                    if (viewers.length > 0) {
                         const particlePos = {
                            x: marker.location.x,
                            y: marker.location.y + 0.5, 
                            z: marker.location.z
                        };
                        
                        // ★変更: dimension.spawnParticle を使用して全員に見せる
                        try {
                            marker.dimension.spawnParticle("minecraft:basic_flame_particle", particlePos);
                            marker.dimension.spawnParticle("minecraft:villager_happy", particlePos);
                        } catch(e){}

                        let statusText = `§e[${mobId}]\n`;
                        if (isActive) {
                            statusText += "§aActive";
                        } else if (now < nextSpawnAt) {
                            const remain = Math.ceil((nextSpawnAt - now) / 1000);
                            statusText += `§cRespawn in ${remain}s`;
                        } else {
                            statusText += "§bReady";
                        }
                        marker.nameTag = statusText;
                    }
                } else {
                    marker.nameTag = " ";
                }
            }
        } catch (e) { }
    }, 20); 
}

function spawnMob(marker, mobId) {
    const def = MOB_POOL[mobId];
    if (!def) return;

    try {
        const mob = marker.dimension.spawnEntity(def.type, marker.location);
        
        mob.addTag("deepcraft:boss"); 
        mob.setDynamicProperty("deepcraft:boss_id", mobId);
        
        calculateEntityStats(mob);
        updateMobNameTag(mob);

        marker.setDynamicProperty("spawner:active_mob_id", mob.id);
        marker.setDynamicProperty("spawner:next_spawn_at", 0);

        marker.dimension.spawnParticle("minecraft:obsidian_glow_dust_particle", marker.location);

    } catch (e) {
        console.warn(`Spawn Failed: ${e}`);
    }
}