import API from './api'

export const FEED_TYPE_MAIN = "feed";
export const FEED_TYPE_SHORTS = "short";

export const POST_TYPE_IMAGE = 1;
export const POST_TYPE_VIDEO = 2;
export const POST_TYPE_SHORT = 3;

/**
 * App route for a post — same segments as {@link PostManager#getPost} (`post/user/…` relative to API base).
 *
 * @param {string} authorId
 * @param {string} feedType {@link FEED_TYPE_MAIN} | {@link FEED_TYPE_SHORTS}
 * @param {string} postId
 * @returns {string}
 */
export function postDetailPath(authorId, feedType, postId) {
    return `/post/user/${encodeURIComponent(String(authorId))}/${encodeURIComponent(String(feedType))}/${encodeURIComponent(String(postId))}`
}

/**
 * @param {string} feedType
 * @param {number} postType
 * @returns {boolean}
 */
export function feedTypeMatchesPostType(feedType, postType) {
    const pt = Number(postType)
    if (feedType === FEED_TYPE_SHORTS) return pt === POST_TYPE_SHORT
    if (feedType === FEED_TYPE_MAIN) return pt === POST_TYPE_IMAGE || pt === POST_TYPE_VIDEO
    return false
}

// from api/routes/post/post.py PostUpdateType
export const POST_UPDATE_CREATED = 0
export const POST_UPDATE_TRANSCODING = 1
export const POST_UPDATE_TRANSCODED = 2
export const POST_UPDATE_FANNING_OUT = 3
export const POST_UPDATE_FANNED_OUT = 4
export const POST_UPDATE_COMPLETED = 5
export const POST_UPDATE_ERROR = 99

/**
 * @param {number} t
 * @returns {string}
 */
export function describePostUpdateType(t) {
    const n = Number(t)
    switch (n) {
        case POST_UPDATE_CREATED:
            return 'Post created.'
        case POST_UPDATE_TRANSCODING:
            return 'Transcoding media.'
        case POST_UPDATE_TRANSCODED:
            return 'Transcoding complete.'
        case POST_UPDATE_FANNING_OUT:
            return 'Publishing to feeds.'
        case POST_UPDATE_FANNED_OUT:
            return 'Published.'
        case POST_UPDATE_COMPLETED:
            return 'Done.'
        case POST_UPDATE_ERROR:
            return 'Processing failed.'
        default:
            return 'Processing…'
    }
}

/**
 * Post manager
 *
 * @class PostManager
 * @typedef {PostManager}
 */
class PostManager {

    constructor() {
        /** @type {Map<string, Set<(updateType: number) => void>>} */
        this._postUpdateListeners = new Map()
        /** @type {Map<string, number[]>} ordered events for this post (incl. before any listener) */
        this._postUpdatesRecieved = new Map()
    }

    /**
     * @param {string} postId
     * @param {(updateType: number) => void} listener
     * @returns {() => void}
     */
    subscribePostUpdates(postId, listener) {
        const id = postId != null ? String(postId) : ''
        if (!id || typeof listener !== 'function') return () => {}
        let set = this._postUpdateListeners.get(id)
        if (!set) {
            set = new Set()
            this._postUpdateListeners.set(id, set)
        }
        set.add(listener)

        return () => {
            set.delete(listener)
            if (set.size === 0) {
                this._postUpdateListeners.delete(id)
            }
        }
    }

    /**
     * Events received before any listener subscribed (same order as live updates).
     * @param {string} postId
     * @returns {number[]}
     */
    getBufferedPostUpdates(postId) {
        const id = postId != null ? String(postId) : ''
        if (!id) return []
        const buf = this._postUpdatesRecieved.get(id)
        return buf ? [...buf] : []
    }

