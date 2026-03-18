const fetch = require("node-fetch");

const BASE = "https://tree.tabors.site/api/v1";

class TreeAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async _req(method, path, body) {
    const opts = {
      method,
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(BASE + path, opts);
    const json = await res.json();

    if (!res.ok) {
      const msg = json.error || json.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return json;
  }

  get(path) {
    return this._req("GET", path);
  }
  post(path, body) {
    return this._req("POST", path, body);
  }
  put(path, body) {
    return this._req("PUT", path, body);
  }
  del(path) {
    return this._req("DELETE", path);
  }

  // ── User ─────────────────────────────────────────────────────────────────
  me() {
    return this.get("/me");
  }
  getUser(userId) {
    return this.get(`/user/${userId}`);
  }

  // ── Root ─────────────────────────────────────────────────────────────────
  getRoot(rootId) {
    return this.get(`/root/${rootId}`);
  }
  createRoot(userId, name) {
    return this.post(`/user/${userId}/createRoot`, { name });
  }

  // ── Node ─────────────────────────────────────────────────────────────────
  getNode(nodeId) {
    return this.get(`/node/${nodeId}`);
  }
  getNodeVersion(nodeId, ver = 0) {
    return this.get(`/node/${nodeId}/${ver}`);
  }
  createChild(nodeId, name) {
    return this.post(`/node/${nodeId}/createChild`, { name });
  }
  renameNode(nodeId, ver, name) {
    return this.post(`/node/${nodeId}/${ver}/editName`, { name });
  }
  moveNode(nodeId, newParentId) {
    return this.post(`/node/${nodeId}/updateParent`, { newParentId });
  }
  deleteNode(nodeId) {
    return this.post(`/node/${nodeId}/delete`, {});
  }
  setStatus(nodeId, ver, status) {
    return this.post(`/node/${nodeId}/${ver}/editStatus`, { status });
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  listNotes(nodeId, ver = 0) {
    return this.get(`/node/${nodeId}/${ver}/notes`);
  }
  createNote(nodeId, ver, content) {
    return this.post(`/node/${nodeId}/${ver}/notes`, { content });
  }
  editNote(nodeId, ver, noteId, content) {
    return this.put(`/node/${nodeId}/${ver}/notes/${noteId}`, { content });
  }
  deleteNote(nodeId, ver, noteId) {
    return this.del(`/node/${nodeId}/${ver}/notes/${noteId}`);
  }

  // ── Values ────────────────────────────────────────────────────────────────
  getValues(nodeId, ver = 0) {
    return this.get(`/node/${nodeId}/${ver}/values`);
  }
  setValue(nodeId, ver, key, value) {
    return this.post(`/node/${nodeId}/${ver}/value`, { key, value });
  }

  // ── AI ────────────────────────────────────────────────────────────────────
  chat(rootId, message) {
    return this.post(`/root/${rootId}/chat`, { message });
  }
  place(rootId, message) {
    return this.post(`/root/${rootId}/place`, { message });
  }

  // ── Raw Ideas ───────────────────────────────────────────────────────────────
  listRawIdeas(userId, opts = {}) {
    const params = new URLSearchParams();
    if (opts.status) params.set("status", opts.status);
    if (opts.q) params.set("q", opts.q);
    if (opts.limit) params.set("limit", opts.limit);
    const qs = params.toString();
    return this.get(`/user/${userId}/raw-ideas${qs ? "?" + qs : ""}`);
  }
  getRawIdea(userId, rawIdeaId) {
    return this.get(`/user/${userId}/raw-ideas/${rawIdeaId}`);
  }
  createRawIdea(userId, content) {
    return this.post(`/user/${userId}/raw-ideas`, { content });
  }
  deleteRawIdea(userId, rawIdeaId) {
    return this.del(`/user/${userId}/raw-ideas/${rawIdeaId}`);
  }
  rawIdeaPlace(userId, rawIdeaId) {
    return this.post(`/user/${userId}/raw-ideas/${rawIdeaId}/place`, {});
  }
  transferRawIdea(userId, rawIdeaId, nodeId) {
    return this.post(`/user/${userId}/raw-ideas/${rawIdeaId}/transfer`, { nodeId });
  }

  // ── Understandings ──────────────────────────────────────────────────────────
  listUnderstandings(rootId) {
    return this.get(`/root/${rootId}/understandings`);
  }
  createUnderstanding(rootId, perspective, incremental = false) {
    return this.post(`/root/${rootId}/understandings`, { perspective, incremental });
  }
  getUnderstandingRun(rootId, runId) {
    return this.get(`/root/${rootId}/understandings/run/${runId}`);
  }
  orchestrateUnderstanding(rootId, runId) {
    return this.post(`/root/${rootId}/understandings/run/${runId}/orchestrate`, {});
  }
  stopUnderstanding(rootId, runId) {
    return this.post(`/root/${rootId}/understandings/run/${runId}/stop`, {});
  }
}

module.exports = TreeAPI;
