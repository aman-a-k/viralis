import axios from 'axios';
import { prisma } from '../lib/prisma';

export class NotificationService {
  static async sendDiscordNotification(title: string, message: string, type: 'info' | 'success' | 'error' = 'info') {
    const settings = await prisma.settings.findFirst({ where: { id: 'default' } });
    const webhookUrl = settings?.discordWebhookUrl;

    if (!webhookUrl) return;

    const colors = {
      info: 3447003,    // Blue
      success: 3066993, // Green
      error: 15158332   // Red
    };

    try {
      await axios.post(webhookUrl, {
        embeds: [{
          title: `${type.toUpperCase()}: ${title}`,
          description: message,
          color: colors[type],
          timestamp: new Date().toISOString(),
          footer: { text: 'Automator AI System' }
        }]
      });
    } catch (error) {
      console.error('[NotificationService] Failed to send Discord notification:', error);
    }
  }
}
