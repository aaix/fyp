import API from "./api";
import { decryptB64Sym, encryptSymB64, importFromPem, RSAUnwrapSym, RSAWrapSym } from "./keyhandler";
import { getCurrentSession } from "./session";
import { B64toUint8Array } from "./utils";

class ChannelManager {
    constructor() {
        // Cache per-channel encrypted keys so we can decrypt later updates
        // for modified channels (no encrypted_channel_key)
        this.channelStore = new Map()
        this.onChannelUpsert = null
    }

    startTyping(channel_id) {
        return API.PUT(`chat/channel/${channel_id}/typing`);
    }

    onUserTyping(channel_id, user_id) {
        
    }

    async processNewChannel(channel_id, channel_name, encrypted_channel_key) {
        const isNew = !!encrypted_channel_key;
        const channel = { channel_id, channel_name, encrypted_channel_key };

        // if encrypted channel key is sent it must be a new channel
        if (encrypted_channel_key) {
            // Store encrypted key immediately for later updates.
            this.channelStore.set(channel_id, { encrypted_channel_key, shared_key: null });

            await this.populateEncryptedChannelFields(channel);
            channel.last_accessed = channel.last_accessed ?? Math.floor(Date.now() / 1000);
        }

        // else we need to merge the channel with the cached channel list to get the key
        else {
            const cached = this.channelStore.get(channel_id);
            if (cached?.encrypted_channel_key) {
                channel.encrypted_channel_key = cached.encrypted_channel_key;
                await this.populateEncryptedChannelFields(channel, false, cached?.shared_key);
            }
        }

        this.onChannelUpsert?.(channel, isNew);
    }

    setOnChannelUpsert(fn) {
        this.onChannelUpsert = fn ?? null;
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

        if (channel.channel_name != null) {
            channel.channel_name = new TextDecoder().decode(
                await decryptB64Sym(channel.channel_name, shared_key)
            );
        }
            
    }


    async getChannels() {
        const res = await API.GET("chat/channels");
        if (!res.success) {
            return res
        }

        await Promise.all(res.data.channels.map(async (channel) => {
            // modify channel in place
            await this.populateEncryptedChannelFields(channel, false);
            if (channel?.encrypted_channel_key) {
                this.channelStore.set(channel.channel_id, { encrypted_channel_key: channel.encrypted_channel_key, shared_key: null });
            }
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
        if (channel?.encrypted_channel_key) {
            this.channelStore.set(channel.channel_id, {
                encrypted_channel_key: channel.encrypted_channel_key,
                shared_key: channel.shared_key ?? null
            });
        }

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

            if (updatedChannel?.encrypted_channel_key) {
                this.channelStore.set(updatedChannel.channel_id, {
                    encrypted_channel_key: updatedChannel.encrypted_channel_key,
                    shared_key: updatedChannel.shared_key ?? null,
                });
            }
        }
        return res;
    }
    
}


class MessageManager {
    
    constructor() {
        this.activeChannel = null;
        this.onMessageCreateCb = null;
    }

    setActiveChannel(channel) {
        this.activeChannel = channel ?? null;
    }

    setOnMessageCreate(fn) {
        this.onMessageCreateCb = fn ?? null;
    }

    async populateEncryptedMessageFields(key, message) {

        const ciphertext = message.content;

        const plaintext = await decryptB64Sym(ciphertext, key);

        message.content = plaintext;

        return message;

    }

    async onMessage(event) {
        if (!event || event.intent !== 'message_create') return;

        const channel = this.activeChannel;
        if (!channel) return;
        if (event.channel_id !== channel.channel_id) return;

        const key = channel.shared_key;
        if (!key) return;

        let decryptedContent = null;
        if (event.content) {
            decryptedContent = await decryptB64Sym(event.content, key);
        }

        const uiMessage = {
            channel_id: event.channel_id,
            bucket: null,
            message_id: event.message_id,
            message_type: event.message_type,
            last_edited: null,
            content: decryptedContent,
            attachment_asset_id: event.attachment_id ?? null,
            author_id: event.author_id ?? null,
        };

        this.onMessageCreateCb?.(uiMessage);

    }


    async getMessages(channel, before=null, count=null) {

        const key = channel.shared_key;

        if (!key) {
            throw new Error("Missing channel key");
        }


        let params = new URLSearchParams();
        if (before) {
            params.append("before", before);
        }
        if (count) {
            params.append("count", count);
        }

        let url = `chat/channel/${channel.channel_id}/messages?${params.toString()}`


        const res = await API.GET(url);

        if (!res.success) return res;

        const messages = res.data.messages.map((m) => this.populateEncryptedMessageFields(key, m)).reverse();
        

        res.data.messages = messages;

        return res;
    }

    async sendMessage(channel, message) {

        if (message.attachment || message.attachment_type) {
            throw new Error("Attachments not yet supported")
        }


        const { content } = message;


        const key = channel.shared_key;

        if (!key) {
            throw new Error("Missing channel key");
        }

        
        const ciphertext = await encryptSymB64(content, key);

        return await API.POST(`chat/channel/${channel.channel_id}/message`, {
            content: ciphertext,
            message_type: 0,
        })

    }
}

export const channelManager = new ChannelManager();
export const messageManager = new MessageManager();