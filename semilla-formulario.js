/* ============================================================
   SEMILLA DEL FORMULARIO — plantilla de carga
   ============================================================

   Aqui es donde cargas los 30-40 farmacos. Este archivo es SOLO DATOS: no
   toca Firebase ni la interfaz. El boton "Cargar semilla" de la pestaña
   Formulario lee esta lista y crea un documento por entrada.

   El id de cada documento se deriva de "slug", asi que volver a pulsar el
   boton NO duplica nada: reescribe el mismo documento. Puedes editar este
   archivo, recargar y volver a cargarlo cuantas veces quieras.

   ⚠️ LOS TRES DE ABAJO SON EJEMPLOS DE ESTRUCTURA, no un vademecum.
   Estan para que veas el patron. Verifica cada dato contra la etiqueta del
   producto registrado antes de usarlo en clinica, y cambia "verificadoEl"
   a la fecha en que TU lo verificaste.

   ------------------------------------------------------------
   CAMPOS
   ------------------------------------------------------------
   slug              obligatorio, minusculas y guiones. Define el id del
                     documento; no lo cambies despues de cargarlo o se
                     creara un documento nuevo en vez de actualizar.
   nombreGenerico    obligatorio.
   familia           ej. "AINE", "fluoroquinolona", "tetraciclina".

   presentaciones[]  concentracion (numero), unidadConc ("mg/mL",
                     "mg/tableta"), via, nombreComercialLocal.
                     De aqui salen las opciones del selector de la
                     calculadora: sin presentaciones no hay calculo en mL.

   dosis[]           especie: canino | felino | bovino | porcino | equino | ovino
                     indicacion, dosisMin, dosisMax (numeros), unidad
                     ("mg/kg", "UI/kg"), via (IV|IM|SC|VO|IU|topica),
                     frecuenciaH (numero de horas), duracionMaxDias (numero
                     o null), fuente (OBLIGATORIO), esExtralabel (booleano).

   retiro[]          especie, producto, carneDias, lecheHoras (numero o
                     null si la etiqueta no autoriza el uso en lactancia),
                     fuente. Si la fuente no es AGROCALIDAD, la ficha
                     avisa que el dato es orientativo.

   contraindicaciones[]  texto libre.
   alertas[]         contraindicaciones ABSOLUTAS. Se pintan en rojo arriba
                     de todo, y si el texto nombra una especie, la
                     calculadora BLOQUEA el calculo para esa especie.
   verificadoEl      "AAAA-MM-DD". Pasados 24 meses la ficha lo marca como
                     desactualizado.
   ============================================================ */

