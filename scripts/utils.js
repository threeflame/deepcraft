import { world } from "@minecraft/server";

function clampNumber(value, min, max) {
	const num = Number(value);
	if (!isFinite(num)) return min;
	return Math.min(max, Math.max(min, num));
}

/**
 * 例外を飲み込みつつ、プレイヤー/エンティティに対してサウンドを鳴らす
 * @param {import("@minecraft/server").Entity} entity
 * @param {string} soundId
 * @param {{ volume?: number, pitch?: number }} [options]
 */
export function safePlaySound(entity, soundId, options = undefined) {
	if (!entity?.isValid || !soundId) return;
	try {
		entity.playSound(soundId, options);
		return;
	} catch (e) {}

	try {
		const dim = entity.dimension;
		if (!dim) return;
		dim.playSound(soundId, entity.location, options);
	} catch (e) {}
}

/**
 * 例外を飲み込みつつ、ディメンションにパーティクルを出す
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {string} particleId
 * @param {import("@minecraft/server").Vector3} location
 */
export function safeSpawnParticle(dimension, particleId, location) {
	if (!dimension || !particleId || !location) return;
	try {
		dimension.spawnParticle(particleId, location);
	} catch (e) {}
}

/**
 * エンティティ位置に「わかりやすい」粒子を複数回出す
 * @param {import("@minecraft/server").Entity} entity
 * @param {string[]} particleIds 優先順（存在しないIDは無視される）
 * @param {{count?: number, yOffset?: number, spread?: number}} [opt]
 */
export function burstParticles(entity, particleIds, opt = undefined) {
	if (!entity?.isValid) return;
	const dim = entity.dimension;
	if (!dim) return;

	const base = entity.location;
	const count = clampNumber(opt?.count ?? 8, 1, 40);
	const yOffset = clampNumber(opt?.yOffset ?? 0.9, -2, 3);
	const spread = clampNumber(opt?.spread ?? 1.0, 0, 6);

	for (let i = 0; i < count; i++) {
		const loc = {
			x: base.x + (Math.random() - 0.5) * spread,
			y: base.y + yOffset + (Math.random() - 0.5) * spread * 0.25,
			z: base.z + (Math.random() - 0.5) * spread,
		};

		for (const particleId of particleIds) {
			if (!particleId) continue;
			try {
				dim.spawnParticle(particleId, loc);
				break;
			} catch (e) {}
		}
	}
}

/**
 * プレイヤーに見える全員へ短い演出（ボス/ワールド通知向け）
 * @param {import("@minecraft/server").Vector3} location
 * @param {string[]} particleIds
 */
export function burstParticlesToNearbyPlayers(location, particleIds) {
	if (!location) return;
	for (const player of world.getAllPlayers()) {
		try {
			const dx = player.location.x - location.x;
			const dy = player.location.y - location.y;
			const dz = player.location.z - location.z;
			if ((dx * dx + dy * dy + dz * dz) > (30 * 30)) continue;
			burstParticles(player, particleIds, { count: 6, yOffset: 1.0, spread: 1.5 });
		} catch (e) {}
	}
}

