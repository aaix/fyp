import API from "./api";
import { decryptB64Sym, importFromPem, RSAUnwrapSym, RSAWrapSym } from "./keyhandler";
import { getCurrentSession } from "./session";
import { B64toUint8Array } from "./utils";

class ChannelManager {

    async createEncryptedSharedKey(user, shared_sym) {
        const user_pk = await importFromPem(user.public_key);

        return await RSAWrapSym(user_pk, shared_sym);
    }

    async populateEncryptedChannelFields(channel, keep_key=false) {

        const my_key = await (await getCurrentSession()).getAccountKey();
        
        const shared_key = await RSAUnwrapSym(my_key.privateKey, await B64toUint8Array(channel.encrypted_channel_key));
        if (keep_key) {
            channel.shared_key = shared_key;
        }

        channel.channel_name = new TextDecoder().decode(await decryptB64Sym(channel.channel_name, shared_key));
            
    }


    async getChannels() {
        const res = await API.GET("chat/channels");
        if (!res.success) {
            return res
        }

        await Promise.all(res.data.channels.map(async (channel) => {
            // modify channel in place
            await this.populateEncryptedChannelFields(channel, false);
        }))


        return res;
    }

    async createChannel(body) {
        return API.POST("chat/channel", body)
    }

    async getChannel(channel_id, encrypted_channel_key) {
        const res =  await API.GET(`chat/channel/${channel_id}`);
        if (!res.success) {
            return res;
        }
        const channel = res.data;
        channel.encrypted_channel_key = encrypted_channel_key;
        await this.populateEncryptedChannelFields(channel, true);

        return res;
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