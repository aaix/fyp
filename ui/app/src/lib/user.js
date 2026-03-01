import API from "./api";
import { getAvatarUrl } from "./utils.js";


// helper for ui
export function mapSearchResponseToUserList(data) {
    return data.map((user) => {
        const icon_url = getAvatarUrl(user);
        return { icon_url, username: user.username, user_id: user.user_id, public_key: user.public_key };
    });
}


export class UserManager {
    async searchUsers(query) {
        const res = await API.GET(`account/search?q=${encodeURIComponent(query)}`);
        return res;
    }

    async getUserProfile(user_id) {
        const res = await API.GET(`account/userprofile/${user_id}`);

        return res;
    }
}

export const userManager = new UserManager();