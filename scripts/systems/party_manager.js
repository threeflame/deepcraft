// BP/scripts/systems/party_manager.js
import { world, system } from "@minecraft/server";

// 招待データは一時的なものなのでメモリ管理のままでOK
// { invitedPlayerId: { partyId: "partyId", inviterName: "name" } }
const invites = new Map();

/**
 * UUIDを生成する
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * パーティ情報をワールドデータから取得する
 */
function loadPartyData(partyId) {
    if (!partyId) return null;
    const json = world.getDynamicProperty(`deepcraft:party_${partyId}`);
    if (!json) return null;
    try {
        return JSON.parse(json);
    } catch (e) {
        console.warn(`Party Data Load Error: ${e}`);
        return null;
    }
}

/**
 * パーティ情報をワールドデータに保存する
 */
function savePartyData(partyId, data) {
    if (!partyId || !data) return;
    world.setDynamicProperty(`deepcraft:party_${partyId}`, JSON.stringify(data));
}

/**
 * パーティ情報を削除する
 */
function deletePartyData(partyId) {
    if (!partyId) return;
    world.setDynamicProperty(`deepcraft:party_${partyId}`, undefined);
}

export function createParty(player) {
    // 念のため、既に有効なパーティに入っているか確認
    const currentPartyId = player.getDynamicProperty("deepcraft:party_id");
    if (currentPartyId && loadPartyData(currentPartyId)) {
        player.sendMessage("§c既にパーティに参加しています。");
        return;
    }
    
    // ゴーストデータ（IDだけ残っている状態）ならクリーンアップ
    if (currentPartyId) {
        player.setDynamicProperty("deepcraft:party_id", undefined);
    }

    const partyId = generateUUID();
    const partyData = { leader: player.id, members: [player.id] };
    
    // データを保存
    savePartyData(partyId, partyData);
    player.setDynamicProperty("deepcraft:party_id", partyId);

    player.sendMessage("§aパーティを作成しました。");
    player.sendMessage("§7メニューから招待できます。");
}

export function inviteToParty(inviter, targetPlayerName) {
    const partyId = inviter.getDynamicProperty("deepcraft:party_id");
    const partyData = loadPartyData(partyId);

    if (!partyId || !partyData || partyData.leader !== inviter.id) {
        inviter.sendMessage("§cパーティリーダーのみが招待できます。");
        return;
    }

    const target = world.getAllPlayers().find(p => p.name === targetPlayerName);
    if (!target) {
        inviter.sendMessage(`§cプレイヤー「${targetPlayerName}」が見つかりません。`);
        return;
    }
    
    // 相手が既にパーティに入っているかチェック
    const targetPartyId = target.getDynamicProperty("deepcraft:party_id");
    if (targetPartyId && loadPartyData(targetPartyId)) {
        inviter.sendMessage(`§c${target.name} は既に別のパーティに参加しています。`);
        return;
    }

    // 自分自身への招待を防ぐ
    if (target.id === inviter.id) {
        inviter.sendMessage("§c自分自身は招待できません。");
        return;
    }

    // 既にメンバーかチェック
    if (partyData.members.includes(target.id)) {
        inviter.sendMessage(`§c${target.name} は既にメンバーです。`);
        return;
    }

    invites.set(target.id, { partyId: partyId, inviterName: inviter.name });
    inviter.sendMessage(`§a${target.name} をパーティに招待しました。`);
    target.sendMessage(`§a${inviter.name} からパーティへの招待が届きました。`);
    target.sendMessage(`§aメニューの「パーティ」で参加できます。`);
    
    // 60秒後に招待を期限切れにする
    system.runTimeout(() => {
        if (invites.has(target.id) && invites.get(target.id).partyId === partyId) {
            invites.delete(target.id);
            if(target.isValid()) target.sendMessage(`§e${inviter.name} からの招待が期限切れになりました。`);
        }
    }, 1200);
}

export function acceptInvite(player) {
    const invite = invites.get(player.id);
    if (!invite) {
        player.sendMessage("§cパーティへの招待がありません。");
        return;
    }

    // 参加前に既存のパーティ状態をクリア（念のため）
    leaveParty(player, true); // silent=true でログを出さずに抜ける処理

    const partyData = loadPartyData(invite.partyId);
    if (!partyData) {
        player.sendMessage("§cこのパーティは既に解散されています。");
        invites.delete(player.id);
        return;
    }

    // メンバー追加
    partyData.members.push(player.id);
    savePartyData(invite.partyId, partyData);
    player.setDynamicProperty("deepcraft:party_id", invite.partyId);

    // 通知
    partyData.members.forEach(memberId => {
        // プレイヤーがオフラインの場合もあるので、getPlayersで探すかtry-catchする
        const member = world.getAllPlayers().find(p => p.id === memberId);
        if (member) member.sendMessage(`§a${player.name} がパーティに参加しました。`);
    });

    invites.delete(player.id);
}

export function leaveParty(player, silent = false) {
    const partyId = player.getDynamicProperty("deepcraft:party_id");
    if (!partyId) {
        if (!silent) player.sendMessage("§cあなたはパーティに参加していません。");
        return;
    }

    const partyData = loadPartyData(partyId);
    
    // データが存在しない（ゴースト状態）の場合のクリーンアップ
    if (!partyData) { 
        player.setDynamicProperty("deepcraft:party_id", undefined);
        if (!silent) player.sendMessage("§e古いパーティデータが見つからないため、状態をリセットしました。");
        return;
    }

    // メンバーリストから削除
    const index = partyData.members.indexOf(player.id);
    if (index > -1) partyData.members.splice(index, 1);

    player.setDynamicProperty("deepcraft:party_id", undefined);
    if (!silent) player.sendMessage("§eパーティから離脱しました。");

    // 残ったメンバーへの通知
    partyData.members.forEach(memberId => {
        const member = world.getAllPlayers().find(p => p.id === memberId);
        if (member) member.sendMessage(`§e${player.name} がパーティから離脱しました。`);
    });

    // リーダー処理
    if (partyData.leader === player.id) {
        if (partyData.members.length > 0) {
            // リーダー委譲
            partyData.leader = partyData.members[0];
            savePartyData(partyId, partyData);
            
            const newLeader = world.getAllPlayers().find(p => p.id === partyData.leader);
            if (newLeader) {
                partyData.members.forEach(memberId => {
                    const member = world.getAllPlayers().find(p => p.id === memberId);
                    if (member) member.sendMessage(`§e${newLeader.name} が新しいパーティリーダーになりました。`);
                });
            }
        } else {
            // 解散（データ削除）
            deletePartyData(partyId);
        }
    } else {
        // リーダー以外が抜けただけならデータ保存して終了
        if (partyData.members.length > 0) {
            savePartyData(partyId, partyData);
        } else {
            deletePartyData(partyId);
        }
    }
}

/**
 * プレイヤーが所属するパーティの情報を取得する
 * UI表示用
 */
export function getPartyInfo(player) {
    const partyId = player.getDynamicProperty("deepcraft:party_id");
    if (!partyId) return null;
    
    const partyData = loadPartyData(partyId);
    if (!partyData) {
        // IDはあるが実データがない（不整合）場合、IDも消しておく
        // player.setDynamicProperty("deepcraft:party_id", undefined); // 副作用を避けるためここでは消さないが、nullを返す
        return null;
    }
    
    return {
        partyId: partyId,
        leader: partyData.leader,
        members: partyData.members
    };
}