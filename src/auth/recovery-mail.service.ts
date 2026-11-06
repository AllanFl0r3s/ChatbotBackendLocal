import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RecoveryMailService {
  constructor(private readonly config: ConfigService) {}

  configuration() {
    const key = this.config.get<string>('BREVO_API_KEY');
    const sender = this.config.get<string>('RECOVERY_FROM_EMAIL');
    const secret = this.config.get<string>('PASSWORD_RESET_SECRET');
    const origin = this.config.get<string>('FRONTEND_URL');
    try {
      const url = new URL(origin ?? '');
      const local = ['localhost', '127.0.0.1'].includes(url.hostname);
      if (!key || !sender || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)
        || !secret || secret.length < 32 || secret === this.config.get('JWT_SECRET')
        || url.username || url.password || url.search || url.hash || url.pathname !== '/'
        || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw new Error();
      return { key, sender, secret, origin: url.origin };
    } catch {
      throw new ServiceUnavailableException('La recuperación por correo todavía no está disponible.');
    }
  }

  async send(email: string, token: string) {
    const { key, sender, origin } = this.configuration();
    // Fragmento: el navegador recibe el token sin enviarlo en la URL al hosting.
    const link = `${origin}/reset-password#token=${encodeURIComponent(token)}`;
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { email: sender, name: 'Chatbot académico' },
          to: [{ email }], subject: 'Recuperar acceso al chatbot',
          textContent: `Solicitaste cambiar tu contraseña. Abre este enlace en los próximos 15 minutos:\n${link}\nSi no fuiste tú, ignora este mensaje.`,
        }),
      });
      if (!response.ok) throw new Error();
      // Brevo confirma aceptación; la llegada al buzón se comprueba manualmente.
    } catch {
      // No imprimir cuerpo del proveedor, clave, destinatario ni token.
      throw new ServiceUnavailableException('No fue posible enviar el correo. Intenta más tarde.');
    }
  }
}
