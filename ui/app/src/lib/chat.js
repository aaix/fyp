import API from "./api";
import { decryptB64Sym, encryptSymB64, importFromPem, RSAUnwrapSym, RSAWrapSym } from "./keyhandler";
import { getCurrentSession } from "./session";
import { B64toUint8Array } from "./utils";

class ChannelManager {


    async processNewChannel(channel_id, channel_name, encrypted_channel_key) {
        const channelEntry = {channel_id, channel_name, encrypted_channel_key};
        await this.populateEncryptedChannelFields(channel);

        console.log("new channel", channelEntry);

        // TODO: render channel in list

    }


    async createEncryptedSharedKey(user, shared_sym) {
        const user_pk = await importFromPem(user.public_key);

        return await RSAWrapSym(user_pk, shared_sym);
    }

    async channelGetSharedKey(channel) {

        if (channel.shared_key) {
            return channel.shared_key;
        }

        const my_key = await (await getCurrentSession()).getAccountKey();


        const shared_key = await RSAUnwrapSym(my_key.privateKey, await B64toUint8Array(channel.encrypted_channel_key));

        return shared_key;

    }

    async populateEncryptedChannelFields(channel, keep_key=false, shared_key) {
        
        if (!shared_key) {
            shared_key = await this.channelGetSharedKey(channel);
        }

        if (keep_key) {
            channel.shared_key = shared_key;
        } else {
            delete channel.shared_key;
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

    async editChannel(channel, channel_name) {

        const channel_id = channel.channel_id;

        const encrypted_channel_name = await encryptSymB64(new TextEncoder().encode(channel_name).buffer, channel.shared_key);

        const res = await API.PATCH(`chat/channel/${channel_id}`,{
            channel_name: encrypted_channel_name
        })

        if (res.success) {
            const updatedChannel = {...channel, ...res.data};
            await this.populateEncryptedChannelFields(updatedChannel, true);
            res.data = updatedChannel;
        }
        return res;
    }
    
}

export const channelManager = new ChannelManager();