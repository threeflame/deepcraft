// BP/scripts/ai_memory.js

/*
==========================================================================
 🧠 AI CONTEXT MEMORY (DeepCraft Development Log)
 Version: 15.0 (Critical Logic Protection & Stability Fixes)
==========================================================================

## 1. Project Overview
- **Title**: DeepCraft
- **Concept**: Deepwoken-inspired PvPvE RPG (Hardcore / Stat Building).
- **Environment**: Minecraft BE Script API.
- **Library**: Chest-UI.

## 2. ⚠️ Technical Constraints & Ban List (絶対に使用禁止)
1.  **[BANNED] `world.beforeEvents.entityHurt`**: 動作不安定のため使用禁止。全て `afterEvents` で処理する。
2.  **[BANNED] `world.afterEvents.chatSend`**: チャットコマンド廃止。`/scriptevent` を使用する。
3.  **[BANNED] `entity.playSound()`**: Mobにメソッドがないため `dimension.playSound` を使用する。
4.  **[BANNED] Separate `processLevelUp` Function**:
    * **理由**: 関数を分けるとデータの保存タイミングがズレて「ポイントがマイナスになるバグ」が再発する。
    * **解決策**: レベルアップ処理は全て `upgradeStat` 関数内に記述し、1回の処理で完結させること。

## 3. 🛡️ Critical Implementation Rules (修正時・上書き禁止事項)
以下のロジックはバグ修正の末に確立された「正解」であり、変更してはならない。

### A. Level Up Logic (`upgradeStat`)
- **Atomic Update**: ポイント加算とレベルアップ判定は同時に行い、`setDynamicProperty` は分岐後に**1回だけ**実行する。
- **Reset Requirement**: 投資ポイント(`invested_points`)が15に達したら、**必ず `0` を保存する**。
  - ❌ `15` を保存してから `0` にする（バグの原因）
  - ⭕ 分岐して `0` を直接保存する

### B. HP System (Virtual HP)
- **Vanilla HP**: `player.json` で **200** に固定。
- **Damage Handling**: `entityHurt` の**一番最初**に `resetToMax()` を実行し、バニラダメージを帳消しにする。
- **Virtual HP**: スクリプト上の `deepcraft:hp` を計算で減算する。
- **Death**: 仮想HP <= 0 で `kill` コマンドを実行（`applyDamage`では死なないため）。

### C. Combat & Desync Fixes
- **I-Frame**: スクリプトによる無敵時間管理は**廃止**（バニラ準拠）。
- **Hitbox Desync**: `playerSpawn` 時に `triggerEvent("scale_reset")` ではなく、**2tick遅延して処理**する等の対策が必要（現状はScale削除により対応済み）。
- **Combat Mode**: 死亡時(`entityDie`)に必ず `combat_timer` を `0` にリセットする（無限キルループ防止）。

## 4. Current Mechanics / 現在の仕様

### Stats & Progression
- **Max Level**: 20.
- **Stat Points**: 15 points per level. Total **300**.
- **Stat Cap**: 100 per stat.
- **Initial Stats**: All 0.

### Economy
- **Currency**: Gold (`deepcraft:gold`).
- **Market**: Global listing system using chunked dynamic properties.
  - Listing via: Menu button (Hand item) OR Command `/scriptevent deepcraft:sell <price>`.

==========================================================================
*/