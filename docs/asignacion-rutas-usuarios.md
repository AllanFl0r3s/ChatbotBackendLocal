# Asignar rutas desde Administración

En Nuevo usuario y Editar usuario aparece `Ruta asignada · Zona Norte`, con S01 a S10 y `Sin ruta asignada`. La lista de usuarios muestra sus rutas. Un administrador puede asignar la misma ruta a varias cuentas; cada cuenta gestionada desde el formulario tiene una sola ruta. Crear una cuenta desde Administración usa por defecto el rol Usuario.

La asignación se guarda junto con los demás cambios de la cuenta. Solo un administrador autenticado puede crear o modificar usuarios. El servidor valida los códigos y vuelve a leer la asignación en cada consulta de Visitas, historial y promociones sugeridas. Al cambiar la ruta, se deniega el acceso a la anterior con la misma sesión. Quitar la ruta revoca el acceso a estas consultas. Esto no limita stock ni las consultas generales de ventas por vendedor existentes.

Las rutas son diferentes de los registros comerciales de vendedores S01 a S10. Esta mejora no crea sus cuentas de acceso ni asigna automáticamente clientes, visitas o ventas. Asignar una ruta sin clientes o visitas puede devolver resultados vacíos.

## Publicar

1. En Azure seleccionar **CHATBOT**, no DW_ISTMA. Ejecutar completo `database/academic/010_CHATBOT_rutas_usuarios.sql` antes de desplegar el backend. La segunda ejecución conserva las asignaciones existentes.
2. Allan hace commit y push del backend y espera a que Render termine de desplegarlo.
3. Allan hace commit y push del frontend y espera a Vercel. En Administración → Editar usuario, elegir la ruta y guardar. Al abrir de nuevo la cuenta, comprobar la selección y la columna Ruta.

No se actualizó Azure ni se publicaron los repositorios durante esta implementación. La migración se aplicó y verificó dos veces en CHATBOT local.

## Compatibilidad

Los usuarios anteriores conservan la configuración `VISITS_ROUTE_ACCESS` hasta que se cambia explícitamente su ruta desde Administración. Si una cuenta tenía varias rutas, la pantalla las muestra y avisa que cambiar la selección reemplaza esos accesos. Guardar otros datos sin cambiar la selección no los modifica. Seleccionar `Sin ruta asignada` guarda una revocación explícita y no vuelve a habilitar accesos antiguos desde esa variable.

No se almacenan rutas en el JWT ni se confía en rutas enviadas por el navegador. Una ruta solicitada por URL o por una conversación se contrasta con la asignación actual. Si la cuenta se desactiva o falla la consulta de permisos, no se autoriza el acceso.

## Validación local

- Compilación Nest y compilación Angular cloud aprobadas. Las advertencias de tamaño de estilos existentes se mantienen.
- 15 suites y 181 pruebas Jest aprobadas.
- `node test/user-routes.integration.cjs`: siete comprobaciones HTTP y SQL reales, incluyendo creación con ruta, persistencia, usuario sin privilegios, ruta ajena, cambio durante una sesión, código inválido y revocación en Visitas e historial. Solo crea una cuenta desechable local; retira sus conversaciones y la cuenta al finalizar.
- Revisión visual del formulario y listado desde el navegador local, usando la cuenta académica. No se modificó la asignación del administrador local.
