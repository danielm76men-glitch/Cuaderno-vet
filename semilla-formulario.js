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
      { concentracion: 5, unidadConc: "mg/mL", via: ["SC"], nombreComercialLocal: "Solución inyectable 5 mg/mL" },
      { concentracion: 1.5, unidadConc: "mg/mL", via: ["VO"], nombreComercialLocal: "Suspensión oral 1,5 mg/mL" }
    ],
    dosis: [
      {
        especie: "canino",
        indicacion: "Dolor e inflamación osteomuscular — dosis inicial",
        dosisMin: 0.2,
        dosisMax: 0.2,
        unidad: "mg/kg",
        via: ["SC"],
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
        via: ["VO"],
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
      { concentracion: 22.7, unidadConc: "mg/tableta", via: ["VO"], nombreComercialLocal: "Tableta 22,7 mg" },
      { concentracion: 22.7, unidadConc: "mg/mL", via: ["SC"], nombreComercialLocal: "Solución inyectable 2,27%" }
    ],
    dosis: [
      {
        especie: "canino",
        indicacion: "Infecciones por gérmenes sensibles",
        dosisMin: 5,
        dosisMax: 20,
        unidad: "mg/kg",
        via: ["VO"],
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
        via: ["VO"],
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
      { concentracion: 200, unidadConc: "mg/mL", via: ["IM"], nombreComercialLocal: "Solución inyectable 200 mg/mL (LA)" }
    ],
    dosis: [
      {
        especie: "bovino",
        indicacion: "Infecciones por gérmenes sensibles",
        dosisMin: 20,
        dosisMax: 20,
        unidad: "mg/kg",
        via: ["IM"],
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
  },

  /* ============================================================
     FÁRMACOS POR CLASIFICAR — 58 fichas listas para llenar
     ============================================================

     Solo traen nombre genérico y familia. Las dosis, vías, presentaciones
     y tiempos de retiro están VACÍOS a propósito: hay que cargarlos desde
     la etiqueta del producto registrado en AGROCALIDAD, o desde Animal
     Drugs @ FDA, EMA o FARAD, y anotar la fuente exacta en cada pauta.

     La ficha no deja guardar una dosis sin fuente, así que el formulario
     te obliga a hacerlo bien.

     Para llenar una: Estudio -> Formulario -> toca el fármaco.
     Para quitar los que no uses: el botón Eliminar de su ficha, o borra
     su bloque de aquí antes de cargar la semilla.
     ============================================================ */

  {
    slug: "amoxicilina",
    nombreGenerico: "Amoxicilina",
    familia: "Betalactámico — aminopenicilina",
    presentaciones: [
          {
                "concentracion": 50,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 50 mg"
          },
          {
                "concentracion": 150,
                "unidadConc": "mg/mL",
                "via": [
                      "IM",
                      "SC"
                ],
                "nombreComercialLocal": "Suspensión inyectable LA 150 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Infecciones por gérmenes sensibles",
                "dosisMin": 11,
                "dosisMax": 11,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 12,
                "duracionMaxDias": 30,
                "fuente": "FDA NADA 055-102 — Amoxi-Tabs (amoxicillin), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "felino",
                "indicacion": "Infecciones por gérmenes sensibles",
                "dosisMin": 11,
                "dosisMax": 11,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 12,
                "duracionMaxDias": 30,
                "fuente": "FDA NADA 055-102 — Amoxi-Tabs (amoxicillin), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "bovino",
                "indicacion": "Infecciones por gérmenes sensibles",
                "dosisMin": 6.6,
                "dosisMax": 11,
                "unidad": "mg/kg",
                "via": [
                      "IM",
                      "SC"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 5,
                "fuente": "FDA — etiqueta de amoxicilina trihidrato inyectable de uso bovino",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Hipersensibilidad a betalactámicos",
          "No usar en conejos, cobayos ni hámsteres: disbiosis intestinal mortal"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "amoxicilina-clavulanico",
    nombreGenerico: "Amoxicilina + ácido clavulánico",
    familia: "Betalactámico — aminopenicilina con inhibidor de betalactamasas",
    presentaciones: [
          {
                "concentracion": 62.5,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 62,5 mg (50/12,5)"
          },
          {
                "concentracion": 125,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 125 mg (100/25)"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Infecciones de piel y tejidos blandos",
                "dosisMin": 6.25,
                "dosisMax": 6.25,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 12,
                "duracionMaxDias": 30,
                "fuente": "FDA NADA 055-099 — Clavamox (amoxicillin/clavulanate), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "felino",
                "indicacion": "Infecciones de piel y tejidos blandos",
                "dosisMin": 62.5,
                "dosisMax": 62.5,
                "unidad": "mg/animal",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 12,
                "duracionMaxDias": 30,
                "fuente": "FDA NADA 055-099 — Clavamox: en gatos la etiqueta pauta por animal, no por kg",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Hipersensibilidad a penicilinas o cefalosporinas",
          "No usar en conejos, cobayos, hámsteres ni jerbos"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "ampicilina",
    nombreGenerico: "Ampicilina",
    familia: "Betalactámico — aminopenicilina",
    presentaciones: [
          {
                "concentracion": 250,
                "unidadConc": "mg/vial",
                "via": [
                      "IM",
                      "SC"
                ],
                "nombreComercialLocal": "Polvo para inyección 250 mg"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Infecciones por gérmenes sensibles",
                "dosisMin": 6.6,
                "dosisMax": 11,
                "unidad": "mg/kg",
                "via": [
                      "IM",
                      "SC"
                ],
                "frecuenciaH": 12,
                "duracionMaxDias": 7,
                "fuente": "FDA NADA 065-495 — Polyflex (ampicillin trihydrate), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "bovino",
                "indicacion": "Infecciones respiratorias por gérmenes sensibles",
                "dosisMin": 4.4,
                "dosisMax": 11,
                "unidad": "mg/kg",
                "via": [
                      "IM",
                      "SC"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 7,
                "fuente": "FDA NADA 065-495 — Polyflex (ampicillin trihydrate), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Hipersensibilidad a betalactámicos",
          "No usar en lagomorfos ni roedores herbívoros"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "penicilina-g",
    nombreGenerico: "Penicilina G",
    familia: "Betalactámico — penicilina natural",
    presentaciones: [
          {
                "concentracion": 300000,
                "unidadConc": "UI/mL",
                "via": [
                      "IM"
                ],
                "nombreComercialLocal": "Penicilina G procaínica 300.000 UI/mL"
          }
    ],
    dosis: [
          {
                "especie": "bovino",
                "indicacion": "Infecciones por gérmenes sensibles",
                "dosisMin": 6600,
                "dosisMax": 6600,
                "unidad": "UI/kg",
                "via": [
                      "IM"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 5,
                "fuente": "FDA — etiqueta de penicilina G procaínica inyectable de uso bovino",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Hipersensibilidad a penicilinas",
          "No administrar por vía IV: el vehículo procaínico causa reacciones graves"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "cefalexina",
    nombreGenerico: "Cefalexina",
    familia: "Cefalosporina de 1.ª generación",
    presentaciones: [
          {
                "concentracion": 300,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 300 mg"
          },
          {
                "concentracion": 600,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 600 mg"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Piodermas y infecciones de piel y tejidos blandos",
                "dosisMin": 15,
                "dosisMax": 15,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 12,
                "duracionMaxDias": 28,
                "fuente": "FDA NADA 141-315 — Rilexine (cephalexin) Chewable Tablets, etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Hipersensibilidad a cefalosporinas o penicilinas"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "ceftiofur",
    nombreGenerico: "Ceftiofur",
    familia: "Cefalosporina de 3.ª generación",
    presentaciones: [
          {
                "concentracion": 50,
                "unidadConc": "mg/mL",
                "via": [
                      "IM",
                      "SC"
                ],
                "nombreComercialLocal": "Suspensión inyectable 50 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "bovino",
                "indicacion": "Enfermedad respiratoria bovina",
                "dosisMin": 1.1,
                "dosisMax": 2.2,
                "unidad": "mg/kg",
                "via": [
                      "IM",
                      "SC"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 5,
                "fuente": "FDA NADA 140-338 — Naxcel (ceftiofur sodium), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Hipersensibilidad a betalactámicos"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "marbofloxacina",
    nombreGenerico: "Marbofloxacina",
    familia: "Fluoroquinolona",
    presentaciones: [
          {
                "concentracion": 25,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 25 mg"
          },
          {
                "concentracion": 100,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 100 mg"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Infecciones por gérmenes sensibles",
                "dosisMin": 2.75,
                "dosisMax": 5.5,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 30,
                "fuente": "FDA NADA 141-151 — Zeniquin (marbofloxacin), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "felino",
                "indicacion": "Infecciones por gérmenes sensibles",
                "dosisMin": 2.75,
                "dosisMax": 5.5,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 30,
                "fuente": "FDA NADA 141-151 — Zeniquin (marbofloxacin), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Animales en crecimiento: riesgo de artropatía",
          "Antecedente de convulsiones"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "gentamicina",
    nombreGenerico: "Gentamicina",
    familia: "Aminoglucósido",
    presentaciones: [],
    dosis: [],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "amikacina",
    nombreGenerico: "Amikacina",
    familia: "Aminoglucósido",
    presentaciones: [],
    dosis: [],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "doxiciclina",
    nombreGenerico: "Doxiciclina",
    familia: "Tetraciclina",
    presentaciones: [
          {
                "concentracion": 100,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 100 mg"
          },
          {
                "concentracion": 20,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 20 mg"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Infecciones por gérmenes sensibles y hemoparásitos",
                "dosisMin": 10,
                "dosisMax": 10,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 30,
                "fuente": "EMA — Ronaxan (doxiciclina hiclato), resumen de características del producto",
                "esExtralabel": false
          },
          {
                "especie": "felino",
                "indicacion": "Infecciones por gérmenes sensibles",
                "dosisMin": 10,
                "dosisMax": 10,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 30,
                "fuente": "EMA — Ronaxan (doxiciclina hiclato), resumen de características del producto",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Gatos: administrar seguido de agua o comida, riesgo de estenosis esofágica",
          "Animales en crecimiento: decoloración dental",
          "No usar en gestación"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "metronidazol",
    nombreGenerico: "Metronidazol",
    familia: "Nitroimidazol",
    presentaciones: [],
    dosis: [],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "trimetoprim-sulfa",
    nombreGenerico: "Trimetoprim + sulfadiazina",
    familia: "Sulfonamida potenciada",
    presentaciones: [
          {
                "concentracion": 480,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 480 mg (400/80)"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Infecciones por gérmenes sensibles",
                "dosisMin": 30,
                "dosisMax": 30,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 14,
                "fuente": "FDA — etiqueta de trimetoprim/sulfadiazina de uso veterinario (dosis combinada)",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Antecedente de discrasias sanguíneas",
          "Queratoconjuntivitis seca",
          "Razas predispuestas a hipersensibilidad a sulfas (dóberman)",
          "Deshidratación: riesgo de cristaluria"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "florfenicol",
    nombreGenerico: "Florfenicol",
    familia: "Anfenicol",
    presentaciones: [
          {
                "concentracion": 300,
                "unidadConc": "mg/mL",
                "via": [
                      "IM",
                      "SC"
                ],
                "nombreComercialLocal": "Solución inyectable 300 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "bovino",
                "indicacion": "Enfermedad respiratoria bovina — pauta IM",
                "dosisMin": 20,
                "dosisMax": 20,
                "unidad": "mg/kg",
                "via": [
                      "IM"
                ],
                "frecuenciaH": 48,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-063 — Nuflor (florfenicol), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "bovino",
                "indicacion": "Enfermedad respiratoria bovina — dosis única SC",
                "dosisMin": 40,
                "dosisMax": 40,
                "unidad": "mg/kg",
                "via": [
                      "SC"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-063 — Nuflor (florfenicol), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "No usar en bovinos de aptitud lechera en lactancia",
          "No superar 10 mL por sitio de inyección"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "tilosina",
    nombreGenerico: "Tilosina",
    familia: "Macrólido",
    presentaciones: [
          {
                "concentracion": 200,
                "unidadConc": "mg/mL",
                "via": [
                      "IM"
                ],
                "nombreComercialLocal": "Solución inyectable 200 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "bovino",
                "indicacion": "Infecciones respiratorias por gérmenes sensibles",
                "dosisMin": 17.6,
                "dosisMax": 17.6,
                "unidad": "mg/kg",
                "via": [
                      "IM"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 5,
                "fuente": "FDA NADA 012-965 — Tylan 200 (tylosin), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "No usar en équidos: puede ser mortal",
          "No usar en bovinos de aptitud lechera en lactancia"
    ],
    alertas: [
          "Equino: la tilosina inyectable puede causar enterocolitis mortal en caballos. No usar en esta especie."
    ],
    verificadoEl: null
  },

  {
    slug: "tulatromicina",
    nombreGenerico: "Tulatromicina",
    familia: "Macrólido — triamilida",
    presentaciones: [
          {
                "concentracion": 100,
                "unidadConc": "mg/mL",
                "via": [
                      "SC",
                      "IM"
                ],
                "nombreComercialLocal": "Solución inyectable 100 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "bovino",
                "indicacion": "Enfermedad respiratoria bovina — dosis única",
                "dosisMin": 2.5,
                "dosisMax": 2.5,
                "unidad": "mg/kg",
                "via": [
                      "SC"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-244 — Draxxin (tulathromycin), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "porcino",
                "indicacion": "Enfermedad respiratoria porcina — dosis única",
                "dosisMin": 2.5,
                "dosisMax": 2.5,
                "unidad": "mg/kg",
                "via": [
                      "IM"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-244 — Draxxin (tulathromycin), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "No usar en bovinos de aptitud lechera en lactancia"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "carprofeno",
    nombreGenerico: "Carprofeno",
    familia: "AINE — propiónico",
    presentaciones: [
          {
                "concentracion": 50,
                "unidadConc": "mg/mL",
                "via": [
                      "SC"
                ],
                "nombreComercialLocal": "Inyectable 50 mg/mL"
          },
          {
                "concentracion": 25,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 25 mg"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Dolor e inflamación osteoartríticos",
                "dosisMin": 2.2,
                "dosisMax": 2.2,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 12,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-053 — Rimadyl (carprofen), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "canino",
                "indicacion": "Dolor e inflamación — dosis diaria única",
                "dosisMin": 4.4,
                "dosisMax": 4.4,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-053 — Rimadyl (carprofen), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "No usar en gatos: la etiqueta es solo para perros",
          "Enfermedad renal, hepática o cardiaca",
          "Úlcera gastrointestinal",
          "Uso concurrente con otro AINE o corticoide"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "firocoxib",
    nombreGenerico: "Firocoxib",
    familia: "AINE — coxib",
    presentaciones: [
          {
                "concentracion": 57,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 57 mg"
          },
          {
                "concentracion": 227,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 227 mg"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Dolor e inflamación osteoartríticos",
                "dosisMin": 5,
                "dosisMax": 5,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-230 — Previcox (firocoxib), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Etiqueta canina: no extrapolar a gatos",
          "Enfermedad renal o hepática",
          "Uso concurrente con otro AINE o corticoide"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "flunixin",
    nombreGenerico: "Flunixin meglumina",
    familia: "AINE — fenamato",
    presentaciones: [
          {
                "concentracion": 50,
                "unidadConc": "mg/mL",
                "via": [
                      "IV"
                ],
                "nombreComercialLocal": "Solución inyectable 50 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "bovino",
                "indicacion": "Pirexia asociada a enfermedad respiratoria",
                "dosisMin": 2.2,
                "dosisMax": 2.2,
                "unidad": "mg/kg",
                "via": [
                      "IV"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 3,
                "fuente": "FDA NADA 101-479 — Banamine (flunixin meglumine), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "equino",
                "indicacion": "Dolor cólico y musculoesquelético",
                "dosisMin": 1.1,
                "dosisMax": 1.1,
                "unidad": "mg/kg",
                "via": [
                      "IV",
                      "IM"
                ],
                "frecuenciaH": 12,
                "duracionMaxDias": 5,
                "fuente": "FDA NADA 101-479 — Banamine (flunixin meglumine), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Vía IV en bovinos: la IM se asocia a reacciones locales",
          "Enfermedad renal o úlcera gastrointestinal"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "ketoprofeno",
    nombreGenerico: "Ketoprofeno",
    familia: "AINE — propiónico",
    presentaciones: [
          {
                "concentracion": 100,
                "unidadConc": "mg/mL",
                "via": [
                      "IV",
                      "IM"
                ],
                "nombreComercialLocal": "Solución inyectable 10%"
          }
    ],
    dosis: [
          {
                "especie": "equino",
                "indicacion": "Dolor e inflamación musculoesquelética",
                "dosisMin": 2.2,
                "dosisMax": 2.2,
                "unidad": "mg/kg",
                "via": [
                      "IV"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 5,
                "fuente": "FDA NADA 140-269 — Ketofen (ketoprofen), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "bovino",
                "indicacion": "Inflamación y pirexia",
                "dosisMin": 3,
                "dosisMax": 3,
                "unidad": "mg/kg",
                "via": [
                      "IV",
                      "IM"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 3,
                "fuente": "EMA — Ketofen 10% (ketoprofeno), resumen de características del producto",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Úlcera gastrointestinal",
          "Insuficiencia renal o hepática",
          "Uso concurrente con otro AINE o corticoide"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "fenilbutazona",
    nombreGenerico: "Fenilbutazona",
    familia: "AINE — pirazolona",
    presentaciones: [
          {
                "concentracion": 200,
                "unidadConc": "mg/mL",
                "via": [
                      "IV"
                ],
                "nombreComercialLocal": "Solución inyectable 20%"
          },
          {
                "concentracion": 1000,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 1 g"
          }
    ],
    dosis: [
          {
                "especie": "equino",
                "indicacion": "Dolor musculoesquelético — dosis de carga",
                "dosisMin": 4.4,
                "dosisMax": 4.4,
                "unidad": "mg/kg",
                "via": [
                      "VO",
                      "IV"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 1,
                "fuente": "FDA — etiqueta de fenilbutazona de uso equino",
                "esExtralabel": false
          },
          {
                "especie": "equino",
                "indicacion": "Dolor musculoesquelético — mantenimiento",
                "dosisMin": 2.2,
                "dosisMax": 2.2,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 12,
                "duracionMaxDias": 5,
                "fuente": "FDA — etiqueta de fenilbutazona de uso equino",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Prohibida en animales destinados a consumo humano",
          "Úlcera gastrointestinal, hipoproteinemia",
          "Extravasación IV: causa necrosis tisular grave"
    ],
    alertas: [
          "Bovino: prohibida en cualquier animal destinado a consumo humano. No administrar a ganado de carne ni de leche."
    ],
    verificadoEl: null
  },

  {
    slug: "dipirona",
    nombreGenerico: "Dipirona (metamizol)",
    familia: "AINE — pirazolona",
    presentaciones: [],
    dosis: [],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "morfina",
    nombreGenerico: "Morfina",
    familia: "Opioide — agonista mu puro",
    presentaciones: [],
    dosis: [],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "metadona",
    nombreGenerico: "Metadona",
    familia: "Opioide — agonista mu puro",
    presentaciones: [
          {
                "concentracion": 10,
                "unidadConc": "mg/mL",
                "via": [
                      "IV",
                      "IM",
                      "SC"
                ],
                "nombreComercialLocal": "Solución inyectable 10 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Analgesia perioperatoria",
                "dosisMin": 0.5,
                "dosisMax": 1,
                "unidad": "mg/kg",
                "via": [
                      "IV",
                      "IM",
                      "SC"
                ],
                "frecuenciaH": 4,
                "duracionMaxDias": null,
                "fuente": "EMA — Comfortan (metadona), resumen de características del producto",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Depresión respiratoria",
          "Traumatismo craneal con hipertensión intracraneal",
          "Sustancia controlada: registrar su uso"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "buprenorfina",
    nombreGenerico: "Buprenorfina",
    familia: "Opioide — agonista parcial mu",
    presentaciones: [
          {
                "concentracion": 1.8,
                "unidadConc": "mg/mL",
                "via": [
                      "SC"
                ],
                "nombreComercialLocal": "Solución inyectable 1,8 mg/mL (concentrada felina)"
          },
          {
                "concentracion": 0.3,
                "unidadConc": "mg/mL",
                "via": [
                      "IM",
                      "IV"
                ],
                "nombreComercialLocal": "Solución inyectable 0,3 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "felino",
                "indicacion": "Analgesia postoperatoria",
                "dosisMin": 0.24,
                "dosisMax": 0.24,
                "unidad": "mg/kg",
                "via": [
                      "SC"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 3,
                "fuente": "FDA NADA 141-434 — Simbadol (buprenorphine) 1,8 mg/mL, etiqueta felina",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Depresión respiratoria preexistente",
          "Sustancia controlada: registrar su uso"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "butorfanol",
    nombreGenerico: "Butorfanol",
    familia: "Opioide — agonista kappa / antagonista mu",
    presentaciones: [
          {
                "concentracion": 10,
                "unidadConc": "mg/mL",
                "via": [
                      "IV",
                      "IM",
                      "SC"
                ],
                "nombreComercialLocal": "Solución inyectable 10 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Analgesia y antitusígeno",
                "dosisMin": 0.2,
                "dosisMax": 0.8,
                "unidad": "mg/kg",
                "via": [
                      "IV",
                      "IM",
                      "SC"
                ],
                "frecuenciaH": 6,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 018-190 — Torbugesic (butorphanol tartrate), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "equino",
                "indicacion": "Analgesia visceral (cólico)",
                "dosisMin": 0.1,
                "dosisMax": 0.1,
                "unidad": "mg/kg",
                "via": [
                      "IV"
                ],
                "frecuenciaH": 4,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 018-190 — Torbugesic (butorphanol tartrate), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Analgesia de techo bajo: no aumenta el efecto al subir la dosis",
          "Depresión respiratoria preexistente",
          "Sustancia controlada: registrar su uso"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "fentanilo",
    nombreGenerico: "Fentanilo",
    familia: "Opioide — agonista mu puro",
    presentaciones: [],
    dosis: [],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "tramadol",
    nombreGenerico: "Tramadol",
    familia: "Analgésico de acción central — opioide atípico",
    presentaciones: [],
    dosis: [],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "propofol",
    nombreGenerico: "Propofol",
    familia: "Inductor anestésico intravenoso",
    presentaciones: [
          {
                "concentracion": 10,
                "unidadConc": "mg/mL",
                "via": [
                      "IV"
                ],
                "nombreComercialLocal": "Emulsión inyectable 10 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Inducción anestésica sin premedicación",
                "dosisMin": 6.6,
                "dosisMax": 6.6,
                "unidad": "mg/kg",
                "via": [
                      "IV"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-070 — PropoFlo (propofol), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Administrar lentamente, titulando a efecto: la inyección rápida causa apnea",
          "Requiere material de intubación y oxígeno disponibles",
          "Gatos: el uso repetido en días consecutivos se asocia a daño oxidativo eritrocitario"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "ketamina",
    nombreGenerico: "Ketamina",
    familia: "Anestésico disociativo",
    presentaciones: [
          {
                "concentracion": 100,
                "unidadConc": "mg/mL",
                "via": [
                      "IM",
                      "IV"
                ],
                "nombreComercialLocal": "Solución inyectable 100 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "felino",
                "indicacion": "Contención química y anestesia de corta duración",
                "dosisMin": 11,
                "dosisMax": 33,
                "unidad": "mg/kg",
                "via": [
                      "IM"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 045-290 — Ketaset (ketamine HCl), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "No usar sola en procedimientos dolorosos: no da relajación muscular ni analgesia visceral suficiente",
          "Insuficiencia renal en gatos",
          "Cardiopatía hipertrófica",
          "Sustancia controlada: registrar su uso"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "alfaxalona",
    nombreGenerico: "Alfaxalona",
    familia: "Inductor anestésico — neuroesteroide",
    presentaciones: [
          {
                "concentracion": 10,
                "unidadConc": "mg/mL",
                "via": [
                      "IV"
                ],
                "nombreComercialLocal": "Solución inyectable 10 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Inducción anestésica sin premedicación",
                "dosisMin": 3,
                "dosisMax": 3,
                "unidad": "mg/kg",
                "via": [
                      "IV"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-342 — Alfaxan (alfaxalone), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "felino",
                "indicacion": "Inducción anestésica sin premedicación",
                "dosisMin": 5,
                "dosisMax": 5,
                "unidad": "mg/kg",
                "via": [
                      "IV"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-342 — Alfaxan (alfaxalone), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Administrar lentamente y titulando a efecto",
          "Requiere soporte respiratorio disponible"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "isoflurano",
    nombreGenerico: "Isoflurano",
    familia: "Anestésico inhalatorio",
    presentaciones: [],
    dosis: [],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "sevoflurano",
    nombreGenerico: "Sevoflurano",
    familia: "Anestésico inhalatorio",
    presentaciones: [],
    dosis: [],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "xilacina",
    nombreGenerico: "Xilacina",
    familia: "Agonista alfa-2 adrenérgico",
    presentaciones: [
          {
                "concentracion": 20,
                "unidadConc": "mg/mL",
                "via": [
                      "IM",
                      "IV"
                ],
                "nombreComercialLocal": "Solución inyectable 2%"
          },
          {
                "concentracion": 100,
                "unidadConc": "mg/mL",
                "via": [
                      "IM",
                      "IV"
                ],
                "nombreComercialLocal": "Solución inyectable 10%"
          }
    ],
    dosis: [
          {
                "especie": "equino",
                "indicacion": "Sedación y analgesia",
                "dosisMin": 1.1,
                "dosisMax": 1.1,
                "unidad": "mg/kg",
                "via": [
                      "IV"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 047-956 — Rompun / AnaSed (xylazine), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "bovino",
                "indicacion": "Sedación",
                "dosisMin": 0.05,
                "dosisMax": 0.1,
                "unidad": "mg/kg",
                "via": [
                      "IV",
                      "IM"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 047-956 — Rompun (xylazine): el bovino es mucho más sensible que el equino",
                "esExtralabel": false
          },
          {
                "especie": "canino",
                "indicacion": "Sedación y analgesia",
                "dosisMin": 1.1,
                "dosisMax": 1.1,
                "unidad": "mg/kg",
                "via": [
                      "IM"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 047-956 — Rompun / AnaSed (xylazine), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Bovino: hasta diez veces más sensible que el equino, verificar la dosis y la concentración del frasco",
          "Gestación avanzada en bovino: puede inducir el parto",
          "Cardiopatía, hipotensión, shock"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "dexmedetomidina",
    nombreGenerico: "Dexmedetomidina",
    familia: "Agonista alfa-2 adrenérgico",
    presentaciones: [
          {
                "concentracion": 0.5,
                "unidadConc": "mg/mL",
                "via": [
                      "IV",
                      "IM"
                ],
                "nombreComercialLocal": "Solución inyectable 0,5 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Sedación y analgesia — dosificar por superficie corporal",
                "dosisMin": 0.375,
                "dosisMax": 0.5,
                "unidad": "mg/m2",
                "via": [
                      "IV",
                      "IM"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-267 — Dexdomitor (dexmedetomidine): la etiqueta canina dosifica en mcg/m2, no en mg/kg",
                "esExtralabel": false
          },
          {
                "especie": "felino",
                "indicacion": "Sedación y analgesia",
                "dosisMin": 0.04,
                "dosisMax": 0.04,
                "unidad": "mg/kg",
                "via": [
                      "IM"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-267 — Dexdomitor (dexmedetomidine), etiqueta felina",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Enfermedad cardiovascular, respiratoria, hepática o renal",
          "No usar en animales en shock o debilitados"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "acepromacina",
    nombreGenerico: "Acepromacina",
    familia: "Fenotiazina — tranquilizante",
    presentaciones: [
          {
                "concentracion": 10,
                "unidadConc": "mg/mL",
                "via": [
                      "IM",
                      "IV",
                      "SC"
                ],
                "nombreComercialLocal": "Solución inyectable 10 mg/mL"
          },
          {
                "concentracion": 10,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 10 mg"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Tranquilización y premedicación",
                "dosisMin": 0.55,
                "dosisMax": 2.2,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 015-030 — PromAce (acepromazine maleate), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "canino",
                "indicacion": "Premedicación anestésica",
                "dosisMin": 0.055,
                "dosisMax": 0.11,
                "unidad": "mg/kg",
                "via": [
                      "IV",
                      "IM",
                      "SC"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 015-030 — PromAce (acepromazine maleate), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Hipovolemia, shock o deshidratación: causa hipotensión",
          "Antecedente de convulsiones",
          "Sementales: riesgo de prolapso peniano permanente en equinos",
          "No tiene efecto analgésico"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "midazolam",
    nombreGenerico: "Midazolam",
    familia: "Benzodiazepina",
    presentaciones: [],
    dosis: [],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "diazepam",
    nombreGenerico: "Diazepam",
    familia: "Benzodiazepina",
    presentaciones: [],
    dosis: [],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "lidocaina",
    nombreGenerico: "Lidocaína",
    familia: "Anestésico local — amida",
    presentaciones: [
          {
                "concentracion": 20,
                "unidadConc": "mg/mL",
                "via": [
                      "IU"
                ],
                "nombreComercialLocal": "Solución inyectable 2% sin epinefrina"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "DOSIS MÁXIMA por infiltración local (umbral de toxicidad)",
                "dosisMin": 4,
                "dosisMax": 4,
                "unidad": "mg/kg",
                "via": [
                      "IU"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA — etiqueta de lidocaína 2% de uso veterinario: no superar este total",
                "esExtralabel": false
          },
          {
                "especie": "felino",
                "indicacion": "DOSIS MÁXIMA por infiltración local (umbral de toxicidad)",
                "dosisMin": 2,
                "dosisMax": 2,
                "unidad": "mg/kg",
                "via": [
                      "IU"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA — etiqueta de lidocaína 2% de uso veterinario: el gato es más sensible",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Estas cifras son el TOPE, no una dosis a administrar entera: se infiltra lo que el bloqueo requiera sin superarlo",
          "No usar formulaciones con epinefrina en zonas acras (orejas, cola, extremidades distales)",
          "Bloqueo cardiaco de alto grado"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "bupivacaina",
    nombreGenerico: "Bupivacaína",
    familia: "Anestésico local — amida",
    presentaciones: [],
    dosis: [],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "atropina",
    nombreGenerico: "Atropina",
    familia: "Anticolinérgico — antimuscarínico",
    presentaciones: [
          {
                "concentracion": 0.54,
                "unidadConc": "mg/mL",
                "via": [
                      "IV",
                      "IM",
                      "SC"
                ],
                "nombreComercialLocal": "Solución inyectable 0,54 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Premedicación anestésica / bradicardia",
                "dosisMin": 0.02,
                "dosisMax": 0.04,
                "unidad": "mg/kg",
                "via": [
                      "IV",
                      "IM",
                      "SC"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA — etiqueta de sulfato de atropina inyectable de uso veterinario",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Taquiarritmias",
          "Glaucoma",
          "Íleo paralítico"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "ivermectina",
    nombreGenerico: "Ivermectina",
    familia: "Lactona macrocíclica — avermectina",
    presentaciones: [
          {
                "concentracion": 10,
                "unidadConc": "mg/mL",
                "via": [
                      "SC"
                ],
                "nombreComercialLocal": "Solución inyectable 1%"
          }
    ],
    dosis: [
          {
                "especie": "bovino",
                "indicacion": "Nematodos gastrointestinales y ectoparásitos",
                "dosisMin": 0.2,
                "dosisMax": 0.2,
                "unidad": "mg/kg",
                "via": [
                      "SC"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 128-409 — Ivomec (ivermectin) 1% Injection, etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "porcino",
                "indicacion": "Nematodos y ectoparásitos",
                "dosisMin": 0.3,
                "dosisMax": 0.3,
                "unidad": "mg/kg",
                "via": [
                      "SC"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 128-409 — Ivomec (ivermectin) 1% Injection, etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Razas con mutación MDR1 (colies y afines): alta sensibilidad neurológica",
          "No usar la formulación bovina en perros"
    ],
    alertas: [
          "Canino: las presentaciones concentradas de uso ganadero han causado intoxicaciones graves y muerte en razas con mutación MDR1. No usar formulaciones bovinas en perros."
    ],
    verificadoEl: null
  },

  {
    slug: "doramectina",
    nombreGenerico: "Doramectina",
    familia: "Lactona macrocíclica — avermectina",
    presentaciones: [
          {
                "concentracion": 10,
                "unidadConc": "mg/mL",
                "via": [
                      "IM",
                      "SC"
                ],
                "nombreComercialLocal": "Solución inyectable 1%"
          }
    ],
    dosis: [
          {
                "especie": "bovino",
                "indicacion": "Nematodos gastrointestinales y ectoparásitos",
                "dosisMin": 0.2,
                "dosisMax": 0.2,
                "unidad": "mg/kg",
                "via": [
                      "IM",
                      "SC"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-061 — Dectomax (doramectin), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "No usar en bovinos de aptitud lechera en lactancia"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "selamectina",
    nombreGenerico: "Selamectina",
    familia: "Lactona macrocíclica — avermectina",
    presentaciones: [
          {
                "concentracion": 60,
                "unidadConc": "mg/mL",
                "via": [
                      "tópica"
                ],
                "nombreComercialLocal": "Pipeta spot-on 6%"
          },
          {
                "concentracion": 120,
                "unidadConc": "mg/mL",
                "via": [
                      "tópica"
                ],
                "nombreComercialLocal": "Pipeta spot-on 12%"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Pulgas, sarna, dirofilaria — prevención mensual",
                "dosisMin": 6,
                "dosisMax": 6,
                "unidad": "mg/kg",
                "via": [
                      "tópica"
                ],
                "frecuenciaH": 720,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-152 — Revolution (selamectin), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "felino",
                "indicacion": "Pulgas, ácaros del oído, dirofilaria — mensual",
                "dosisMin": 6,
                "dosisMax": 6,
                "unidad": "mg/kg",
                "via": [
                      "tópica"
                ],
                "frecuenciaH": 720,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-152 — Revolution (selamectin), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "No aplicar sobre piel lesionada o pelaje mojado",
          "Descartar dirofilariosis activa antes de iniciar la prevención"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "fenbendazol",
    nombreGenerico: "Fenbendazol",
    familia: "Benzimidazol",
    presentaciones: [
          {
                "concentracion": 222,
                "unidadConc": "mg/g",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Gránulos 22,2%"
          },
          {
                "concentracion": 100,
                "unidadConc": "mg/mL",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Suspensión 10%"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Nematodos y Giardia",
                "dosisMin": 50,
                "dosisMax": 50,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 3,
                "fuente": "FDA NADA 121-473 — Panacur (fenbendazole), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "bovino",
                "indicacion": "Nematodos gastrointestinales",
                "dosisMin": 5,
                "dosisMax": 5,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 121-473 — Panacur (fenbendazole), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "albendazol",
    nombreGenerico: "Albendazol",
    familia: "Benzimidazol",
    presentaciones: [
          {
                "concentracion": 113.6,
                "unidadConc": "mg/mL",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Suspensión oral 11,36%"
          }
    ],
    dosis: [
          {
                "especie": "bovino",
                "indicacion": "Nematodos gastrointestinales, pulmonares y Fasciola adulta",
                "dosisMin": 10,
                "dosisMax": 10,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 110-048 — Valbazen (albendazole), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "ovino",
                "indicacion": "Nematodos gastrointestinales y Fasciola adulta",
                "dosisMin": 7.5,
                "dosisMax": 7.5,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 110-048 — Valbazen (albendazole), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "No administrar en el primer tercio de la gestación: efecto teratogénico",
          "No usar en bovinos de aptitud lechera en lactancia"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "praziquantel",
    nombreGenerico: "Praziquantel",
    familia: "Antiparasitario — cestodicida",
    presentaciones: [
          {
                "concentracion": 23,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 23 mg"
          },
          {
                "concentracion": 56.8,
                "unidadConc": "mg/mL",
                "via": [
                      "SC",
                      "IM"
                ],
                "nombreComercialLocal": "Inyectable 56,8 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Cestodos (Dipylidium, Taenia)",
                "dosisMin": 5,
                "dosisMax": 5,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 118-661 — Droncit (praziquantel), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "felino",
                "indicacion": "Cestodos",
                "dosisMin": 5,
                "dosisMax": 5,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 118-661 — Droncit (praziquantel), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "No usar en cachorros menores de 4 semanas según etiqueta"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "pirantel",
    nombreGenerico: "Pirantel",
    familia: "Tetrahidropirimidina",
    presentaciones: [
          {
                "concentracion": 50,
                "unidadConc": "mg/mL",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Suspensión oral 50 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Ascáridos y ancilostomas",
                "dosisMin": 5,
                "dosisMax": 5,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 094-541 — Nemex (pyrantel pamoate), etiqueta del fabricante",
                "esExtralabel": false
          },
          {
                "especie": "felino",
                "indicacion": "Ascáridos y ancilostomas",
                "dosisMin": 5,
                "dosisMax": 5,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 094-541 — Nemex (pyrantel pamoate), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Repetir a las 2-3 semanas para cubrir las formas migratorias"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "afoxolaner",
    nombreGenerico: "Afoxolaner",
    familia: "Isoxazolina — ectoparasiticida",
    presentaciones: [
          {
                "concentracion": 11.3,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta masticable 11,3 mg"
          },
          {
                "concentracion": 28.3,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta masticable 28,3 mg"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Pulgas y garrapatas — tratamiento mensual",
                "dosisMin": 2.5,
                "dosisMax": 2.5,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 720,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-406 — NexGard (afoxolaner): dosis mínima 2,5 mg/kg",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Usar con precaución en perros con antecedente de convulsiones"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "fluralaner",
    nombreGenerico: "Fluralaner",
    familia: "Isoxazolina — ectoparasiticida",
    presentaciones: [
          {
                "concentracion": 112.5,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta masticable 112,5 mg"
          },
          {
                "concentracion": 250,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta masticable 250 mg"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Pulgas y garrapatas — cada 12 semanas",
                "dosisMin": 25,
                "dosisMax": 56,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 2016,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 141-426 — Bravecto (fluralaner), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Administrar con comida para mejorar la absorción",
          "Precaución con antecedente de convulsiones"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "toltrazuril",
    nombreGenerico: "Toltrazuril",
    familia: "Triazinona — anticoccidial",
    presentaciones: [
          {
                "concentracion": 50,
                "unidadConc": "mg/mL",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Suspensión oral 5%"
          }
    ],
    dosis: [
          {
                "especie": "porcino",
                "indicacion": "Coccidiosis en lechones — dosis única",
                "dosisMin": 20,
                "dosisMax": 20,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "EMA — Baycox (toltrazuril), resumen de características del producto",
                "esExtralabel": false
          },
          {
                "especie": "bovino",
                "indicacion": "Coccidiosis en terneros — dosis única",
                "dosisMin": 15,
                "dosisMax": 15,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": null,
                "duracionMaxDias": null,
                "fuente": "EMA — Baycox (toltrazuril), resumen de características del producto",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Es metafiláctico: administrar antes del pico de excreción esperado"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "amprolio",
    nombreGenerico: "Amprolio",
    familia: "Anticoccidial — antagonista de tiamina",
    presentaciones: [
          {
                "concentracion": 96,
                "unidadConc": "mg/mL",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Solución oral 9,6%"
          }
    ],
    dosis: [
          {
                "especie": "bovino",
                "indicacion": "Coccidiosis en terneros",
                "dosisMin": 10,
                "dosisMax": 10,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": 5,
                "fuente": "FDA NADA 013-149 — Corid (amprolium), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Uso prolongado: antagoniza la tiamina y puede causar polioencefalomalacia"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "gluconato-calcio",
    nombreGenerico: "Gluconato de calcio",
    familia: "Electrolito — sal de calcio",
    presentaciones: [],
    dosis: [],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "cloruro-potasio",
    nombreGenerico: "Cloruro de potasio",
    familia: "Electrolito — sal de potasio",
    presentaciones: [],
    dosis: [],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "bicarbonato-sodio",
    nombreGenerico: "Bicarbonato de sodio",
    familia: "Alcalinizante — electrolito",
    presentaciones: [],
    dosis: [],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "dextrosa",
    nombreGenerico: "Dextrosa (glucosa)",
    familia: "Fluido — aporte energético",
    presentaciones: [],
    dosis: [],
    retiro: [],
    contraindicaciones: [],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "furosemida",
    nombreGenerico: "Furosemida",
    familia: "Diurético de asa",
    presentaciones: [
          {
                "concentracion": 50,
                "unidadConc": "mg/mL",
                "via": [
                      "IV",
                      "IM"
                ],
                "nombreComercialLocal": "Solución inyectable 5%"
          },
          {
                "concentracion": 12.5,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 12,5 mg"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Edema de origen cardiaco",
                "dosisMin": 2.5,
                "dosisMax": 5,
                "unidad": "mg/kg",
                "via": [
                      "IV",
                      "IM",
                      "VO"
                ],
                "frecuenciaH": 12,
                "duracionMaxDias": null,
                "fuente": "FDA NADA 034-478 — Salix / Lasix (furosemide), etiqueta del fabricante",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Deshidratación o desequilibrio electrolítico no corregidos",
          "Anuria"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "dexametasona",
    nombreGenerico: "Dexametasona",
    familia: "Corticoide — glucocorticoide",
    presentaciones: [
          {
                "concentracion": 2,
                "unidadConc": "mg/mL",
                "via": [
                      "IV",
                      "IM"
                ],
                "nombreComercialLocal": "Solución inyectable 2 mg/mL"
          }
    ],
    dosis: [
          {
                "especie": "bovino",
                "indicacion": "Antiinflamatorio / cetosis primaria",
                "dosisMin": 5,
                "dosisMax": 20,
                "unidad": "mg/animal",
                "via": [
                      "IV",
                      "IM"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": null,
                "fuente": "FDA — etiqueta de dexametasona inyectable de uso veterinario: pauta por animal, no por kg",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Gestación avanzada: puede inducir el parto",
          "Infección sistémica sin cobertura antibiótica",
          "Úlcera gastrointestinal"
    ],
    alertas: [],
    verificadoEl: null
  },

  {
    slug: "prednisolona",
    nombreGenerico: "Prednisolona",
    familia: "Corticoide — glucocorticoide",
    presentaciones: [
          {
                "concentracion": 5,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 5 mg"
          },
          {
                "concentracion": 20,
                "unidadConc": "mg/tableta",
                "via": [
                      "VO"
                ],
                "nombreComercialLocal": "Tableta 20 mg"
          }
    ],
    dosis: [
          {
                "especie": "canino",
                "indicacion": "Antiinflamatorio",
                "dosisMin": 0.5,
                "dosisMax": 1,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": null,
                "fuente": "FDA — etiqueta de prednisolona de uso veterinario",
                "esExtralabel": false
          },
          {
                "especie": "felino",
                "indicacion": "Antiinflamatorio",
                "dosisMin": 0.5,
                "dosisMax": 1,
                "unidad": "mg/kg",
                "via": [
                      "VO"
                ],
                "frecuenciaH": 24,
                "duracionMaxDias": null,
                "fuente": "FDA — etiqueta de prednisolona de uso veterinario",
                "esExtralabel": false
          }
    ],
    retiro: [],
    contraindicaciones: [
          "Infección sistémica sin cobertura antibiótica",
          "Úlcera gastrointestinal",
          "Diabetes mellitus",
          "No suspender bruscamente tras uso prolongado",
          "No combinar con AINEs"
    ],
    alertas: [],
    verificadoEl: null
  }
];
