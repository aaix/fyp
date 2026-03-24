import API from "./api";
import { decryptB64Sym, encryptSymB64, importFromPem, RSAUnwrapSym, RSAWrapSym } from "./keyhandler";
import { getCurrentSession } from "./session";
import { B64toUint8Array, blobToB64 } from "./utils";


const MESSAGE_TYPE_USER_REGULAR = 0;
const MESSAGE_TYPE_USER_MEDIA = 1;
const MESSAGE_TYPE_SYSTEM_EDIT_CHANNEL_NAME = 4;

/* channel name message contains the channel name ciphertext and needs to be decrypted */
function messageHasCiphertext(messageType) {
    return isUserMessageType(messageType) || messageType === MESSAGE_TYPE_SYSTEM_EDIT_CHANNEL_NAME;
}

function isUserMessageType(messageType) {
    return messageType === MESSAGE_TYPE_USER_REGULAR || messageType === MESSAGE_TYPE_USER_MEDIA;
}


class ChannelManager {
    constructor() {
        // Cache per-channel encrypted keys so we can decrypt later updates
        // for modified channels (no encrypted_channel_key)
        this.channelStore = new Map()
        this.onChannelUpsert = null
        this.onUserTypingCb = null
    }

    startTyping(channel_id) {
        return API.PUT(`chat/channel/${channel_id}/typing`);
    }

    setOnUserTyping(fn) {
        this.onUserTypingCb = fn ?? null
    }

    onUserTyping(channel_id, user_id) {
        this.onUserTypingCb?.(channel_id, user_id)
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

    async channelGetSharedKey(channel, extractable=false) {

        if (channel.shared_key && !extractable) {
            return channel.shared_key;
        }

        const my_key = await (await getCurrentSession()).getAccountKey();


        const shared_key = await RSAUnwrapSym(my_key.privateKey, await B64toUint8Array(channel.encrypted_channel_key), extractable);

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

    async addChannelMembers(channel, users) {

        const sym = await this.channelGetSharedKey(channel, true);

        const members_to_add = await Promise.all(users.map(async (u) => {
            const pk = await importFromPem(u.public_key);
            const encrypted_shared_key = await blobToB64(new Blob([await RSAWrapSym(pk, sym)]));

            return {
                encrypted_shared_key,
                user_id: u.user_id,
            }
        }))

        return await API.POST(`chat/channel/${channel.channel_id}/members`, {
            members_to_add,
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
        this.onMessageEditCb = null;
        this.onMessageDeleteCb = null;
    }

    setActiveChannel(channel) {
        this.activeChannel = channel ?? null;
    }

    setOnMessageCreate(fn) {
        this.onMessageCreateCb = fn ?? null;
    }

    setOnMessageEdit(fn) {
        this.onMessageEditCb = fn ?? null;
    }

    setOnMessageDelete(fn) {
        this.onMessageDeleteCb = fn ?? null;
    }

    async populateEncryptedMessageFields(key, message) {

        if (!messageHasCiphertext(message.message_type)) {
            return message;
        }

        const ciphertext = message.content;

        const plaintext = await decryptB64Sym(ciphertext, key);

        message.content = plaintext;

        return message;

    }

    async onMessage(event) {
        if (!event || event.intent !== 'message_create') return;

        const channel = this.activeChannel;
        if (!channel) return;
        if (String(event.channel_id) !== String(channel.channel_id)) return;

        const key = channel.shared_key;
        if (!key) return;

        // fan out includes:
        // channel_id, message_id, content, message_type, attachment_id, author_id, in_reply_to
        // bucket is not useful to the ui
        // last_edited is assumed null because the message was just created
        let decryptedContent = null;
        if (event.content && messageHasCiphertext(event.message_type)) {
            decryptedContent = await decryptB64Sym(event.content, key);
        } else if (event.content != null) {
            decryptedContent = event.content;
        }

        const message = {
            channel_id: event.channel_id,
            bucket: null,
            message_id: event.message_id,
            message_type: event.message_type,
            last_edited: null,
            content: decryptedContent,
            attachment_asset_id: event.attachment_id ?? null,
            author_id: event.author_id ?? null,
            in_reply_to: event.in_reply_to ?? null,
        };

        this.onMessageCreateCb?.(message);
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

    async sendMessage(channel, message, in_reply_to_message_id = null) {

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
            in_reply_to: in_reply_to_message_id,
        })
    }

    async fetchMessage(channel, message_id) {
        return API.GET(`chat/channel/${channel.channel_id}/message/${message_id}`);
    }

    async getMessage(channel, message_id) {
        const res = await this.fetchMessage(channel, message_id);
        if (!res.success) return res;
        const key = channel.shared_key;
        if (!key) return res;
        const m = { ...res.data };
        await this.populateEncryptedMessageFields(key, m);
        return { ...res, data: m };
    }

    async editMessage(channel, message_id, new_content) {
        const key = channel.shared_key;

        if (!key) {
            throw new Error("Missing channel key");
        }

        
        const ciphertext = await encryptSymB64(new_content, key);

        return await API.PATCH(`chat/channel/${channel.channel_id}/message/${message_id}`,
            {
                content:ciphertext
            }
        );
    }

    deleteMessage(channel, message_id) {
        return API.DELETE(`chat/channel/${channel.channel_id}/message/${message_id}`);
    }

    async onMessageEdit(event) {
        const channel = this.activeChannel;
        if (!channel) return;
        if (String(event.channel_id) !== String(channel.channel_id)) return;

        const key = channel.shared_key;
        if (!key) return;

        let decryptedContent = null;
        if (event.new_content) {
            decryptedContent = await decryptB64Sym(event.new_content, key);
        }

        this.onMessageEditCb?.({
            channel_id: event.channel_id,
            message_id: event.message_id,
            content: decryptedContent,
        });
    }

    onMessageDelete(event) {
        const channel = this.activeChannel;
        if (!channel) return;
        if (String(event.channel_id) !== String(channel.channel_id)) return;

        this.onMessageDeleteCb?.({
            channel_id: event.channel_id,
            message_id: event.message_id,
        });
    }
}

export const channelManager = new ChannelManager();
export const messageManager = new MessageManager();
export { isUserMessageType, MESSAGE_TYPE_USER_REGULAR, MESSAGE_TYPE_USER_MEDIA };