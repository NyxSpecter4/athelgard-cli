/**
 * ATHELGARD SKILL: Vercel Deployment Manager
 * Superpowers: Deploy, check status, manage env vars, domains
 */

const https = require('https');

class VercelManager {
  constructor(token) {
    this.token = token;
    this.baseUrl = 'api.vercel.com';
  }

  _request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const data = options.body ? JSON.stringify(options.body) : null;
      const req = https.request({
        hostname: this.baseUrl,
        path: path,
        method: options.method || 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...options.headers
        }
      }, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
            else reject(new Error(json.error?.message || `Vercel API ${res.statusCode}`));
          } catch { resolve(body); }
        });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  // ===== PROJECTS =====
  async listProjects() {
    const result = await this._request('/v9/projects');
    return result.projects || [];
  }

  async getProject(nameOrId) {
    return this._request(`/v9/projects/${encodeURIComponent(nameOrId)}`);
  }

  // ===== DEPLOYMENTS =====
  async listDeployments(projectId, limit = 10) {
    const result = await this._request(`/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=${limit}`);
    return result.deployments || [];
  }

  async getDeployment(id) {
    return this._request(`/v13/deployments/${encodeURIComponent(id)}`);
  }

  async getDeploymentStatus(id) {
    const dep = await this.getDeployment(id);
    return {
      id: dep.id,
      url: dep.url,
      state: dep.readyState,
      created: dep.created,
      creator: dep.creator?.username || 'unknown',
      regions: dep.regions || [],
      inspectorUrl: dep.inspectorUrl
    };
  }

  // ===== ENVIRONMENT VARIABLES =====
  async getEnvVars(projectId) {
    const result = await this._request(`/v9/projects/${encodeURIComponent(projectId)}/env`);
    return result.envs || [];
  }

  async addEnvVar(projectId, key, value, target = ['production']) {
    return this._request(`/v10/projects/${encodeURIComponent(projectId)}/env`, {
      method: 'POST',
      body: { key, value, target }
    });
  }

  async removeEnvVar(projectId, envId) {
    return this._request(`/v9/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(envId)}`, {
      method: 'DELETE'
    });
  }

  // ===== DOMAINS =====
  async getDomains(projectId) {
    const result = await this._request(`/v9/projects/${encodeURIComponent(projectId)}/domains`);
    return result.domains || [];
  }

  // ===== TEAM / USER =====
  async getUser() {
    return this._request('/v2/user');
  }

  async getTeams() {
    const result = await this._request('/v2/teams');
    return result.teams || [];
  }

  // ===== STATUS ICONS =====
  static statusIcon(state) {
    const map = {
      READY: '✅',
      ERROR: '❌',
      BUILDING: '🔨',
      QUEUED: '⏳',
      CANCELED: '🚫',
      INITIALIZING: '🚀'
    };
    return map[state] || '❓';
  }

  // ===== FORMATTERS =====
  static formatDate(iso) {
    if (!iso) return 'unknown';
    const d = new Date(iso);
    return d.toLocaleString();
  }

  static formatDuration(ms) {
    if (!ms) return '';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
    return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
  }
}

module.exports = VercelManager;
