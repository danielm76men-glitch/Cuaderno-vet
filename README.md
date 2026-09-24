# VetDiario

Cuaderno clínico y de estudio veterinario con Firebase, guardado automático y soporte sin conexión.

## Actualización del 24 de septiembre de 2026

- Inicio con casos abiertos, controles hasta hoy, consultas recientes y accesos rápidos.
- Fármacos reúne Catálogo e Historial de uso. Estudio contiene las materias y apuntes.
- Búsqueda global de pacientes, fármacos y apuntes; búsqueda independiente dentro del catálogo.
- Seguimiento de casos: Abierto, En seguimiento o Cerrado, fecha de próximo control y alergias/reacciones registradas. Los casos anteriores se muestran como abiertos hasta que se les asigne otro estado.
- Accesos a los apartados de la ficha; constantes con mayor protagonismo del dato registrado; tarjetas de pacientes en móvil.
- La calculadora requiere introducir una dosis y seleccionar la presentación. Comprueba coincidencia de unidad y vía antes de convertir a volumen. No cambia las pautas ni las advertencias clínicas existentes.
- Fechas de verificación sin desfase de un día por zona horaria.
- Respaldo completo de entradas, perfil, catálogo, fotos y exámenes. Restauración aditiva: conserva documentos existentes, mantiene relaciones y permite reintentar sin duplicar los mismos identificadores.

## Uso y publicación

Conservar todos los archivos juntos, incluidos los nuevos `respaldo.js` y `mejoras.css`, además de `firebase-config.js`. Se requiere servir la aplicación por HTTP/HTTPS; abrir `index.html` con doble clic no es suficiente para cargar los módulos.

La caché de la aplicación se actualizó a la versión 85. Para actualizar una instalación publicada, subir el conjunto completo de archivos al mismo alojamiento y recargar la aplicación.

La configuración y las reglas de Firebase se conservan. Esta actualización de archivos no publica cambios en el alojamiento ni migra registros de la base de datos al arrancar.

## Respaldo

En Configuración, usar «Descargar respaldo completo» con conexión a internet. La aplicación espera la sincronización y consulta las tres colecciones del usuario para incluir los adjuntos que no estén en la caché del dispositivo.

«Restaurar respaldo» muestra el número de registros antes de importar. La creación es exclusiva mediante la API de Firestore y la sesión actual: un identificador ya existente no se sobrescribe. Si la conexión falla, se informa del avance y puede reintentarse el mismo archivo. Las copias antiguas solo contienen la información que alcanzó a guardar su exportador; los datos ausentes no se pueden reconstruir.

## Verificación

Ejecutar `node --test tests/*.test.mjs` para las pruebas de respaldo, fechas y empaquetado. No requieren conexión ni datos reales. Las pruebas de interfaz se hicieron con una copia aislada y registros ficticios.

La validación de dosis y referencias clínicas requiere una revisión profesional separada; no se añadieron pautas farmacológicas en esta actualización.
