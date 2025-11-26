// BP/scripts/ai_memory.js

/*
==========================================================================
 🧠 AI CONTEXT MEMORY (DeepCraft Development Log)
 Version: 9.0 (Stable Release & Technical Constraints)
==========================================================================

## 1. Project Overview / プロジェクト概要
- **Title**: DeepCraft
- **Concept**: Deepwoken-inspired PvPvE RPG.
- **Environment**: Minecraft BE Script API.
- **Library**: Chest-UI.

## 2. ⚠️ Technical Constraints & Ban List (重要: 使用禁止・非推奨コード)
以下の機能はこの環境で動作しないか、バグの原因となるため使用禁止。

1.  **[BANNED] `world.beforeEvents.entityHurt`**
    * Reason: 動作しない、またはダメージ書き換えが適用されない環境であるため。
    * Solution: 全ての戦闘処理は `world.afterEvents.entityHurt` で行い、軽減は「即時回復」で、無効化は「ダメージ分回復」で擬似的に表現すること。

2.  **[BANNED] `world.afterEvents.entityHitEntity`**
    * Reason: APIバージョンにより存在しない場合がある。
    * Solution: `entityHurt` の `attacker` をチェックして代用する。

3.  **[BANNED] `world.afterEvents.chatSend` (Custom Command `!cmd`)**
    * Reason: 権限設定やバージョン依存が激しく不安定。
    * Solution: 公式の `/scriptevent deepcraft:command` 方式のみを使用する。

4.  **[BANNED] `entity.playSound()` (for Mobs)**
    * Reason: Mobオブジェクトには `playSound` メソッドがない。
    * Solution: `entity.dimension.playSound("sound.name", entity.location)` を使用する。

5.  **[BANNED] Summoning `minecraft:small_fireball`**
    * Reason: `is_summonable: false` のため召喚不可。
    * Solution: `minecraft:snowball` を召喚し、パーティクルで装飾して代用する。

## 3. File Structure / ファイル構成
- **BP/scripts/**:
  - `index.js`: Entry point.
  - `main.js`: System Logic (Event listeners, UI calls).
  - `config.js`: Settings & Stat Definitions.
  - `ai_memory.js`: This file.
  - **data/**:
    - `talents.js`: Passive abilities logic.
    - `quests.js`: Quest definitions.
    - `equipment.js`: Item definitions & Requirements.
    - `skills.js`: Active skills logic.
    - `mobs.js`: Boss definitions & AI.

## 4. Current Mechanics / 実装済みの仕様

### A. Combat System
- **Ether (Mana) System**: 
  - **Max Ether**: `Base(20) + (Intelligence * 2.5)`. 
  - **Regen**: `Base(1.0) + (Willpower * 0.2)` per second.
  - **Display**: Action Bar (Blue Gauge).
  - **Cost**: Skills require Ether. Insufficient Ether fails the skill.
- **Defense**: `Defense / (Defense + 50)` rate.
- **Namakura**: Low stat weapon penalty.
- **Skill Trigger**: Right-Click (Item Use).

### B. Stats & Progression
- **Stats**: 14 Types.
- **Intelligence**: Increases Max Ether.
- **Willpower**: Increases Ether Regen (and Aquatic Life passive).
- **Health**: 18 + (Fortitude * 2).
- **Leveling**: 15 Stat points = 1 Level.

### C. Death Penalty
- **XP**: 100% Lost.
- **Items**: 50% chance to drop into "Soul" (Chest Minecart spawned at Y+1).

### D. Content
- **Bosses**: 3 Custom Bosses with AI (Skill chance on Tick & Hurt) and HP Bar (NameTag).
- **Equipment**: 20+ Custom Items with Requirements & Skills.

==========================================================================
*/