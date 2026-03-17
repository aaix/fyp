import API from "./api";
import { getAvatarUrl } from "./utils.js";
import { gatewayFactory } from "./gateway.js";


// helper for ui
export function mapSearchResponseToUserList(data) {
    return data.map((user) => {
        const icon_url = getAvatarUrl(user);
        return { icon_url, username: user.username, user_id: user.user_id, public_key: user.public_key };
    });
}


export class UserManager {
    async searchUsers(query) {
        const res = await API.GET(`user/search?q=${encodeURIComponent(query)}`);
        return res;
    }

    async getUserProfile(user_id) {
        const res = await API.GET(`user/profile/${user_id}`);

        return res;
    }

    async fetchUsersBulk(user_ids) {
        const gateway = await gatewayFactory();
        return await gateway.user_store.getUsersBulk(user_ids);
    }

}

export const userManager = new UserManager();

export class RelationshipManager {

    constructor() {
        this.relationships = new Promise((resolve, reject) => {
            this._fetchRelationships().then((v) => resolve(v)).catch((e) => reject(e));
        });

        this.richRelationships = {};
    }
    
    CURRENT_REQUESTING_PEER = 1
    PEER_REQUESTING_CURRENT = 2

    FRIENDS = 3

    PEER_BLOCKED_CURRENT = 5
    CURRENT_BLOCKED_PEER = 6

    updateRelationships(peer_id, new_relationship_type) {
        if (!new_relationship_type) {
            delete this.richRelationships[peer_id];
        }

        this.richRelationships[peer_id] = new_relationship_type;
    }

    getRelationships() {
        return this.relationships;
    }


    async _fetchRelationships() {
        const res = await API.GET("user/relationships");

        for (let rel of res.data.relationships) {
            this.updateRelationships(rel.peer_id, rel.relationship)
        }
        return res;
    }
    

    async getRelationshipWithUser(user_id) {
        const res = await this.getRelationships();
        if (!res.success) {
            throw new Error(res.error.message);
        }

        return this.richRelationships[user_id];

        const relationships = res?.data?.relationships ?? [];
        const norm = (id) => String(id ?? '').toLowerCase();
        const peerRels = relationships
            .filter((r) => norm(r.peer_id) === norm(user_id))
            .map((r) => Number(r.relationship));

        const { CURRENT_REQUESTING_PEER, PEER_REQUESTING_CURRENT, FRIENDS, CURRENT_BLOCKED_PEER, PEER_BLOCKED_CURRENT } = this;

        const best =
            peerRels.includes(FRIENDS) ? FRIENDS :
            peerRels.includes(PEER_REQUESTING_CURRENT) ? PEER_REQUESTING_CURRENT :
            peerRels.includes(CURRENT_REQUESTING_PEER) ? CURRENT_REQUESTING_PEER :
            null;

        const blockBest =
            peerRels.includes(CURRENT_BLOCKED_PEER) ? CURRENT_BLOCKED_PEER :
            peerRels.includes(PEER_BLOCKED_CURRENT) ? PEER_BLOCKED_CURRENT :
            null;

        return {
            ...res, // propogate through error info
            data: {
                relationship: best,
                blockRelationship: blockBest,
            },
        };
    }

    blockUser(user_id) {
        return API.PUT(`user/relationship/${user_id}/block`);
    }
    unblockUser(user_id) {
        return API.DELETE(`user/relationship/${user_id}/block`);
    }

    friendUser(user_id) {
        return API.PUT(`user/relationship/${user_id}/friend`);
    }
    unfriendUser(user_id) {
        return API.DELETE(`user/relationship/${user_id}/friend`);
    }
}

export const relationshipManager = new RelationshipManager();
