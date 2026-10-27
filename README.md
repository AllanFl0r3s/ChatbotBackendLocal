# Chatbot Istmania - Backend

API NestJS independiente para autenticacion, usuarios, roles, perfil y chat.
Frontend: https://github.com/yovanniistmania/chatbotfront

## Requisitos y configuracion

- Node.js 20 o 22 LTS y npm.
- SQL Server accesible y una API key de OpenAI.
- Copiar `.env.example` a `.env` y completar `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` y `OPENAI_API_KEY`.
- Configurar `PROD_DB_*` cuando el DW utiliza otra base o credenciales. Si se omiten, se reutilizan los valores `DB_*`.

La base principal debe contener `TBL_USUARIOS`, `TBL_ROLES`, `TBL_SESIONES`, `TBL_MENSAJES` y `TBL_PERFIL`. `synchronize` esta desactivado: la aplicacion no crea estas tablas.

Las funciones comerciales esperan, entre otros objetos, `DW_ISTMA.dbo.VentasCasaMarca`, `IV00101`, `RM00301`, `proyecciones2026`, y las vistas `dbo.VWchatbot_STOCK_S4_PRODUCTO`, `dbo.VW_STOCK_S4_PRODUCTO_CENTRO`, `dbo.VWchatbot_PEDIDO_DETALLE_S4` y `dbo.ZFI_NOTAS_CREDITO`.

## Desarrollo

Ejecutar desde la raiz de este repositorio:

```powershell
npm ci
Copy-Item .env.example .env
# Completar .env antes de iniciar.
npm run start:dev
```

API: `http://localhost:3020`. Swagger: `http://localhost:3020/api`.
El puerto se configura con `PORT` en `.env`.

## Compilacion y ejecucion

```powershell
npm run build
npm run start:prod
```

Los archivos `.env`, dependencias y compilados se excluyen de Git. Configurar las variables de entorno por separado en cada despliegue.
