// BP/scripts/ai_memory.js

/*
==========================================================================
 🧠 AI CONTEXT MEMORY (DeepCraft Development Log)
==========================================================================
## [v31.0] Hybrid Item Data Storage
- **Policy**:
    - Non-Stackable (Weapons/Armor) -> **Dynamic Properties** (Safer/Faster).
    - Stackable (Materials) -> **Lore Encoding** (Prevents stack merging issues).
- **Implementation**: `lore_manager.js` now handles this switching automatically via `setItemData` / `getItemId`.

# 📜 Development History
## [v30.1] HP Sync Logic Removal
- **Change**: Removed logic that synced Virtual HP to Vanilla HP in `combat_system.js`.
- **Reason**: Caused `ArgumentOutOfBoundsError` and interfered with external survival mechanics.
- **Current**: Script only updates `deepcraft:hp` and NameTag. Vanilla HP management is handled externally.

# 📜 Development History
## [v30.0] Weapon Scaling System (Integer Based)
- **Mechanic**: `ATK = Base + (Stat * Scale / 10)`.
- **Stats**: Only `Mastery` (Light/Med/Heavy) and `Element` (Flame etc) affect damage. `Strength` is removed from damage calc.
- **Data**: Added `scaling` property to `equipment.js` (e.g., `heavy: 15` = 1.5x scaling).


# 📜 Development History
## [v29.0] DeepCraft Reforged v3 (Balance Update)
- **Concept**: HP 1000-2000 vs Dmg 50-100 at Endgame (Lv20).
- **Stats**:
    - Fortitude: Integrated HP & Def.
    - Defense (Stat): Deprecated.
- **Calculation**:
    - HP = 300 + (Lv*30) + (Fort*12)
    - ATK = Weapon + (Lv*3) + (Str*2.0)
    - DefScore = Armor + (Lv*4) + (Fort*2)
    - Reduction = Score / (Score + 150)

## [v28.1] Command Rename
- `/deepcraft:cgive`, `/deepcraft:csummon`

# 📜 Development History
## [v27.0] Summoner Class Implementation
- **Feature**: Necromancer Staff & Summon Minion Skill.
- **Entity**: `deepcraft:minion_zombie` (Friendly, Tameable).
- **Mechanic**: Minions scale with Intelligence, follow owner, and ignore FF.
- **Files**: `minion_zombie.json` added to entities.

## [v26.1] Attack Speed Revert (Again)
- **Status**: Removed. Vanilla combat speed.

# 📜 Development History (開発の軌跡・日記)
※ 新しい変更や決定事項はここに追加し、過去の経緯を参照できるようにする。

# 📜 Development History
## [v26.0] Attack Cooldown v2 (Timestamp Method)
- **Re-implementation**: Attack cooldowns are back.
- **Method**: Uses `system.currentTick` vs `deepcraft:next_attack_tick`. No timers involved.
- **UI**: Simple Subtitle Gauge (Green/Red bars).

## [v25.0] Native Custom Command Implementation
- **Command**: `/deepcraft:menu`, `/sell`, etc.
- **Registry**: `system.beforeEvents.startup`.

==========================================================================

# ⚠️ Active Technical Constraints & Ban List
1.  **[BANNED] `system.runTimeout` for Cooldowns**
    * **Reason**: Prone to bugs/desync.
    * **Solution**: Use timestamp comparison (Tick-based).

2.  **[BANNED] `entity.runCommand()` (Sync)**
    * **Solution**: `runCommandAsync`.

3.  **[BANNED] `EquipmentSlot` String Literals**
    * **Solution**: `EquipmentSlot.Mainhand` (Enum).
## [v23.0] Custom Command & API Stability Strategy
- **Decision**: `world.beforeEvents.chatSend` is confirmed as **Beta API only**.
- **Decision**: `CustomCommand` (Slash Commands) is available in **Stable API**.
- **Action**:
    - 廃止: `!menu` などのチャット検知方式。
    - 採用: `CustomCommandRegistry` を使用したネイティブコマンド (`/menu`, `/sell` etc.)。
    - 実装予定コマンド: `menu`, `sell`, `stats`, `quest`.
- **Policy**: AI Memory will now serve as a persistent log to prevent repeating mistakes.

## [v21.0] Attack Speed & Scale Logic Revert
- **Issue**: Custom attack cooldowns via `runTimeout` caused permanent inability to attack due to `isValid` reference loss or sync issues.
- **Issue**: `player.triggerEvent` for resizing was removed in API 2.x, causing errors.
- **Fix**:
    - Attack speed reverted to Vanilla (spam-clicking allowed).
    - Removed all player scaling logic.
- **Lesson**: Avoid complex async state management for high-frequency actions like combat.

## [v20.0] API 2.3.0 Migration (Breaking Changes)
- **Migration**: Updated `@minecraft/server` to 2.3.0 and `@minecraft/server-ui` to 2.0.0.
- **Fixes**:
    - `runCommand` -> `runCommandAsync`.
    - `entity.isValid()` -> `entity.isValid` (Property).
    - `getEquipment("Hand")` -> `getEquipmentSlot(EquipmentSlot.Mainhand).getItem()`.
    - Fixed `EquipmentSlot` casing (`MainHand` -> `Mainhand`).

==========================================================================

# ⚠️ Active Technical Constraints & Ban List (現在の技術的制約)
※ 開発時に必ず遵守すること。

1.  **[BANNED] `world.beforeEvents.chatSend`**
    * **Reason**: Script API Stable版では使用不可（Beta機能）。
    * **Solution**: カスタムコマンド機能を使用する。

2.  **[BANNED] `entity.runCommand()` (Sync)**
    * **Reason**: API 2.x で廃止。
    * **Solution**: `runCommandAsync` を使用する。

3.  **[BANNED] `EquipmentSlot` String Literals**
    * **Reason**: 文字列指定 ("Mainhand") は不安定。
    * **Solution**: 必ず `EquipmentSlot.Mainhand` (Enum) を使用する。

4.  **[BANNED] `entity.triggerEvent()`**
    * **Reason**: 廃止されたメソッド。
    * **Solution**: コンポーネントの直接操作 (`component.value = ...`) を行う。

5.  **[BANNED] Dynamic Property on Stackable Items**
    * **Reason**: アイテムスタック時にデータが消失・競合するため。
    * **Solution**: スタック可能なアイテムのデータは `Lore` (不可視色コード) に保存する。

==========================================================================

# 🛡️ Critical Implementation Rules (基幹システム仕様)

### A. Command System (Target: CustomCommand)
- **Commands**:
    - `/menu`: Open Menu Hub.
    - `/sell [price]`: Sell held item.
    - `/stats`: Show player stats in chat.
    - `/quest`: Open Quest Log.

### B. Item Data Storage
- **Lore式**: 全てのアイテムデータ保存の基本。`lore_manager.js` でエンコード/デコードを行う。

### C. Combat System
- **Damage**: `world.afterEvents.entityHurt` のみで処理。
- **Calculation**: 攻撃力・防御力・タレント補正を計算し、`victim.applyDamage` または `setCurrentValue` (回復による相殺) で反映。
- **Death**: `dead` タグを付与し、1tick後のループでドロップ処理とキル確定を行う。

==========================================================================
*/