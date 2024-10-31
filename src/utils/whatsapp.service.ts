import axios from 'axios';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WhatsAppService {
  async sendWhatsAppMessage(to: string, message: string): Promise<void> {
    try {
      const response = await axios.post(
        'https://messages-sandbox.nexmo.com/v1/messages',
        {
          from: process.env.WHATSAPP_FROM_NUMBER,
          to: '33618962049',
          message_type: 'text',
          text: message,
          channel: 'whatsapp',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          auth: {
            username: process.env.VONAGE_API_KEY,
            password: process.env.VONAGE_API_SECRET,
          },
        },
      );

      if (response.status === 202) {
        console.log(`Message WhatsApp envoyé à ${to}`);
      } else {
        console.error('Échec de l’envoi du message WhatsApp.', response.data);
      }
    } catch (error) {
      console.error('Erreur lors de l’envoi du message WhatsApp :', error);
    }
  }
}
