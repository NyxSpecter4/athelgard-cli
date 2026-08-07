/**
 * ATHELGARD DISCORD ALERTER — Webhook notifications for baseline events
 * Sends: Score drops, downtime alerts, daily summaries
 */

const https = require('https');

class DiscordAlerter {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
    this.baseUrl = webhookUrl ? new URL(webhookUrl).hostname : null;
    this.path = webhookUrl ? new URL(webhookUrl).pathname : null;
  }

  async send(payload) {
    if (!this.webhookUrl) {
      console.log('❌ No Discord webhook configured. Run: athelgard config');
      return false;
    }

    return new Promise((resolve) => {
      const data = JSON.stringify(payload);
      const req = https.request({
        hostname: this.baseUrl,
        path: this.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        resolve(res.statusCode === 204);
      });
      req.on('error', () => resolve(false));
      req.write(data);
      req.end();
    });
  }

  // ===== ALERT TEMPLATES =====

  async scoreDrop(siteName, currentScore, previousScore, url) {
    const drop = previousScore - currentScore;
    return this.send({
      username: 'Athelgard Baseline',
      avatar_url: 'https://cdn.discordapp.com/emojis/🔥.png',
      embeds: [{
        title: `📉 ${siteName} Score Drop`,
        color: 0xef4444,
        fields: [
          { name: 'Current Score', value: `${currentScore}/100`, inline: true },
          { name: 'Previous', value: `${previousScore}/100`, inline: true },
          { name: 'Drop', value: `-${drop} points`, inline: true },
          { name: 'URL', value: url }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Athelgard Baseline Monitor' }
      }]
    });
  }

  async siteDown(siteName, url, error) {
    return this.send({
      username: 'Athelgard Baseline',
      embeds: [{
        title: `🔴 ${siteName} IS DOWN`,
        color: 0xef4444,
        description: `**${siteName}** is not responding`,
        fields: [
          { name: 'URL', value: url },
          { name: 'Error', value: error || 'Connection failed' }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Athelgard Baseline Monitor' }
      }]
    });
  }

  async siteRecovered(siteName, url, score) {
    return this.send({
      username: 'Athelgard Baseline',
      embeds: [{
        title: `🟢 ${siteName} Recovered`,
        color: 0x10b981,
        description: `**${siteName}** is back online`,
        fields: [
          { name: 'URL', value: url },
          { name: 'Score', value: `${score}/100`, inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    });
  }

  async dailySummary(results) {
    const fields = results.map(r => {
      const icon = r.isUp ? '🟢' : '🔴';
      const trend = r.trend === 'improving' ? '📈' : r.trend === 'declining' ? '📉' : '➡️';
      return {
        name: `${icon} ${r.name}`,
        value: `Score: **${r.score}/100** ${trend}\nLoad: ${r.ttfb}ms | Size: ${r.size}`,
        inline: false
      };
    });

    const avgScore = Math.round(results.reduce((a, b) => a + b.score, 0) / results.length);
    const color = avgScore >= 80 ? 0x10b981 : avgScore >= 60 ? 0x3b82f6 : 0xf59e0b;

    return this.send({
      username: 'Athelgard Baseline',
      embeds: [{
        title: `📊 Daily Baseline Summary`,
        color: color,
        description: `Average fleet score: **${avgScore}/100**`,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: 'Athelgard Baseline Monitor — Run: node baseline-pro.js run' }
      }]
    });
  }

  async barometer(results) {
    // Quick 1-line status for each site
    const lines = results.map(r => {
      const icon = r.isUp ? '🟢' : '🔴';
      const scoreBar = '█'.repeat(Math.round(r.score / 10)) + '░'.repeat(10 - Math.round(r.score / 10));
      return `${icon} **${r.name}** [${scoreBar}] ${r.score}/100 | ${r.ttfb}ms`;
    });

    return this.send({
      username: 'Athelgard Barometer',
      content: `**🌡️ ATHELGARD BAROMETER** — ${new Date().toLocaleTimeString()}

${lines.join('\n')}

${results.every(r => r.isUp) ? '✅ All systems operational' : '⚠️ Some sites need attention'}

_Run \`node baseline-pro.js run\` for full report_`
    });
  }
}

module.exports = DiscordAlerter;
