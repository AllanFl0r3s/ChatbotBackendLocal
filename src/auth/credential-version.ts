import { createHmac } from 'node:crypto';

// La huella depende del hash actual y de una clave del servidor. No expone el hash bcrypt.
// Al cambiar la contraseña, todos los JWT y enlaces anteriores dejan de coincidir.
export function credentialVersion(hash: string, secret: string): string {
  return createHmac('sha256', secret).update(hash).digest('hex');
}
