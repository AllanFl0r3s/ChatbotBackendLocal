// La ayuda vive en el mensaje del bot, sin controles fuera de la conversación.
export function withBackHint(reply: string, active: boolean): string {
  return active && !reply.includes('Escribe “atrás” para volver.') ? `${reply}\n\nEscribe “atrás” para volver.` : reply;
}
