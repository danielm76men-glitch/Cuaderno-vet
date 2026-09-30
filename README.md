# VetDiario

Cuaderno clínico y de estudio veterinario con Firebase, guardado automático y soporte sin conexión.

## Vademécum y Catálogo comercial — 29 de septiembre de 2026

- Vademécum contiene las fichas de principios activos y combinaciones con sus pautas por especie. Las combinaciones indican, por pauta, si la dosis corresponde al total o a un componente.
- Catálogo comercial contiene marca, laboratorio, forma, envase, composición, concentraciones, vías y fotos de cada producto. Cada producto se vincula a una ficha del Vademécum. Los productos archivados se pueden restaurar desde el filtro del catálogo.
- La calculadora se abre desde cualquiera de las dos vistas y también permite buscar productos comerciales. Usa la pauta de la ficha y la concentración del componente indicado, o la suma cuando la pauta especifica el total. Rechaza composiciones incompletas, unidades incompatibles y vías diferentes. No deduce la base de una pauta combinada antigua.
- Las presentaciones anteriores aparecen en el catálogo mediante un adaptador de lectura. Al editarlas se guardan como productos independientes, sin borrar los originales ni duplicar la presentación. Las fotos anteriores mantienen sus vínculos; las que no tenían asignación se pueden vincular desde el producto correspondiente.
- El historial de tratamientos está en Pacientes. Se conserva su contenido derivado de los casos clínicos.
- Los productos se guardan como registros de tipo `productoComercial` en la colección existente `formulario`, separados de las fichas en la aplicación. Se mantienen las reglas de acceso y las tres colecciones del respaldo. La restauración conserva vínculos entre fichas, productos y fotos, incluso en otra cuenta.

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

Conservar todos los archivos juntos, incluidos `catalogo.js`, `catalogo-ui.js`, `respaldo.js`, los estilos y `firebase-config.js`. Se requiere servir la aplicación por HTTP/HTTPS; abrir `index.html` con doble clic no es suficiente para cargar los módulos.

La caché de la aplicación se actualizó a la versión 89. Para actualizar una instalación publicada, subir el conjunto completo de archivos al mismo alojamiento y recargar la aplicación.

La configuración y las reglas de Firebase se conservan. Esta actualización de archivos no publica cambios en el alojamiento ni migra registros de la base de datos al arrancar.

## Respaldo

En Configuración, usar «Descargar respaldo completo» con conexión a internet. La aplicación espera la sincronización y consulta las tres colecciones del usuario para incluir los adjuntos que no estén en la caché del dispositivo.

«Restaurar respaldo» muestra el número de registros antes de importar. La creación es exclusiva mediante la API de Firestore y la sesión actual: un identificador ya existente no se sobrescribe. Si la conexión falla, se informa del avance y puede reintentarse el mismo archivo. Las copias antiguas solo contienen la información que alcanzó a guardar su exportador; los datos ausentes no se pueden reconstruir.

## Verificación

Ejecutar `node --test tests/*.test.mjs` para las pruebas de cálculo por componente, conservación de presentaciones, respaldo, fechas y empaquetado. Las pruebas de los controladores de la calculadora y del editor comercial usan un DOM mínimo y datos sintéticos, sin conexión ni datos reales.

`node tests/preview-catalogo.mjs` sirve una vista aislada en `http://127.0.0.1:4173` con Firebase sustituido en memoria. No usa una cuenta ni escribe datos reales. La revisión visual de esta actualización quedó pendiente porque el navegador de la sesión bloqueó el acceso a localhost.

La validación de dosis y referencias clínicas requiere una revisión profesional separada; no se añadieron pautas farmacológicas en esta actualización.
