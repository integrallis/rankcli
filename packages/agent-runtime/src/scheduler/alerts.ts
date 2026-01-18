/**
 * Alerts Module
 *
 * Sends notifications via Slack, Discord, and email webhooks when SEO events occur.
 */

export type AlertType = 'error' | 'score_drop' | 'weekly_report' | 'pr_created';
export type AlertChannel = 'slack' | 'discord' | 'email';
export type AlertSeverity = 'info' | 'success' | 'warning' | 'error';

export interface AlertConfig {
  type: AlertChannel;
  webhookUrl: string;
  on: AlertType[];
  scoreDropThreshold?: number;
}

export interface AuditAlertPayload {
  projectId: string;
  projectName: string;
  url: string;
  score: number;
  previousScore?: number;
  issuesFound: number;
  errorCount?: number;
  prUrl?: string;
  prNumber?: number;
  timestamp: string;
}

export interface AlertMessage {
  title: string;
  body: string;
  severity: AlertSeverity;
  url?: string;
}

export interface AlertResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

const SEVERITY_COLORS: Record<AlertSeverity, { slack: string; discord: number }> = {
  info: { slack: '#2196F3', discord: 0x2196f3 },
  success: { slack: '#4CAF50', discord: 0x4caf50 },
  warning: { slack: '#FF9800', discord: 0xff9800 },
  error: { slack: '#F44336', discord: 0xf44336 },
};

/**
 * Formats an alert message based on type and payload
 */
export function formatAlertMessage(type: AlertType, payload: AuditAlertPayload): AlertMessage {
  const { projectName, url, score, previousScore, issuesFound, errorCount, prUrl, prNumber } = payload;

  switch (type) {
    case 'score_drop': {
      const change = previousScore !== undefined ? score - previousScore : 0;
      return {
        title: `⚠️ Score Drop Alert: ${projectName}`,
        body: `The SEO score for ${url} dropped from ${previousScore} to ${score} (${change} points).\n\n` +
          `Issues found: ${issuesFound}`,
        severity: 'warning',
        url,
      };
    }

    case 'error': {
      return {
        title: `🚨 Critical Issues Detected: ${projectName}`,
        body: `The SEO audit for ${url} found ${errorCount || issuesFound} errors that need immediate attention.\n\n` +
          `Current score: ${score}/100`,
        severity: 'error',
        url,
      };
    }

    case 'weekly_report': {
      const change = previousScore !== undefined ? score - previousScore : 0;
      const changeText = change > 0 ? `+${change}` : change.toString();
      return {
        title: `📊 Weekly SEO Report: ${projectName}`,
        body: `Your weekly SEO summary for ${url}:\n\n` +
          `• Score: ${score}/100 (${previousScore !== undefined ? changeText + ' from last week' : 'baseline'})\n` +
          `• Issues: ${issuesFound}`,
        severity: 'info',
        url,
      };
    }

    case 'pr_created': {
      return {
        title: `✅ PR Created: ${projectName}`,
        body: `A new pull request (#${prNumber}) has been created to fix SEO issues for ${url}.\n\n` +
          `View PR: ${prUrl?.replace('https://', '')}`,
        severity: 'success',
        url: prUrl,
      };
    }

    default:
      return {
        title: `SEO Alert: ${projectName}`,
        body: `Score: ${score}/100, Issues: ${issuesFound}`,
        severity: 'info',
        url,
      };
  }
}

/**
 * Determines if an alert should be sent based on config and payload
 */
export function shouldSendAlert(
  config: AlertConfig,
  type: AlertType,
  payload?: AuditAlertPayload
): boolean {
  // Check if type is in config.on
  if (!config.on.includes(type)) {
    return false;
  }

  // Special handling for score_drop with threshold
  if (type === 'score_drop' && config.scoreDropThreshold && payload) {
    const drop = (payload.previousScore ?? 0) - payload.score;
    return drop >= config.scoreDropThreshold;
  }

  return true;
}

/**
 * Formats a Slack message with blocks
 */
function formatSlackMessage(message: AlertMessage): object {
  const color = SEVERITY_COLORS[message.severity].slack;

  return {
    attachments: [
      {
        color,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: message.title,
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message.body,
            },
          },
          ...(message.url
            ? [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `<${message.url}|View Details>`,
                  },
                },
              ]
            : []),
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `🤖 Sent by SEO Autopilot`,
              },
            ],
          },
        ],
      },
    ],
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: message.title,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message.body,
        },
      },
    ],
  };
}

/**
 * Formats a Discord message with embeds
 */
function formatDiscordMessage(message: AlertMessage): object {
  const color = SEVERITY_COLORS[message.severity].discord;

  return {
    embeds: [
      {
        title: message.title,
        description: message.body,
        color,
        url: message.url,
        footer: {
          text: '🤖 Sent by SEO Autopilot',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Sends an alert to Slack webhook
 */
export async function sendSlackAlert(
  webhookUrl: string,
  type: AlertType,
  payload: AuditAlertPayload
): Promise<AlertResult> {
  const message = formatAlertMessage(type, payload);
  const slackMessage = formatSlackMessage(message);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Slack webhook failed with status ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Sends an alert to Discord webhook
 */
export async function sendDiscordAlert(
  webhookUrl: string,
  type: AlertType,
  payload: AuditAlertPayload
): Promise<AlertResult> {
  const message = formatAlertMessage(type, payload);
  const discordMessage = formatDiscordMessage(message);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordMessage),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Discord webhook failed with status ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Sends an alert based on config
 */
export async function sendAlert(
  config: AlertConfig,
  type: AlertType,
  payload: AuditAlertPayload
): Promise<AlertResult> {
  // Check if we should send this alert
  if (!shouldSendAlert(config, type, payload)) {
    return { success: true, skipped: true };
  }

  switch (config.type) {
    case 'slack':
      return sendSlackAlert(config.webhookUrl, type, payload);
    case 'discord':
      return sendDiscordAlert(config.webhookUrl, type, payload);
    case 'email':
      // Email would require SMTP setup - skip for now
      return { success: true, skipped: true };
    default:
      return { success: false, error: `Unknown alert type: ${config.type}` };
  }
}

/**
 * Sends alerts to multiple configs
 */
export async function sendAlerts(
  configs: AlertConfig[],
  type: AlertType,
  payload: AuditAlertPayload
): Promise<AlertResult[]> {
  return Promise.all(configs.map((config) => sendAlert(config, type, payload)));
}
