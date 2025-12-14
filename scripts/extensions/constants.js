/**
 * Turns the logic for inventory slots on/off. Only set this to false if you have disabled inventory in RP/ui/_global_variables.json side!
 * Disabling this may also reduce form opening lag a bit.
 */
export const inventory_enabled = true;
/**
 * Defines the custom block & item IDs for the form.
 * You can reference either a vanilla texture icon, which functions identically to other items...
 * ...or reference a texture path, which removes enchant glint and 3d block render capability.
 */
export const custom_content = {

     'deepcraft:wooden_sword': {
        texture: 'textures/items/wooden_sword', 
        type: 'item'
    },
	     'deepcraft:stone_sword': {
        texture: 'textures/items/stone_sword', 
        type: 'item'
    },
	     'deepcraft:iron_sword': {
        texture: 'textures/items/iron_sword', 
        type: 'item'
    },
	     'deepcraft:golden_sword': {
        texture: 'textures/items/golden_sword', 
        type: 'item'
    },
	     'deepcraft:copper_sword': {
        texture: 'textures/items/copper_sword', 
        type: 'item'
    },
	     'deepcraft:diamond_sword': {
        texture: 'textures/items/diamond_sword', 
        type: 'item'
    },
		'deepcraft:netherite_sword': {
        texture: 'textures/items/netherite_sword', 
        type: 'item'
    },

	// ---- Vanilla icons (ChestGUI) ----
	// 新しいバージョンでitem rendererのID解決が壊れた場合でも、texture pathなら表示できる
	// ※ type は item にしない（number_of_custom_items を増やさない）
	'minecraft:barrier': { texture: 'textures/items/barrier', type: 'block' },
	'minecraft:nether_star': { texture: 'textures/items/nether_star', type: 'block' },
	'minecraft:experience_bottle': { texture: 'textures/items/experience_bottle', type: 'block' },
	'minecraft:spyglass': { texture: 'textures/items/spyglass', type: 'block' },
	'minecraft:enchanted_book': { texture: 'textures/items/book_enchanted', type: 'block' },
	'minecraft:emerald': { texture: 'textures/items/emerald', type: 'block' },
	'minecraft:writable_book': { texture: 'textures/items/book_writable', type: 'block' },
	'minecraft:gold_ingot': { texture: 'textures/items/gold_ingot', type: 'block' },
	'minecraft:totem_of_undying': { texture: 'textures/items/totem', type: 'block' },
	'minecraft:sunflower': { texture: 'textures/items/sunflower', type: 'block' },
	'minecraft:name_tag': { texture: 'textures/items/name_tag', type: 'block' },
	'minecraft:chest': { texture: 'textures/items/chest', type: 'block' },
	'minecraft:spawner': { texture: 'textures/blocks/spawner', type: 'block' },
	'minecraft:golden_apple': { texture: 'textures/items/apple_golden', type: 'block' },
	'minecraft:iron_sword': { texture: 'textures/items/iron_sword', type: 'block' },
	'minecraft:shield': { texture: 'textures/items/shield', type: 'block' },
	'minecraft:gold_nugget': { texture: 'textures/items/gold_nugget', type: 'block' },
	'minecraft:blaze_powder': { texture: 'textures/items/blaze_powder', type: 'block' },
	'minecraft:target': { texture: 'textures/blocks/target_side', type: 'block' },
	'minecraft:creeper_head': { texture: 'textures/blocks/skull_creeper', type: 'block' },
	'minecraft:phantom_membrane': { texture: 'textures/items/phantom_membrane', type: 'block' },
	'minecraft:feather': { texture: 'textures/items/feather', type: 'block' },
	'minecraft:sugar': { texture: 'textures/items/sugar', type: 'block' },
	'minecraft:ender_chest': { texture: 'textures/blocks/ender_chest_front', type: 'block' },
	'minecraft:book': { texture: 'textures/items/book_normal', type: 'block' },
	'minecraft:banner': { texture: 'textures/items/banner', type: 'block' },
	'minecraft:paper': { texture: 'textures/items/paper', type: 'block' },
	'minecraft:player_head': { texture: 'textures/blocks/skull_steve', type: 'block' },

};
//Blocks are excluded from the count, as they do not shift vanilla IDs.
export const number_of_custom_items = Object.values(custom_content).filter(v => v.type === 'item').length;
export const custom_content_keys = new Set(Object.keys(custom_content));
//Add custom sizes defined in UI. Format is [key, [ui_flag, slot_count]]
export const CHEST_UI_SIZES = new Map([
	['single', ['§c§h§e§s§t§2§7§r', 27]], ['small', ['§c§h§e§s§t§2§7§r', 27]],
	['double', ['§c§h§e§s§t§5§4§r', 54]], ['large', ['§c§h§e§s§t§5§4§r', 54]],
	['1', ['§c§h§e§s§t§0§1§r', 1]],
	['5', ['§c§h§e§s§t§0§5§r', 5]],
	['9', ['§c§h§e§s§t§0§9§r', 9]],
	['18', ['§c§h§e§s§t§1§8§r', 18]],
	['27', ['§c§h§e§s§t§2§7§r', 27]],
	['36', ['§c§h§e§s§t§3§6§r', 36]],
	['45', ['§c§h§e§s§t§4§5§r', 45]],
	['54', ['§c§h§e§s§t§5§4§r', 54]],
	[1, ['§c§h§e§s§t§0§1§r', 1]],
	[5, ['§c§h§e§s§t§0§5§r', 5]],
	[9, ['§c§h§e§s§t§0§9§r', 9]],
	[18, ['§c§h§e§s§t§1§8§r', 18]],
	[27, ['§c§h§e§s§t§2§7§r', 27]],
	[36, ['§c§h§e§s§t§3§6§r', 36]],
	[45, ['§c§h§e§s§t§4§5§r', 45]],
	[54, ['§c§h§e§s§t§5§4§r', 54]]
]);
