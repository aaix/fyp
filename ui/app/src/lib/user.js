import API from "./api";
import { getAvatarUrl } from "./utils.js";
import { gatewayFactory } from "./gateway.js";


// helper for ui
export function mapSearchResponseToUserList(data) {
    return data.map((user) => {
        const icon_url = getAvatarUrl(user);
        return { icon_url, username: user.username, user_id: user.user_id, public_key: user.public_key };
    });
}


export class UserManager {
    async searchUsers(query) {
        const res = await API.GET(`user/search?q=${encodeURIComponent(query)}`);
        return res;
    }

    async getUserProfile(user_id) {
        const res = await API.GET(`user/profile/${user_id}`);

        return res;
    }

    async fetchUsersBulk(user_ids) {
        const gateway = await gatewayFactory();
        return await gateway.user_store.getUsersBulk(user_ids);
    }

}

export const userManager = new UserManager();

export const PEER_PROFILE_RELATIONSHIP_TYPES = Object.freeze([1, 2, 3, 5, 6]);

export class RelationshipManager {

    /**
     * @constructor
     */
    constructor() {
        /** @type {Record<string, Set<number>>} */
        this.richRelationships = {};
        /** @type {Map<number, Promise<unknown>>} */
        this._inFlightByType = new Map();
        /** @type {Map<string, Promise<number[]>>} */
        this._inFlightPeerResolve = new Map();
    }

    CURRENT_REQUESTING_PEER = 1
    PEER_REQUESTING_CURRENT = 2

    FRIENDS = 3

    PEER_BLOCKED_CURRENT = 5
    CURRENT_BLOCKED_PEER = 6

    CURRENT_FOLLOWING_PEER = 7
    PEER_FOLLOWING_CURRENT = 8

    _peerKey(peer_id) {
        return peer_id == null ? "" : String(peer_id);
    }

    /**
     * @param {string} key
     * @returns {Set<number>|undefined}
     */
    _getTypeSetForPeerKey(key) {
        const v = this.richRelationships[key];
        if (v instanceof Set) return v;
        if (typeof v === "number") {
            return new Set([v]);
        }
        return undefined;
    }

    _peerHasType(peerKey, relType) {
        const t = Number(relType);
        const v = this.richRelationships[peerKey];
        if (v instanceof Set) return v.has(t);
        if (typeof v === "number") return v === t;
        return false;
    }

    /**
     * @returns {number[]|undefined} sorted unique types for this peer (copy)
     */
    getPeerRelationshipTypes(user_id) {
        const key = this._peerKey(user_id);
        const v = this.richRelationships[key];
        if (v instanceof Set) {
            if (v.size === 0) return undefined;
            return [...v].sort((a, b) => a - b);
        }
        if (typeof v === "number") {
            return [v];
        }
        return undefined;
    }

    /**
     * Replaces all known types for this peer with a single type (mutations, gateway events).
     * Pass `null` to clear the peer entry.
     */
    updateRelationships(peer_id, new_relationship_type) {
        const key = this._peerKey(peer_id);
        if (!new_relationship_type) {
            delete this.richRelationships[key];
            return;
        }

        this.richRelationships[key] = new Set([Number(new_relationship_type)]);
    }

    /**
     * Adds or removes one relationship type for a peer when merging a typed list from the API.
     */
    _addRelationshipTypeForPeer(peerKey, relType) {
        const t = Number(relType);
        const raw = this.richRelationships[peerKey];
        let set;
        if (raw instanceof Set) {
            set = raw;
        } else if (typeof raw === "number") {
            set = new Set([raw]);
            this.richRelationships[peerKey] = set;
        } else {
            set = new Set();
            this.richRelationships[peerKey] = set;
        }
        set.add(t);
    }

    _removeRelationshipTypeForPeer(peerKey, relType) {
        const t = Number(relType);
        const raw = this.richRelationships[peerKey];
        let set;
        if (raw instanceof Set) {
            set = raw;
        } else if (typeof raw === "number") {
            set = new Set([raw]);
            this.richRelationships[peerKey] = set;
        } else {
            return;
        }
        set.delete(t);
        if (set.size === 0) {
            delete this.richRelationships[peerKey];
        }
    }

