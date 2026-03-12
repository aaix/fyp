import API from "./api";

class ChannelManager {
    async getChannels() {
        return API.GET("chat/channels");
    }

    async createChannel(body) {
        return API.POST("chat/channel", body)
    }

    async getChannel(channel_id) {
        return API.GET(`chat/channel/${channel_id}`)
    }

    async addChannelMember(channel_id, user_id) {
        API.PUT(`chat/channel/${channel_id}/members/${user_id}`, {
            encrypted_shared_key: ""
        })
    }

    async removeChannelMember(channel_id, user_id) {
        API.DELETE(`chat/channel/${channel_id}/members/${user_id}`)
    }

    async editChannel(channel_id, channel_name) {
        return API.PATCH(`chat/channel/${channel_id}`,{
            channel_name: channel_name
        })
    }
    
}

export const channelManager = new ChannelManager();