    /**
     * @param {string} postId
     */
    clearBufferedPostUpdates(postId) {
        const id = postId != null ? String(postId) : ''
        if (id) this._postUpdatesRecieved.delete(id)
    }

    
    /**
     * create a post
     *
     * @async
     * @param {string | null} optional_caption
     * @param {*} media_file
     * @param {string} content_type
     * @param {string} feed_type "feed" | "short"
     * @returns {APIResponse}
     */
    async createPost(optional_caption, media_file, content_type, feed_type) {

        let form = new FormData();
        


        let post_type;
        if (feed_type == FEED_TYPE_MAIN && content_type.startsWith("image/")) {
            post_type = POST_TYPE_IMAGE;
        } 
        else if (feed_type == FEED_TYPE_MAIN && content_type.startsWith("video/")) {
            post_type = POST_TYPE_VIDEO;
        }
        else if (feed_type == FEED_TYPE_SHORTS && content_type.startsWith("video/")) {
            post_type = POST_TYPE_SHORT;
        } else {
            throw new Error("Unknown feed & content type combo")
        }

        form.append("post_type", String(post_type));
        const caption = typeof optional_caption === 'string' ? optional_caption.trim() : '';
        if (caption.length > 0) {
            form.append('body', caption);
        }

        form.append("attachment", media_file);

        let res = await API.POST(`post/${encodeURIComponent(feed_type)}`, form, {useForm: true});

        return res;

    }

    /**
     * @param {string} user_id
     * @param {string} feed_type "feed" | "short"
     * @param {string | null} [before] - UUID for pagination cursor
     */
    async getUserPosts(user_id, feed_type, before = null) {
        let path = `post/user/${encodeURIComponent(user_id)}/${encodeURIComponent(feed_type)}`;
        if (before) {
            const q = new URLSearchParams({ before: String(before) });
            path += `?${q.toString()}`;
        }
        return await API.GET(path);
    }

    /**
     * 
     * @param {string} author_id 
     * @param {string} post_id 
     * @param {string} feed_type
     * @returns {APIResponse}
     */
    async getPost(author_id, feed_type, post_id) {
        return await API.GET(
            `post/user/${encodeURIComponent(author_id)}/${encodeURIComponent(feed_type)}/${encodeURIComponent(post_id)}`
        );
    }

    /**
     * 
     * @param {string} author_id 
     * @param {string} post_id 
     * @param {string} feed_type
     * @param {string | null} post_body 
     * @returns {APIResponse}
     */
    async editPost(author_id, feed_type, post_id, post_body) {
        return await API.PATCH(`post/user/${encodeURIComponent(author_id)}/${encodeURIComponent(feed_type)}/${encodeURIComponent(post_id)}`, {
            body: post_body,
        });
    }

    /**
     * 
     * @param {string} author_id
     * @param {string} feed_type 
     * @param {string} post_id 
     * @returns {APIResponse<null>}
     */
    async deletePost(author_id, feed_type, post_id) {
        return await API.DELETE(
            `post/user/${encodeURIComponent(author_id)}/${encodeURIComponent(feed_type)}/${encodeURIComponent(post_id)}`
        );
    }


    onPostUpdate(post_id, update_type) {
        const id = post_id != null ? String(post_id) : ''
        if (!id) return

        const t = update_type != null ? Number(update_type) : NaN
        const buf = this._postUpdatesRecieved.get(id) ?? []
        buf.push(t)
        this._postUpdatesRecieved.set(id, buf)

        const listeners = this._postUpdateListeners.get(id)
        if (listeners?.size) {
            for (const fn of [...listeners]) {
                try {
                    fn(t)
                } catch (e) {
                    console.error(e)
                }
            }
        }
    }


    async getFeed(feed_type, before) {
        let path = `post/${feed_type}`;

        if (before) {
            const q = new URLSearchParams({ before: String(before) });
            path += `?${q.toString()}`;
        }
        const res = await API.GET(path);

        return res;
    }

    likePost(author_id, feed_type, post_id) {
        return API.PUT(`post/user/${encodeURIComponent(author_id)}/${encodeURIComponent(feed_type)}/${encodeURIComponent(post_id)}/like`)    
    }

    unlikePost(author_id, feed_type, post_id) {
        return API.DELETE(`post/user/${encodeURIComponent(author_id)}/${encodeURIComponent(feed_type)}/${encodeURIComponent(post_id)}/like`)    
    }
}

export const postManager = new PostManager();