    _mergeRelationshipsForType(relType, items) {
        const t = Number(relType);
        const list = items ?? [];
        const newPeerIds = new Set(list.map((r) => this._peerKey(r.peer_id)));

        for (const k of Object.keys(this.richRelationships)) {
            if (this._peerHasType(k, t) && !newPeerIds.has(k)) {
                this._removeRelationshipTypeForPeer(k, t);
            }
        }

        for (const r of list) {
            const pk = this._peerKey(r.peer_id);
            const rel = r.relationship != null ? Number(r.relationship) : t;
            this._addRelationshipTypeForPeer(pk, rel);
        }
    }

    async _doFetchRelationshipsForType(relType) {
        const t = Number(relType);
        const res = await API.GET(`user/relationships?t=${encodeURIComponent(t)}`);

        if (!res.success) return res;

        const rels = res.data?.relationships ?? [];
        this._mergeRelationshipsForType(t, rels);
        return res;
    }

    _ensureRelationshipsForType(relType) {
        const t = Number(relType);
        if (Number.isNaN(t)) {
            return Promise.resolve({ success: false, error: { message: "Invalid relationship type" } });
        }

        const existing = this._inFlightByType.get(t);
        if (existing) return existing;

        const p = this._doFetchRelationshipsForType(t).finally(() => {
            this._inFlightByType.delete(t);
        });

        this._inFlightByType.set(t, p);
        return p;
    }

    _successResponseFromStore(relTypeFilter) {
        const ft = Number(relTypeFilter);
        const relationships = [];

        for (const peer_id of Object.keys(this.richRelationships)) {
            const set = this._getTypeSetForPeerKey(peer_id);
            if (set && set.has(ft)) {
                relationships.push({ peer_id, relationship: ft });
            }
        }

        return {
            success: true,
            data: {
                relationships,
            },
        };
    }

    /**
     * Fetches one relationship list from the API for the given type and merges into `richRelationships`.
     * Concurrent callers for the same type share one in-flight request.
     *
     * @param {number} rel_type - Required. There is no “fetch all types” mode in the manager.
     */
    async getRelationships(rel_type) {
        const relTypeNum =
            rel_type === null || rel_type === undefined || rel_type === "" ? NaN : Number(rel_type);

        if (Number.isNaN(relTypeNum)) {
            return { success: false, error: { message: "relationship type is required" } };
        }

        const res = await this._ensureRelationshipsForType(relTypeNum);
        if (!res.success) return res;
        return this._successResponseFromStore(relTypeNum);
    }

    /**
     * @returns {number[]|undefined} All cached relationship types with this peer (sorted copy).
     */
    getRelationshipWithUser(user_id) {
        return this.getPeerRelationshipTypes(user_id);
    }

