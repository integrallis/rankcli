import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendSlackAlert,
  sendDiscordAlert,
  sendAlert,
  formatAlertMessage,
  shouldSendAlert,
  AlertConfig,
  AlertType,
  AuditAlertPayload,
} from './alerts.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('formatAlertMessage', () => {
    it('formats score drop alert with details', () => {
      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 55,
        previousScore: 72,
        issuesFound: 5,
        timestamp: '2024-01-15T10:00:00Z',
      };

      const message = formatAlertMessage('score_drop', payload);

      expect(message.title).toContain('Score Drop');
      expect(message.title).toContain('My App');
      expect(message.body).toContain('55');
      expect(message.body).toContain('72');
      expect(message.body).toContain('-17');
      expect(message.severity).toBe('warning');
    });

    it('formats error alert with severity', () => {
      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 45,
        issuesFound: 8,
        errorCount: 3,
        timestamp: '2024-01-15T10:00:00Z',
      };

      const message = formatAlertMessage('error', payload);

      expect(message.title).toContain('Critical Issues');
      expect(message.body).toContain('3 errors');
      expect(message.severity).toBe('error');
    });

    it('formats weekly report alert', () => {
      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 78,
        previousScore: 72,
        issuesFound: 2,
        timestamp: '2024-01-15T10:00:00Z',
      };

      const message = formatAlertMessage('weekly_report', payload);

      expect(message.title).toContain('Weekly SEO Report');
      expect(message.body).toContain('78');
      expect(message.body).toContain('+6');
      expect(message.severity).toBe('info');
    });

    it('formats PR created alert', () => {
      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 65,
        issuesFound: 4,
        prUrl: 'https://github.com/owner/repo/pull/42',
        prNumber: 42,
        timestamp: '2024-01-15T10:00:00Z',
      };

      const message = formatAlertMessage('pr_created', payload);

      expect(message.title).toContain('PR Created');
      expect(message.body).toContain('#42');
      expect(message.body).toContain('github.com');
      expect(message.severity).toBe('success');
    });
  });

  describe('shouldSendAlert', () => {
    it('returns true when alert type is in config', () => {
      const config: AlertConfig = {
        type: 'slack',
        webhookUrl: 'https://hooks.slack.com/...',
        on: ['error', 'score_drop'],
      };

      expect(shouldSendAlert(config, 'error')).toBe(true);
      expect(shouldSendAlert(config, 'score_drop')).toBe(true);
    });

    it('returns false when alert type is not in config', () => {
      const config: AlertConfig = {
        type: 'slack',
        webhookUrl: 'https://hooks.slack.com/...',
        on: ['error'],
      };

      expect(shouldSendAlert(config, 'weekly_report')).toBe(false);
      expect(shouldSendAlert(config, 'pr_created')).toBe(false);
    });

    it('returns true for score_drop when threshold exceeded', () => {
      const config: AlertConfig = {
        type: 'slack',
        webhookUrl: 'https://hooks.slack.com/...',
        on: ['score_drop'],
        scoreDropThreshold: 10,
      };

      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 55,
        previousScore: 70, // 15 point drop
        issuesFound: 5,
        timestamp: '2024-01-15T10:00:00Z',
      };

      expect(shouldSendAlert(config, 'score_drop', payload)).toBe(true);
    });

    it('returns false for score_drop when threshold not exceeded', () => {
      const config: AlertConfig = {
        type: 'slack',
        webhookUrl: 'https://hooks.slack.com/...',
        on: ['score_drop'],
        scoreDropThreshold: 10,
      };

      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 68,
        previousScore: 72, // 4 point drop, below threshold
        issuesFound: 1,
        timestamp: '2024-01-15T10:00:00Z',
      };

      expect(shouldSendAlert(config, 'score_drop', payload)).toBe(false);
    });
  });

  describe('sendSlackAlert', () => {
    it('sends formatted message to Slack webhook', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 72,
        issuesFound: 3,
        timestamp: '2024-01-15T10:00:00Z',
      };

      const result = await sendSlackAlert(
        'https://hooks.slack.com/services/xxx',
        'weekly_report',
        payload
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/xxx',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Weekly SEO Report'),
        })
      );
    });

    it('formats Slack message with blocks', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 55,
        previousScore: 70,
        issuesFound: 5,
        timestamp: '2024-01-15T10:00:00Z',
      };

      await sendSlackAlert('https://hooks.slack.com/xxx', 'score_drop', payload);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.blocks).toBeDefined();
      expect(callBody.blocks.length).toBeGreaterThan(0);
    });

    it('handles Slack API errors', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 72,
        issuesFound: 2,
        timestamp: '2024-01-15T10:00:00Z',
      };

      const result = await sendSlackAlert(
        'https://hooks.slack.com/invalid',
        'weekly_report',
        payload
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 72,
        issuesFound: 2,
        timestamp: '2024-01-15T10:00:00Z',
      };

      const result = await sendSlackAlert(
        'https://hooks.slack.com/xxx',
        'weekly_report',
        payload
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('sendDiscordAlert', () => {
    it('sends formatted message to Discord webhook', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 72,
        issuesFound: 3,
        timestamp: '2024-01-15T10:00:00Z',
      };

      const result = await sendDiscordAlert(
        'https://discord.com/api/webhooks/xxx',
        'weekly_report',
        payload
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/xxx',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('formats Discord message with embeds', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 55,
        previousScore: 70,
        issuesFound: 5,
        timestamp: '2024-01-15T10:00:00Z',
      };

      await sendDiscordAlert('https://discord.com/api/webhooks/xxx', 'score_drop', payload);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.embeds).toBeDefined();
      expect(callBody.embeds.length).toBeGreaterThan(0);
      expect(callBody.embeds[0].color).toBeDefined();
    });

    it('handles Discord API errors', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 72,
        issuesFound: 2,
        timestamp: '2024-01-15T10:00:00Z',
      };

      const result = await sendDiscordAlert(
        'https://discord.com/api/webhooks/invalid',
        'weekly_report',
        payload
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    });
  });

  describe('sendAlert', () => {
    it('sends to Slack when type is slack', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const config: AlertConfig = {
        type: 'slack',
        webhookUrl: 'https://hooks.slack.com/xxx',
        on: ['weekly_report'],
      };

      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 72,
        issuesFound: 3,
        timestamp: '2024-01-15T10:00:00Z',
      };

      const result = await sendAlert(config, 'weekly_report', payload);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/xxx',
        expect.anything()
      );
    });

    it('sends to Discord when type is discord', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const config: AlertConfig = {
        type: 'discord',
        webhookUrl: 'https://discord.com/api/webhooks/xxx',
        on: ['error'],
      };

      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 45,
        issuesFound: 8,
        errorCount: 3,
        timestamp: '2024-01-15T10:00:00Z',
      };

      const result = await sendAlert(config, 'error', payload);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/xxx',
        expect.anything()
      );
    });

    it('skips alert if type not in config.on', async () => {
      const config: AlertConfig = {
        type: 'slack',
        webhookUrl: 'https://hooks.slack.com/xxx',
        on: ['error'],
      };

      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 72,
        issuesFound: 3,
        timestamp: '2024-01-15T10:00:00Z',
      };

      const result = await sendAlert(config, 'weekly_report', payload);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('handles multiple alert configs', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const configs: AlertConfig[] = [
        {
          type: 'slack',
          webhookUrl: 'https://hooks.slack.com/xxx',
          on: ['error', 'score_drop'],
        },
        {
          type: 'discord',
          webhookUrl: 'https://discord.com/api/webhooks/xxx',
          on: ['weekly_report'],
        },
      ];

      const payload: AuditAlertPayload = {
        projectId: 'proj-1',
        projectName: 'My App',
        url: 'https://myapp.com',
        score: 55,
        previousScore: 70,
        issuesFound: 5,
        timestamp: '2024-01-15T10:00:00Z',
      };

      // Send to all configs
      const results = await Promise.all(
        configs.map(config => sendAlert(config, 'score_drop', payload))
      );

      // Slack should send (score_drop is in its config)
      expect(results[0].success).toBe(true);
      expect(results[0].skipped).toBeFalsy();

      // Discord should skip (score_drop not in its config)
      expect(results[1].success).toBe(true);
      expect(results[1].skipped).toBe(true);
    });
  });
});
