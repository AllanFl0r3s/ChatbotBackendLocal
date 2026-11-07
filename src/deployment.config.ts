// Estas comprobaciones solo se exigen al publicar: el .env local sigue funcionando.
export function deploymentConfig(env: NodeJS.ProcessEnv) {
  const production = env.NODE_ENV === 'production';
  const origins = (env.CORS_ORIGINS || 'http://localhost:4200')
    .split(',').map(value => value.trim()).filter(Boolean);
  if (production) {
    if (!env.CORS_ORIGINS || origins.length === 0) throw new Error('Falta CORS_ORIGINS en producción.');
    for (const origin of origins) {
      const url = new URL(origin);
      if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) {
        throw new Error('CORS_ORIGINS debe contener orígenes HTTPS completos, sin rutas.');
      }
    }
    if (!origins.includes(env.FRONTEND_URL || '')) {
      throw new Error('FRONTEND_URL debe coincidir con un origen autorizado de CORS.');
    }
    for (const prefix of ['DB', 'PROD_DB']) {
      if (!env[`${prefix}_HOST`]?.endsWith('.database.windows.net')
        || env[`${prefix}_PORT`] !== '1433'
        || !env[`${prefix}_USER`] || !env[`${prefix}_PASSWORD`]
        || env[`${prefix}_ENCRYPT`] !== 'true'
        || env[`${prefix}_TRUST_SERVER_CERTIFICATE`] !== 'false') {
        throw new Error(`${prefix}: configura Azure SQL, puerto 1433, credenciales y TLS verificado.`);
      }
      // El proceso público usa usuarios limitados, no el administrador del servidor.
      if (['chatbot_admin', 'sa'].includes(env[`${prefix}_USER`]!.toLowerCase())) {
        throw new Error(`${prefix}: usa un usuario SQL de aplicación, no el administrador.`);
      }
    }
    if (env.DB_NAME !== 'CHATBOT' || env.PROD_DB_NAME !== 'DW_ISTMA'
      || env.VISITS_DATA_SOURCE !== 'academic') {
      throw new Error('El despliegue académico exige CHATBOT, DW_ISTMA y VISITS_DATA_SOURCE=academic.');
    }
    if ((env.JWT_SECRET?.length || 0) < 32 || (env.PASSWORD_RESET_SECRET?.length || 0) < 32
      || env.JWT_SECRET === env.PASSWORD_RESET_SECRET) {
      throw new Error('Configura dos secretos distintos de al menos 32 caracteres.');
    }
  }
  return { origins, swagger: env.SWAGGER_ENABLED === 'true' || (!production && env.SWAGGER_ENABLED !== 'false') };
}
