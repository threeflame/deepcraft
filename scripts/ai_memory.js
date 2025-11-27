// BP/scripts/ai_memory.js

/*
==========================================================================
 🧠 AI CONTEXT MEMORY (DeepCraft Development Log)
 Version: 11.0 (Combat Overhaul & Stat Logic Finalization)
==========================================================================

## 1. Project Overview / プロジェクト概要
- **Title**: DeepCraft
- **Concept**: Deepwoken-inspired PvPvE RPG (Hardcore / Stat Building).
- **Environment**: Minecraft BE Script API.
- **Library**: Chest-UI.

## 2. ⚠️ Technical Constraints & Ban List (重要: 使用禁止・非推奨コード)
1.  **[BANNED] `world.beforeEvents.entityHurt`**
    * Reason: 不安定かつダメージ操作が反映されないため。
    * Solution: `world.afterEvents.entityHurt` で処理する。

2.  **[RESTRICTED] `applyDamage()` inside `entityHurt`**
    * Reason: 無限ループ（再帰発火）のリスクがある。また、バニラのノックバックと重複する可能性がある。
    * Solution: 基本的に `healthComponent.setCurrentValue()` でHPを直接減らす。トドメ（キルログが必要な場合）のみ `applyDamage` を使う。

3.  **[BANNED] `world.afterEvents.chatSend` (!cmd)**
    * Solution: `/scriptevent deepcraft:command` を使用。

4.  **[BANNED] `entity.playSound()`**
    * Solution: `dimension.playSound(id, location)` を使用。

## 3. File Structure / ファイル構成
- `main.js`: Core Logic (Combat, UI, Stats, Events).
- `config.js`: Constants (Stats cap, Ether settings).
- `data/*.js`: Content Definitions (Talents, Items, Mobs, Quests).

## 4. Current Mechanics / 実装済みの仕様

### A. Combat System (Logic: Direct HP Manipulation)
- **Damage Process**:
  1.  **I-Frame Check**: 独自の0.5秒（10tick）クールダウンで連打/多段ヒットを防止。
  2.  **Refund**: バニラのダメージを即時回復して帳消しにする（ノックバックは残る）。
  3.  **Calculation**: `(Base + Weapon + Buffs) * Crit` で攻撃力を算出。
  4.  **Apply**: `Max(1, Attack - Defense)` を計算し、**HP数値を直接書き換えて**減らす。
- **Critical**:
  - Chance: `5% + (Agi * 0.1) + (Int * 0.05)`.
  - Damage: `1.5x + (Str * 0.005)`.
  - Effect: Sound (`random.anvil_land`) & Particle (`critical_hit_emitter`).
- **Evasion**: `(Agi * 0.1)%` + Talent to negate damage.

### B. Stats & Progression
- **Level Cap**: Lv 20.
- **Stat Points**: 15 points per level. Total **300** points (Lv20 + Bonus).
- **Stat Cap**: Max **100** per stat.
- **Initial Stats**: All **0**.
- **Ether (Mana)**:
  - Max: `20 + (Intelligence * 2.5)`.
  - Regen: `1.0 + (Willpower * 0.2)` / sec.
- **Menu**: Detailed stat view implemented (`calculateEntityStats` shared logic).

### C. Content
- **Talents**: Categorized (Warrior, Mage, Rogue, Survivor). Completion unlocks Legendary.
- **Equipment**: Custom `atk` / `def` parameters added to `equipment.js`.
- **Bosses**: 3 Custom Bosses with AI.

==========================================================================
*/