    /**
     * Normalizes relationship list from `GET /user/relationship/{user_id}`.
     * API may return `data` as a bare array, or `{ relationships: [...] }`, or `{ relationship: n }`.
     */
    _relationshipRowsFromResponseData(data) {
        if (data == null) return [];
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.relationships)) return data.relationships;
        return [];
    }

    /**
     * Merges `GET /user/relationship/{user_id}` response into `richRelationships` for that peer.
     * @param {string} peerUserId
     * @param {object|null|undefined} data - API `data` payload (often a JSON array of rows)
     */
    _applyPeerRelationshipFetchData(peerUserId, data) {
        const key = this._peerKey(peerUserId);
        if (data == null) {
            delete this.richRelationships[key];
            return;
        }
        if (
            !Array.isArray(data) &&
            data.relationship != null &&
            data.relationships == null &&
            !Array.isArray(data.relationships)
        ) {
            this.richRelationships[key] = new Set([Number(data.relationship)]);
            return;
        }
        const rels = this._relationshipRowsFromResponseData(data);
        if (rels.length === 0) {
            delete this.richRelationships[key];
            return;
        }
        const types = new Set(rels.map((r) => Number(r.relationship)));
        this.richRelationships[key] = types;
    }

    /**
     * `GET /user/relationship/{user_id}?types=…&types=…` — reads relationship with one peer for the given type(s).
     * Does not update the cache; use `resolveRelationshipWithUser` for cache + fallback.
     *
     * @param {string} user_id - Peer user id
     * @param {number[]} relationship_types - RelationshipType values to query
     */
    async fetchRelationshipWithUser(user_id, relationship_types) {
        const types = Array.isArray(relationship_types) ? relationship_types : [relationship_types];
        const params = new URLSearchParams();
        for (const t of types) {
            params.append("types", String(t));
        }
        const q = params.toString();
        const idSeg = encodeURIComponent(String(user_id));
        const path = `user/relationship/${idSeg}${q ? `?${q}` : ""}`;
        return await API.GET(path);
    }

    /**
     * Clears cached relationship data for a peer so the next resolve fetches from the API.
     * Use on profile views to avoid showing incomplete state from partial list caches.
     */
    invalidatePeerRelationship(user_id) {
        const key = this._peerKey(user_id);
        delete this.richRelationships[key];
        this._inFlightPeerResolve.delete(key);
    }

    /**
     * Cached types if present; otherwise one `GET /user/relationship/{id}` with `PEER_PROFILE_RELATIONSHIP_TYPES`.
     *
     * @param {string} user_id
     * @param {number[]} [relationship_types] - Defaults to `PEER_PROFILE_RELATIONSHIP_TYPES` (all 5).
     * @param {{ force?: boolean }} [options] - If `force`, skips cache and refetches.
     * @returns {Promise<number[]>} Sorted unique types (empty array if none)
     */
    async resolveRelationshipWithUser(user_id, relationship_types = PEER_PROFILE_RELATIONSHIP_TYPES, options = {}) {
        const key = this._peerKey(user_id);
        if (options.force) {
            this.invalidatePeerRelationship(user_id);
        }

        const cached = this.getPeerRelationshipTypes(user_id);
        if (cached?.length) {
            return cached;
        }

        const existing = this._inFlightPeerResolve.get(key);
        if (existing) return existing;

        const typesToFetch =
            relationship_types != null && relationship_types.length > 0
                ? relationship_types
                : PEER_PROFILE_RELATIONSHIP_TYPES;

        const p = (async () => {
            const res = await this.fetchRelationshipWithUser(user_id, typesToFetch);
            if (!res.success) {
                throw new Error(res.error?.message ?? "Failed to load relationship");
            }
            this._applyPeerRelationshipFetchData(user_id, res.data);
            return this.getPeerRelationshipTypes(user_id) ?? [];
        })().finally(() => {
            this._inFlightPeerResolve.delete(key);
        });

        this._inFlightPeerResolve.set(key, p);
        return p;
    }

    /**
     * Drops any cache for this peer and loads relationship types from the API (full profile query set).
     */
    async refreshPeerRelationshipWithUser(user_id, relationship_types = PEER_PROFILE_RELATIONSHIP_TYPES) {
        return this.resolveRelationshipWithUser(user_id, relationship_types, { force: true });
    }

    async blockUser(user_id) {
        const res = await API.PUT(`user/relationship/${user_id}/block`);

        if (res.success) {
            this.updateRelationships(user_id, res.data.relationship);
        }

        return res;
    }
    async unblockUser(user_id) {
        const res = await API.DELETE(`user/relationship/${user_id}/block`);

        if (res.success) {
            this.updateRelationships(user_id, null);
        }

        return res;
    }

    async friendUser(user_id) {
        const res = await API.PUT(`user/relationship/${user_id}/friend`);

        if (res.success) {
            this.updateRelationships(user_id, res.data.relationship);
        }
        return res;
    }

    async unfriendUser(user_id) {
        const res = await API.DELETE(`user/relationship/${user_id}/friend`);
        if (res.success) {
            this.updateRelationships(user_id, null);
        }
        return res;
    }
}

export const relationshipManager = new RelationshipManager();
