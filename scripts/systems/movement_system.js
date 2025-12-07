// BP/scripts/systems/movement_system.js
import { system, world, InputButton, ButtonState } from "@minecraft/server";

// 各プレイヤーの状態記録用マップ
const lastJumpState = new Map();
const lastGroundedState = new Map(); // ★追加: 前回の接地状態を記録

/**
 * 移動系アクションの監視ループ
 */
export function runMovementLoop() {
    // 1tickごとに監視
    system.runInterval(() => {
        for (const player of world.getAllPlayers()) {
            if (!player.isValid) continue;

            const isGrounded = player.isOnGround;
            const hasUsedTag = player.hasTag("deepcraft:used_air_dash");

            // --- 1. リセット判定 ---
            if (isGrounded && hasUsedTag) {
                player.removeTag("deepcraft:used_air_dash");
            }

            if (hasUsedTag && !isGrounded) {
                const velocity = player.getVelocity();
                if (velocity.y < -0.5) { // ある程度の速度で落下している
                    // 足元から少し下をチェック
                    const dimension = player.dimension;
                    const loc = player.location;
                    
                    // 簡易的な着地予測: 足元3マス以内にブロックがあるか？
                    // (Raycastの代わりにgetBlockFromRayを使うと負荷が軽い)
                    const hitBlock = dimension.getBlockFromRay(loc, {x:0, y:-1, z:0}, { maxDistance: 3, includeLiquidBlocks: false });
                    
                    if (hitBlock) {
                        // もうすぐ着地するので、一瞬だけSlow Fallingをつけてバニラの落下判定を無効化する
                        // これにより「ベチッ」という音が消える
                        player.addEffect("slow_falling", 3 , { amplifier: 0, showParticles: false });
                    }
                }
            }
            // --- 2. 入力検知 (InputInfo) ---
            const input = player.inputInfo;
            if (!input) continue; 

            const currentJump = input.getButtonState(InputButton.Jump);
            
            // 前回の状態取得 (初期値: Released)
            const lastJump = lastJumpState.get(player.id) ?? ButtonState.Released;
            // 前回の接地状態取得 (初期値: true = 地上にいたと仮定して誤爆を防ぐ)
            const lastGrounded = lastGroundedState.get(player.id) ?? true; 

            // 履歴更新
            lastJumpState.set(player.id, currentJump);
            lastGroundedState.set(player.id, isGrounded);

            // 判定ロジック
            // 1. ボタンを押した瞬間 (Released -> Pressed)
            // 2. 現在空中にいる (!isGrounded)
            // 3. ★重要: 前回も空中にいた (!lastGrounded) -> これで「飛び出しの瞬間」を除外
            // 4. まだダッシュしていない
            if (currentJump === ButtonState.Pressed && lastJump === ButtonState.Released) {
                if (!isGrounded && !lastGrounded && !hasUsedTag) {
                    
                    const agility = player.getDynamicProperty("deepcraft:agility") || 0;
                    if (agility >= 10) {
                        performAirDash(player);
                    }
                }
            }
        }
    }, 1);

    world.afterEvents.playerLeave.subscribe((ev) => {
        lastJumpState.delete(ev.playerId);
        lastGroundedState.delete(ev.playerId);
    });
}

/**
 * 空中ダッシュの実行処理
 */
function performAirDash(player) {
    player.addTag("deepcraft:used_air_dash");

    const view = player.getViewDirection();
    
    // ダッシュ強度
    const dashPower = 0.8;
    const verticalPower = 0.4;

    try {
        player.clearVelocity();
    } catch(e) {}

    player.applyImpulse({ 
        x: view.x * dashPower, 
        y: verticalPower, 
        z: view.z * dashPower 
    });

    player.playSound("mob.ghast.fireball", { pitch: 2.0, volume: 0.05 }); 
    try {
        player.dimension.spawnParticle("minecraft:cloud_particle", player.location);
    } catch(e){}
    
    
}