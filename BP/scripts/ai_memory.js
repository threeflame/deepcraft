// BP/scripts/ai_memory.js

/*
==========================================================================
 🧠 AI CONTEXT MEMORY (DeepCraft Development Log)
 Version: 6.0 (Skills & Talent Overhaul)
==========================================================================

## 1. Project Overview
- Title: DeepCraft
- Library: Chest-UI

## 2. File Structure
- `data/talents.js`: NO STAT BOOSTS. Only passive/numerical effects.
- `data/skills.js`: Active skills logic (Cooldowns, Effects).
- `data/equipment.js`: Links weapons to `skillId`.

## 3. Current Mechanics

### A. Skill System (New!)
- **Trigger**: Right-click with specific weapons.
- **Cooldown**: Managed via `cooldown:skill_xxx` tag.
- **Effect**: Defined in `skills.js` (Dash, Fireball, Smite, etc.).

### B. Talents (Passive)
- **Type**: Numerical manipulation only (No Potion Effects).
- **Logic**: Handled in `applyNumericalPassives` and `entityHurt`.
- **Examples**: Evasion (cancel dmg), Critical (dmg x1.5), Regeneration (HP++).

### C. Equipment & Stats
- **Penalty**: Namakura (Dmg=1) & Slowness.
- **Status**: Only used for Requirements (except Fortitude -> HP).

==========================================================================
*/