export const SEMILLA_FORMULARIO = [
  {
    slug: "meloxicam",
    nombreGenerico: "Meloxicam",
    familia: "AINE (oxicam)",
    presentaciones: [
      { concentracion: 5, unidadConc: "mg/mL", via: "SC", nombreComercialLocal: "Solución inyectable 5 mg/mL" },
      { concentracion: 1.5, unidadConc: "mg/mL", via: "VO", nombreComercialLocal: "Suspensión oral 1,5 mg/mL" }
    ],
    dosis: [
      {
        especie: "canino",
        indicacion: "Dolor e inflamación osteomuscular — dosis inicial",
        dosisMin: 0.2,
        dosisMax: 0.2,
        unidad: "mg/kg",
        via: "SC",
        frecuenciaH: 24,
        duracionMaxDias: 1,
        fuente: "FDA NADA 141-213 — Metacam (meloxicam) 5 mg/mL Solution for Injection, etiqueta del fabricante",
        esExtralabel: false
      },
      {
        especie: "canino",
        indicacion: "Dolor e inflamación osteomuscular — mantenimiento",
        dosisMin: 0.1,
        dosisMax: 0.1,
        unidad: "mg/kg",
        via: "VO",
        frecuenciaH: 24,
        duracionMaxDias: null,
        fuente: "FDA NADA 141-219 — Metacam (meloxicam) Oral Suspension, etiqueta del fabricante",
        esExtralabel: false
      }
    ],
    retiro: [],
    contraindicaciones: [
      "Deshidratación, hipovolemia o hipotensión no corregidas",
      "Enfermedad renal, hepática o cardiaca descompensada",
      "Uso concurrente con otro AINE o con corticoides",
      "Úlcera o sangrado gastrointestinal"
    ],
    alertas: [
      "Felinos: la etiqueta de la FDA lleva recuadro de advertencia contra el uso REPETIDO de meloxicam en gatos por riesgo de fallo renal agudo y muerte. No usar en pautas repetidas."
    ],
    verificadoEl: "2026-08-21"
  },

  {
    slug: "enrofloxacina",
    nombreGenerico: "Enrofloxacina",
    familia: "Fluoroquinolona",
    presentaciones: [
      { concentracion: 22.7, unidadConc: "mg/tableta", via: "VO", nombreComercialLocal: "Tableta 22,7 mg" },
      { concentracion: 22.7, unidadConc: "mg/mL", via: "SC", nombreComercialLocal: "Solución inyectable 2,27%" }
    ],
    dosis: [
      {
        especie: "canino",
        indicacion: "Infecciones por gérmenes sensibles",
        dosisMin: 5,
        dosisMax: 20,
        unidad: "mg/kg",
        via: "VO",
        frecuenciaH: 24,
        duracionMaxDias: 30,
        fuente: "FDA NADA 140-913 — Baytril (enrofloxacin) Tablets, etiqueta del fabricante",
        esExtralabel: false
      },
      {
        especie: "felino",
        indicacion: "Infecciones por gérmenes sensibles",
        dosisMin: 5,
        dosisMax: 5,
        unidad: "mg/kg",
        via: "VO",
        frecuenciaH: 24,
        duracionMaxDias: 30,
        fuente: "FDA NADA 140-913 — Baytril (enrofloxacin) Tablets: en gatos la etiqueta limita a 5 mg/kg/día",
        esExtralabel: false
      }
    ],
    retiro: [],
    contraindicaciones: [
      "Felinos: no superar 5 mg/kg/día. Por encima de esa dosis se ha descrito degeneración retiniana y ceguera irreversible.",
      "Animales en crecimiento: riesgo de artropatía del cartílago articular",
      "Hipersensibilidad conocida a quinolonas",
      "Antecedente de convulsiones"
    ],
    /* Ojo con la diferencia: esto va en contraindicaciones y NO en alertas.
       "alertas" BLOQUEA el cálculo para la especie que nombre, y en el gato
       la enrofloxacina sí se usa — a 5 mg/kg, que es la pauta cargada
       arriba. Un techo de dosis no es una contraindicación absoluta. */
    alertas: [],
    verificadoEl: "2026-08-21"
  },

  {
    slug: "oxitetraciclina-la",
    nombreGenerico: "Oxitetraciclina (larga acción)",
    familia: "Tetraciclina",
    presentaciones: [
      { concentracion: 200, unidadConc: "mg/mL", via: "IM", nombreComercialLocal: "Solución inyectable 200 mg/mL (LA)" }
    ],
    dosis: [
      {
        especie: "bovino",
        indicacion: "Infecciones por gérmenes sensibles",
        dosisMin: 20,
        dosisMax: 20,
        unidad: "mg/kg",
        via: "IM",
        frecuenciaH: 72,
        duracionMaxDias: null,
        fuente: "FDA — etiqueta de oxitetraciclina inyectable 200 mg/mL, dosis única de 20 mg/kg",
        esExtralabel: false
      }
    ],
    retiro: [
      {
        especie: "bovino",
        producto: "Oxitetraciclina 200 mg/mL (LA) — no autorizado en vacas en lactancia según etiqueta",
        carneDias: 28,
        lecheHoras: null,
        fuente: "FDA — etiqueta del producto (dato NO vinculante en Ecuador)"
      }
    ],
    contraindicaciones: [
      "Insuficiencia renal",
      "No administrar por vía IV rápida: riesgo de colapso cardiovascular",
      "No superar 10 mL por sitio de inyección IM"
    ],
    alertas: [],
    verificadoEl: "2026-08-21"
  }
];
