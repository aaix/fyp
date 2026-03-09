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
    
}

export const channelManager = new ChannelManager();