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
    
    async bulkRequestUsers(user_ids) {
        const gateway = await gatewayFactory();
        await gateway.bulk_request_users(user_ids);

    }

}

export const userManager = new UserManager();

export class RelationshipManager {
    CURRENT_REQUESTING_PEER = 1
    PEER_REQUESTING_CURRENT = 2

    FRIENDS = 3

    PEER_BLOCKED_CURRENT = 5
    CURRENT_BLOCKED_PEER = 6

    
    getRelationships() {
        return API.GET("user/relationships");
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
