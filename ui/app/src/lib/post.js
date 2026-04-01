import API from './api'

export const FEED_TYPE_MAIN = 0;
export const FEED_TYPE_SHORTS = 1;

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
     * @param {int} feed_type 0: main feed, 1: short form feed 
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

        let res = await API.POST(`social/post`, form, {useForm: true});

        return res;

    }

    async getUserPosts(user_id, before = null) {
        let path = `social/user/${user_id}/posts`;
        if (before) {
            const q = new URLSearchParams({ before: String(before) });
            path += `?${q.toString()}`;
        }
        return await API.GET(path);
    }
}

export const postManager = new PostManager();