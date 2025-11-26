// BP/scripts/ai_memory.js

/*
==========================================================================
 🧠 AI CONTEXT MEMORY (DeepCraft Development Log)
 Version: 10.0 (Ether System Implemented)
==========================================================================

## 1. Project Overview / プロジェクト概要
- **Title**: DeepCraft
- **Concept**: Deepwoken-inspired PvPvE RPG.
- **Environment**: Minecraft BE Script API.
- **Library**: Chest-UI.

## 2. ⚠️ Technical Constraints & Ban List (重要: 使用禁止・非推奨コード)
1.  **[BANNED] `world.beforeEvents.entityHurt`**
    * Solution: `world.afterEvents.entityHurt` + Health refund mechanics.
2.  **[BANNED] `world.afterEvents.entityHitEntity`**
    * Solution: Check `attacker` in `entityHurt`.
3.  **[BANNED] `world.afterEvents.chatSend` (!cmd)**
    * Solution: Use `/scriptevent deepcraft:command`.
4.  **[BANNED] `entity.playSound()`**
    * Solution: `dimension.playSound(id, location)`.
5.  **[BANNED] Summoning `small_fireball`**
    * Solution: `snowball` + particle effects.

## 3. File Structure
- `main.js`: Core logic (Tick, Events, Ether, UI).
- `config.js`: Settings (Stats, Ether Calc).
- `data/skills.js`: Active skills with Mana Cost.

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