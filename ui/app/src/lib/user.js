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

    _createPromise() {
        this.relationships = new Promise((resolve, reject) => {
            this._fetchRelationships().then((v) => resolve(v)).catch((e) => reject(e));
        });
    }

    constructor() {
        this._createPromise();

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

    async getRelationships(rel_type) {
        let res = await this.relationships;

        // retry errors
        if (!res?.success) {
            this._createPromise();
            res = await this.relationships;

            if (!res?.success) return res;

        };

        const relationships = Object.entries(relationshipManager.richRelationships).map(([peer_id, relationship]) => ({
            peer_id,
            relationship,
        }))

        const relTypeNum = rel_type == null ? null : Number(rel_type)
        const filtered =
        relTypeNum == null || Number.isNaN(relTypeNum)
            ? relationships
            : relationships.filter((r) => Number(r.relationship) === relTypeNum)

        return {
            ...res,
            data: {
                ...(res.data ?? {}),
                relationships: filtered,
            },
        }
    }



    async _fetchRelationships() {
        const res = await API.GET("user/relationships");

        if (!res.success) return res;

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
    }

    async blockUser(user_id) {
        const res = await API.PUT(`user/relationship/${user_id}/block`);

        if (res.success) {
            this.updateRelationships(user_id, res.data.relationship);
        }

        return res;
    }
    async unblockUser(user_id) {
        const res = await API.DELETE(`user/relationship/${user_id}/block`);

        if (res.success) {
            this.updateRelationships(user_id, null);
        }

        return res;
    }

    async friendUser(user_id) {
        const res = await API.PUT(`user/relationship/${user_id}/friend`);

        if (res.success) {
            this.updateRelationships(user_id, res.data.relationship);
        }
        return res;
    }

    async unfriendUser(user_id) {
        const res = await API.DELETE(`user/relationship/${user_id}/friend`);
        if (res.success) {
            this.updateRelationships(user_id, null);
        }
        return res;
    }
}

export const relationshipManager = new RelationshipManager();
