import { deploymentConfig } from './deployment.config';

const cloud = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'production', CORS_ORIGINS: 'https://chatbot-clase-vista-previa.vercel.app',
  FRONTEND_URL: 'https://chatbot-clase-vista-previa.vercel.app',
  DB_HOST: 'demo.database.windows.net', DB_PORT: '1433', DB_NAME: 'CHATBOT',
  DB_USER: 'chatbot_web', DB_PASSWORD: 'fixture-only-not-a-real-password',
  DB_ENCRYPT: 'true', DB_TRUST_SERVER_CERTIFICATE: 'false',
  PROD_DB_HOST: 'demo.database.windows.net', PROD_DB_PORT: '1433', PROD_DB_NAME: 'DW_ISTMA',
  PROD_DB_USER: 'chatbot_web', PROD_DB_PASSWORD: 'fixture-only-not-a-real-password',
  PROD_DB_ENCRYPT: 'true', PROD_DB_TRUST_SERVER_CERTIFICATE: 'false',
  JWT_SECRET: 'a'.repeat(64), PASSWORD_RESET_SECRET: 'b'.repeat(64), VISITS_DATA_SOURCE: 'academic',
});

describe('Configuración de despliegue', () => {
  it('conserva localhost en desarrollo', () => {
    expect(deploymentConfig({})).toEqual({ origins: ['http://localhost:4200'], swagger: true });
  });
  it('acepta Azure cifrado y no publica Swagger por defecto', () => {
    expect(deploymentConfig(cloud()).swagger).toBe(false);
  });
  it.each([
    { CORS_ORIGINS: '*' }, { CORS_ORIGINS: 'http://localhost:4200' },
    { CORS_ORIGINS: 'https://example.com/path' }, { FRONTEND_URL: 'https://other.example' },
    { DB_HOST: '192.168.0.6' }, { PROD_DB_HOST: '127.0.0.1' },
    { DB_ENCRYPT: 'false' }, { PROD_DB_TRUST_SERVER_CERTIFICATE: 'true' },
    { DB_USER: 'chatbot_admin' }, { PROD_DB_USER: 'sa' },
    { DB_NAME: 'master' }, { VISITS_DATA_SOURCE: 'legacy' },
    { JWT_SECRET: 'short' }, { PASSWORD_RESET_SECRET: 'a'.repeat(64) },
  ])('detiene una configuración insegura: %o', invalid => {
    expect(() => deploymentConfig({ ...cloud(), ...invalid })).toThrow();
  });
});
