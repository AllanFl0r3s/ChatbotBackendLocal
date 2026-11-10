# Catálogo académico con productos de Istmania

## Fuente y límites

Se revisó el PDF proporcionado por el propietario, **CATÁLOGO ISTMANIA 2026 (5.5 x 8.5 in).pdf**, de 64 páginas. Se comprobaron visualmente las páginas relevantes antes de elegir esta muestra.

Solo los nombres y presentaciones provienen del catálogo. Los SKU internos DEMO, alias PT, precios en HNL y existencias son ficticios. No se consultaron ventas, precios ni existencias de los servidores empresariales. Esta muestra no representa el catálogo completo ni disponibilidad comercial real.

| Alias ficticio para el chat | SKU académico | Producto / presentación | Página PDF | Precio ficticio HNL | Unidades ficticias |
|---|---|---|---:|---:|---:|
| PT990000001 | DEMO-QUARTZ-600 | Quartz agua purificada botella 600 ml | 47 | 12.50 | 135 |
| PT990000002 | DEMO-QUARTZ-1000 | Quartz agua purificada botella 1000 ml | 47 | 20.00 | 10 |
| PT990000003 | DEMO-PLATA-750 | Plata Lite 750 ml | 3 | 140.00 | 85 |
| PT990000004 | DEMO-VITALIT-600 | Vitalit naranja mandarina 600 ml | 48 | 35.00 | 2 |
| PT990000005 | DEMO-DROPP-GAL | Dropp detergente líquido fragancia Fresh 1 galón | 58 | 95.00 | 53 |
| PT990000006 | DEMO-220-355 | 220 Energy Drink Original lata 355 ml | 44 | 28.00 | 212 |

La página 45 anuncia Wish como «muy pronto»; no se incluyó en esta muestra. El tamaño 355 ml de 220 corresponde a una de las dos latas mostradas en la página 44. No se dedujeron códigos ERP a partir de fotografías o marcas.

## Cambio aplicado en Azure, 10 de noviembre de 2026

- Base DW_ISTMA del servidor académico sql-chatbot-allanflores-2026.database.windows.net.
- Archivo `09_DW_ISTMA_catalogo_istmania.sql`: migración de datos 003, con destino restringido, transacción y bloqueo de ejecución.
- Sustituye los seis ejemplos genéricos por esta muestra: nombre, SKU, categoría, descripción y PrecioBase. Conserva los IDs de la muestra y sus doce existencias, cantidades y mínimos.
- Reclasifica las tres categorías como bebidas sin alcohol, licores nacionales e higiene y limpieza, todas marcadas como demo.
- Actualiza la vista por centro al mismo tiempo que cambia los SKU. El resumen de stock sigue funcionando y ALTER VIEW conserva los permisos SELECT ya otorgados a chatbot_web.
- No borra bases, tablas, usuarios ni conversaciones. El historial previo puede contener nombres de los ejemplos anteriores; para iniciar otra consulta escribir «menu».
- Rechaza un catálogo que ya no coincida con los seis SKU y las tres categorías de la semilla inicial, en vez de sobrescribir cambios del propietario.

Se ejecutó 09 dos veces: la segunda no duplicó ni sobrescribió productos. La verificación `10_DW_ISTMA_verificar_catalogo.sql` pasó en Azure: seis productos, tres categorías, doce existencias, nombres, precios, alias y stock esperados, sin SKU genéricos anteriores. También comprobó la lectura desde el usuario limitado del backend.

Los scripts originales 001 y 002 y la semilla 001 se conservan como historial reproducible: instalar las versiones iniciales y después aplicar 003. La comprobación de la semilla inicial corresponde a su propio estado; después de 003 se utiliza la comprobación 10 del catálogo nuevo.

## Preguntas para probar

Antes de cada consulta independiente, enviar «menu». Las búsquedas se hacen por palabras del nombre y el número de una opción permite ver las bodegas.

- stock de quartz 600ml → 135; elegir 1 → 120 en bodega central y 15 en bodega de ruta.
- stock de quartz → dos presentaciones (600 ml y 1000 ml); elegir la opción correspondiente.
- stock de plata lite → 85.
- stock de vitalit → 2.
- stock de dropp → 53.
- stock de 220 → 212.
- stock de arroz → sin resultados: ese ejemplo genérico ya fue sustituido.

Las cantidades no se obtuvieron del catálogo: el catálogo describe productos, no stock. PrecioBase contiene valores ficticios para futuros ejemplos; este avance no habilita una nueva consulta conversacional de precios, ventas ni pedidos.

## Validación del chat público

La prueba real por HTTPS contra chatbotbackendlocal-1.onrender.com finalizó correctamente:

- Health 200; registro de una cuenta exclusivamente ficticia 201; login como USUARIO 201.
- Quartz 600 ml: 135 unidades; selección 1: detalle 120 + 15.
- Plata Lite: 85; Vitalit: 2; Dropp: 53; 220 Energy Drink: 212.
- Arroz: sin resultados, confirmando que ya no aparece el ejemplo genérico.
- Logout 204 al finalizar. La cuenta ficticia queda como usuario normal, sin rutas asignadas ni privilegios administrativos.

Contraseñas y JWT de prueba se generaron únicamente en memoria y no se imprimieron ni guardaron. No se cambiaron variables de Render, Vercel ni la configuración local. La copia SQL local conserva su estado anterior; esta actualización se aplicó a Azure, que utiliza el chatbot publicado.

No se ha creado un commit ni subido archivos a GitHub durante este cambio.
