import API from './api'

export const FEED_TYPE_MAIN = "feed";
export const FEED_TYPE_SHORTS = "short";

export const POST_TYPE_IMAGE = 1;
export const POST_TYPE_VIDEO = 2;
export const POST_TYPE_SHORT = 3;

/**
 * Post manager
 *
 * @class PostManager
 * @typedef {PostManager}
 */
class PostManager {

    
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
}

export const postManager = new PostManager();