/* ============================================================
   FICHAS DE FÁRMACO — descripción y contraindicaciones
   ============================================================

   Este archivo es SOLO DATOS. Trae tres cosas por fármaco:

     descripcion   qué es y para qué se usa, en una o dos líneas.
     contra[]      contraindicaciones y advertencias.
     fuente        de dónde salió esa lista.

   ------------------------------------------------------------
   DE DÓNDE SALE ESTO
   ------------------------------------------------------------
   Nada está redactado de memoria. Cada lista viene de la etiqueta
   del producto registrado o de literatura revisada por pares:

     · FDA / DailyMed — etiquetas veterinarias (NADA) y humanas (SPL).
       La fuente dice siempre cuál de las dos.
     · EMA — fichas técnicas europeas de producto veterinario.
     · PubMed — artículos y series de casos, con su DOI.

   Cuando el fármaco NO tiene etiqueta veterinaria y se usa fuera de
   etiqueta (omeprazol, gabapentina, ondansetrón…), la fuente lo dice
   y la propia lista lo advierte. No es lo mismo un dato de la
   etiqueta canina que uno traído de la etiqueta humana.

   Los tiempos de retiro de FDA o EMA NO son vinculantes en Ecuador.

   ------------------------------------------------------------
   EL CANDADO ⛔
   ------------------------------------------------------------
   Una línea que empieza por ⛔ y nombra una especie BLOQUEA el
   cálculo de dosis para esa especie: la calculadora no enseña ningún
   número. Se reserva para prohibiciones absolutas de etiqueta
   (meloxicam en gatos, tilosina en équidos…), no para precauciones.

   Para que bloquee, la especie tiene que escribirse como la nombra la
   app: canino, felino, bovino, porcino, equino, ovino.

   ------------------------------------------------------------
   LO QUE ESTE ARCHIVO NO ES
   ------------------------------------------------------------
   No trae dosis, ni concentraciones, ni tiempos de retiro: eso sigue
   en semilla-formulario.js y lo llena Daniel. Y no toca
   "verificadoEl" — la firma de que alguien miró la etiqueta es suya.
   ============================================================ */

export const FICHAS_FARMACO = [

  /* ---------- Antibacterianos ---------- */

  {
    slug: "amoxicilina",
    descripcion: "Aminopenicilina de espectro ampliado. Primera línea en infecciones de piel, urinarias y respiratorias por gérmenes sensibles.",
    fuente: "FDA/DailyMed, etiquetas de aminopenicilinas · enterotoxemia por Clostridium spiroforme en conejo: Borriello, Clin Infect Dis 1995, doi 10.1093/clinids/20.supplement_2.s242",
    contra: [
      "Hipersensibilidad a penicilinas o cefalosporinas (hay reactividad cruzada)",
      "Conejos, cobayos, hámsteres y jerbos: por vía oral arrasa la flora del ciego y desencadena enterotoxemia clostridial, que suele ser mortal",
      "Insuficiencia renal grave: se elimina por riñón, hay que espaciar las tomas"
    ]
  },
  {
    slug: "amoxicilina-clavulanico",
    descripcion: "Amoxicilina con un inhibidor de betalactamasas. Cubre estafilococos y anaerobios productores de betalactamasa que la amoxicilina sola no alcanza.",
    fuente: "FDA/DailyMed, etiquetas de amoxicilina-clavulánico · Borriello, Clin Infect Dis 1995, doi 10.1093/clinids/20.supplement_2.s242",
    contra: [
      "Hipersensibilidad a penicilinas o cefalosporinas",
      "Conejos, cobayos, hámsteres y jerbos: enterotoxemia clostridial por vía oral",
      "Antecedente de ictericia o daño hepático asociado a este mismo fármaco",
      "Insuficiencia renal grave: espaciar las tomas"
    ]
  },
  {
    slug: "ampicilina",
    descripcion: "Aminopenicilina inyectable. Se usa cuando hace falta un betalactámico por vía parenteral y el animal no puede tomar nada por boca.",
    fuente: "FDA/DailyMed, etiquetas de ampicilina · Borriello, Clin Infect Dis 1995, doi 10.1093/clinids/20.supplement_2.s242",
    contra: [
      "Hipersensibilidad a penicilinas o cefalosporinas",
      "Lagomorfos y roedores herbívoros: enterotoxemia clostridial",
      "Insuficiencia renal grave: espaciar las tomas"
    ]
  },
  {
    slug: "penicilina-g",
    descripcion: "Penicilina natural de espectro estrecho, muy activa frente a grampositivos. Presentación procaínica o benzatínica según cuánto se quiera que dure.",
    fuente: "FDA/DailyMed — QUARTERMASTER (penicilina G procaínica, etiqueta veterinaria) y etiquetas de penicilina G",
    contra: [
      "Hipersensibilidad a penicilinas",
      "La presentación procaínica NO se administra por vía intravenosa: la procaína provoca reacciones neurológicas y cardiovasculares graves",
      "Conejos y roedores herbívoros: enterotoxemia clostridial",
      "La etiqueta intramamaria de secado prohíbe usarla dentro de las 6 semanas previas al parto, y la leche de las primeras 96 horas tras el parto no sirve para consumo"
    ]
  },
  {
    slug: "cefalexina",
    descripcion: "Cefalosporina de primera generación por vía oral. Caballo de batalla en piodermas y otras infecciones cutáneas del perro.",
    fuente: "FDA/DailyMed — CEPHALEXIN CAPSULE (etiqueta humana; en perro y gato el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad a cefalosporinas o penicilinas",
      "Insuficiencia renal: ajustar el intervalo, se elimina por riñón",
      "Dato de etiqueta humana: la etiqueta consultada no es veterinaria"
    ]
  },
  {
    slug: "ceftiofur",
    descripcion: "Cefalosporina de tercera generación de uso exclusivo veterinario, sobre todo en respiratorio y podal de rumiantes y cerdos.",
    fuente: "FDA/DailyMed — EXCEDE FOR SWINE (ceftiofur, etiqueta veterinaria, Zoetis)",
    contra: [
      "Hipersensibilidad a betalactámicos",
      "No está demostrada la seguridad en cerdas gestantes ni en animales destinados a reproducción",
      "El personal alérgico a penicilinas o cefalosporinas debe evitar el contacto: se han descrito reacciones por exposición tópica"
    ]
  },
  {
    slug: "enrofloxacina",
    descripcion: "Fluoroquinolona de amplio espectro, muy usada en pequeños animales y en producción. Buena penetración tisular y actividad frente a gramnegativos.",
    fuente: "FDA/DailyMed — ENROFLOXACIN 100 INJECTION (etiqueta veterinaria) y NADA 140-913 Baytril",
    contra: [
      "Felinos: no superar 5 mg/kg/día. Por encima de esa dosis se ha descrito degeneración retiniana y ceguera irreversible",
      "Animales en crecimiento: artropatía del cartílago articular, descrita en casi todas las especies ensayadas",
      "Hipersensibilidad conocida a quinolonas",
      "Antecedente de convulsiones o enfermedad del sistema nervioso central",
      "No está determinado el efecto sobre la reproducción, la gestación ni la lactancia en bovinos y porcinos",
      "La inyección subcutánea deja reacción local en el punto de aplicación"
    ]
  },
  {
    slug: "marbofloxacina",
    descripcion: "Fluoroquinolona de uso veterinario en perro y gato, con una sola toma al día.",
    fuente: "FDA/DailyMed — MARBOFLOXACIN TABLET (etiqueta veterinaria)",
    contra: [
      "Perros en fase de crecimiento rápido: contraindicada hasta los 8 meses en razas pequeñas y medianas, 12 meses en grandes y 18 meses en gigantes, por artropatía",
      "Gatos menores de 12 meses: contraindicada",
      "Hipersensibilidad conocida a quinolonas",
      "Precaución con trastornos del sistema nervioso central: se han descrito convulsiones"
    ]
  },
  {
    slug: "oxitetraciclina-la",
    descripcion: "Tetraciclina de acción prolongada para producción. Cubre gérmenes intracelulares como anaplasma y clamidia además de la flora habitual.",
    fuente: "FDA/DailyMed — OXYTETRACYCLINE 200 INJECTION (etiqueta veterinaria, Norbrook)",
    contra: [
      "La administración intravenosa rápida puede provocar el colapso del animal: pasarla lenta, en 5 minutos como mínimo",
      "No superar 10 mL por punto de inyección en vacuno adulto ni 5 mL por punto en cerdo adulto: por encima quedan residuos más allá del tiempo de retiro",
      "Insuficiencia renal",
      "La leche del animal tratado y la de las 96 horas siguientes no sirve para consumo humano"
    ]
  },
  {
    slug: "doxiciclina",
    descripcion: "Tetraciclina de segunda generación. Es la elección en hemoparásitos, ehrlichiosis, anaplasmosis y micoplasma.",
    fuente: "FDA/DailyMed — DOXYCYCLINE CAPSULE (etiqueta humana) · estenosis esofágica en gatos: German y col., J Feline Med Surg 2005, doi 10.1016/j.jfms.2004.04.001; McGrotty y Knottenbelt, J Small Anim Pract 2002, doi 10.1111/j.1748-5827.2002.tb00062.x",
    contra: [
      "Gatos: la tableta seca se queda en el esófago y provoca estenosis. Cuatro casos publicados solo en la serie de 2005. Darla siempre seguida de agua o comida",
      "Hipersensibilidad a cualquier tetraciclina",
      "Animales en crecimiento y último tercio de la gestación: se deposita en dientes y hueso y los tiñe de forma permanente",
      "Dato de etiqueta humana: en perro y gato el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "gentamicina",
    descripcion: "Aminoglucósido inyectable de amplio espectro frente a gramnegativos. Reservado a infecciones graves por su toxicidad.",
    fuente: "FDA/DailyMed — GENTAMICIN SULFATE INJECTION (etiqueta humana, con recuadro de advertencia)",
    contra: [
      "El recuadro de advertencia de la etiqueta señala nefrotoxicidad y ototoxicidad; la lesión del octavo par suele ser IRREVERSIBLE",
      "Insuficiencia renal: el riesgo de daño renal es mayor y obliga a espaciar las dosis",
      "Deshidratación no corregida: hidratar antes de administrarla",
      "Hipersensibilidad a cualquier aminoglucósido (hay reactividad cruzada dentro del grupo)",
      "Gestación: los aminoglucósidos cruzan la placenta y se ha descrito sordera congénita bilateral irreversible",
      "No combinar con otros fármacos nefrotóxicos ni con diuréticos de asa",
      "Dato de etiqueta humana: el uso sistémico en animales es fuera de etiqueta"
    ]
  },
  {
    slug: "amikacina",
    descripcion: "Aminoglucósido más resistente a las enzimas bacterianas que la gentamicina. Se guarda para gramnegativos multirresistentes.",
    fuente: "FDA/DailyMed — AMIKACIN SULFATE INJECTION (etiqueta humana, con recuadro de advertencia)",
    contra: [
      "El recuadro de advertencia describe ototoxicidad vestibular y auditiva bilateral permanente, y nefrotoxicidad",
      "La etiqueta no avala tratamientos de más de 14 días",
      "Insuficiencia renal: mayor riesgo de sordera y de daño renal",
      "Deshidratación no corregida",
      "Hipersensibilidad a cualquier aminoglucósido",
      "Gestación: riesgo de sordera congénita en el feto",
      "Dato de etiqueta humana: el uso en animales es fuera de etiqueta"
    ]
  },
  {
    slug: "florfenicol",
    descripcion: "Anfenicol de uso exclusivo veterinario. Indicado sobre todo en el complejo respiratorio bovino y en podal.",
    fuente: "FDA/DailyMed — FLORFENICOL INJECTION (etiqueta veterinaria, Sparhawk)",
    contra: [
      "Hipersensibilidad conocida al florfenicol",
      "No usar en animales destinados a reproducción: no se ha determinado el efecto sobre la fertilidad, la gestación ni la lactancia",
      "No usar en vacas de aptitud lechera en lactancia",
      "No superar el volumen máximo por punto de inyección que indique el envase"
    ]
  },
  {
    slug: "tilosina",
    descripcion: "Macrólido de uso veterinario, activo frente a micoplasma y grampositivos. Común en cerdos y aves.",
    fuente: "FDA/DailyMed — TYLAN 200 (tilosina, etiqueta veterinaria, Elanco)",
    contra: [
      "⛔ Equino: la etiqueta dice que la inyección de tilosina en équidos HA SIDO MORTAL. No usar en esta especie",
      "Lechones: la sobredosis produce shock y muerte. Por debajo de 11 kg la etiqueta manda usar la presentación diluida, no la concentrada",
      "Hipersensibilidad a macrólidos",
      "No usar en vacas de aptitud lechera en lactancia"
    ]
  },
  {
    slug: "tulatromicina",
    descripcion: "Macrólido triamilida de dosis única y acción muy prolongada. Para el complejo respiratorio de bovinos y cerdos.",
    fuente: "FDA/DailyMed — DRAXXIN KP (tulatromicina, etiqueta veterinaria, Zoetis)",
    contra: [
      "Hipersensibilidad conocida a la tulatromicina",
      "No usar en animales de reproducción de más de un año: no se ha determinado el efecto sobre la fertilidad, la gestación ni la lactancia",
      "No usar en vacas de aptitud lechera"
    ]
  },
  {
    slug: "trimetoprim-sulfa",
    descripcion: "Sulfonamida potenciada. Amplio espectro y bajo costo; útil en urinarias, respiratorias y coccidiosis.",
    fuente: "FDA/DailyMed — SULFAMETHOXAZOLE AND TRIMETHOPRIM TABLET (etiqueta humana; la sulfadiazina veterinaria comparte grupo)",
    contra: [
      "Hipersensibilidad a trimetoprim o a cualquier sulfonamida",
      "Antecedente de trombocitopenia inmunitaria por sulfas o trimetoprim",
      "Anemia megaloblástica por déficit de folato documentada",
      "Daño hepático marcado",
      "Insuficiencia renal grave cuando no se puede controlar la función renal",
      "Deshidratación: riesgo de cristaluria, hay que asegurar el agua",
      "Queratoconjuntivitis seca: las sulfas la desencadenan o la agravan",
      "Razas predispuestas a reacción idiosincrásica a sulfas, el dóberman entre ellas",
      "Gestación: se ha asociado a malformaciones congénitas",
      "Dato de etiqueta humana en la combinación consultada"
    ]
  },
  {
    slug: "metronidazol",
    descripcion: "Nitroimidazol activo frente a anaerobios y protozoos. Habitual en giardiasis, colitis y abscesos.",
    fuente: "FDA/DailyMed — METRONIDAZOLE TABLET (etiqueta humana, con recuadro de advertencia)",
    contra: [
      "Hipersensibilidad al metronidazol o a otros nitroimidazoles",
      "El recuadro de advertencia recoge que es carcinogénico en ratón y rata: la etiqueta pide evitar el uso innecesario",
      "Insuficiencia hepática: se metaboliza en hígado y se acumula, hay que bajar la dosis",
      "Primer tercio de la gestación",
      "La etiqueta describe encefalopatía y neuropatía periférica con el uso prolongado; obliga a suspenderlo",
      "Dato de etiqueta humana: en perro y gato el uso es fuera de etiqueta"
    ]
  },

  /* ---------- AINEs y analgésicos ---------- */

  {
    slug: "meloxicam",
    descripcion: "AINE del grupo oxicam, con preferencia por la COX-2. Analgésico y antiinflamatorio de fondo en dolor osteomuscular y postoperatorio del perro.",
    fuente: "FDA/DailyMed — MELOXICAM SUSPENSION (etiqueta veterinaria, con recuadro de advertencia)",
    contra: [
      "⛔ Felino: la etiqueta lleva RECUADRO DE ADVERTENCIA. El uso repetido de meloxicam en gatos se ha asociado a fallo renal agudo y muerte. La etiqueta dice literalmente que no se administre meloxicam adicional, inyectable ni oral, a un gato",
      "Hipersensibilidad conocida al meloxicam",
      "Deshidratación, hipovolemia o hipotensión no corregidas: el riñón depende de las prostaglandinas para mantener su perfusión",
      "Enfermedad renal, hepática o cardiaca descompensada",
      "Junto a otro AINE o a un corticoide: se suman los efectos gástricos y renales",
      "Úlcera o sangrado gastrointestinal",
      "No está evaluada la seguridad por debajo de 6 meses, ni en reproductores, gestantes o lactantes"
    ]
  },
  {
    slug: "carprofeno",
    descripcion: "AINE propiónico de uso canino. Muy usado en artrosis y en el postoperatorio de cirugía ortopédica.",
    fuente: "FDA/DailyMed — CARPROFEN INJECTION (etiqueta veterinaria)",
    contra: [
      "⛔ Felino: la etiqueta es solo para perros y dice expresamente que no se use en gatos",
      "Hipersensibilidad previa al carprofeno",
      "La etiqueta advierte que, como clase, los AINE inhibidores de la COX pueden dar toxicidad gastrointestinal, renal y hepática",
      "Enfermedad renal, hepática o cardiaca",
      "Úlcera gastrointestinal",
      "Junto a otro AINE o a un corticoide"
    ]
  },
  {
    slug: "firocoxib",
    descripcion: "AINE coxib, inhibidor selectivo de la COX-2. Hay presentación equina y presentación canina.",
    fuente: "FDA/DailyMed — FIROCOXIB FOR HORSES (etiqueta veterinaria)",
    contra: [
      "Hipersensibilidad al firocoxib",
      "La etiqueta equina es solo para caballos; la canina, solo para perros. No hay etiqueta felina: no extrapolar a gatos",
      "Antes de empezar un AINE, la etiqueta pide historia y exploración completas",
      "Enfermedad renal o hepática",
      "Junto a otro AINE o a un corticoide",
      "No usar en caballos destinados a consumo humano"
    ]
  },
  {
    slug: "flunixin",
    descripcion: "AINE fenamato, potente antipirético y antiendotóxico. Referencia en cólico equino y en mastitis y respiratorio de bovinos.",
    fuente: "FDA/DailyMed — FLUNIXIN MEGLUMINE INJECTION (etiqueta veterinaria, VetTek)",
    contra: [
      "Evitar la inyección intraarterial: en caballos produce ataxia, incoordinación, hiperventilación, histeria y debilidad muscular (transitorias)",
      "Bovinos: no usar dentro de las 48 horas previas al parto esperado. Al inhibir las prostaglandinas retrasa el parto y alarga el trabajo, con más riesgo de mortinato",
      "Bovinos: la etiqueta autoriza la vía intravenosa; la intramuscular se asocia a reacción local",
      "Hipersensibilidad a la flunixina",
      "Usar con criterio si se sospecha daño renal o úlcera gástrica"
    ]
  },
  {
    slug: "ketoprofeno",
    descripcion: "AINE propiónico de acción corta, buen antipirético. Frecuente en producción y en dolor agudo.",
    fuente: "FDA/DailyMed — KETOPROFEN CAPSULE (etiqueta humana, con recuadro de advertencia); en veterinaria el uso es fuera de etiqueta en Ecuador salvo producto registrado",
    contra: [
      "Hipersensibilidad al ketoprofeno",
      "Antecedente de asma, urticaria o reacción alérgica tras aspirina u otro AINE: se han descrito anafilaxias raras pero mortales",
      "El recuadro de advertencia recoge riesgo de sangrado, ulceración y perforación gastrointestinal, que pueden ser mortales y aparecer sin síntomas previos",
      "Úlcera gastrointestinal",
      "Insuficiencia renal o hepática",
      "Junto a otro AINE o a un corticoide",
      "Dato de etiqueta humana: comprobar la etiqueta del producto veterinario registrado"
    ]
  },
  {
    slug: "fenilbutazona",
    descripcion: "AINE pirazolónico clásico del caballo. Antiinflamatorio potente y barato para cojeras y dolor osteomuscular.",
    fuente: "FDA/DailyMed — PHENYLBUTAZONE INJECTION (etiqueta veterinaria, Aspen)",
    contra: [
      "⛔ Bovino, porcino, ovino: la etiqueta prohíbe destinar a consumo humano cualquier animal tratado. No administrar a ganado de carne ni de leche",
      "Solo por vía INTRAVENOSA. No inyectar por vía subcutánea ni intramuscular: causa necrosis del tejido",
      "Precaución en animales con antecedente de alergia a fármacos",
      "Suspender al primer signo de trastorno digestivo, ictericia o discrasia sanguínea",
      "La etiqueta recuerda que en el ser humano hay casos confirmados de agranulocitosis por este fármaco: cuidado al manipularlo",
      "Úlcera gastrointestinal o hipoproteinemia"
    ]
  },
  {
    slug: "dipirona",
    descripcion: "Pirazolona analgésica, antipirética y espasmolítica. Muy usada en cólico y en fiebre.",
    fuente: "FDA/DailyMed — ZIMETA (dipirona inyectable, etiqueta veterinaria equina, NADA 141-513)",
    contra: [
      "⛔ Bovino, porcino, ovino: la etiqueta prohíbe el uso en cualquier animal productor de alimentos, incluidas las lecheras",
      "Hipersensibilidad conocida a la dipirona",
      "No repetir antes de 12 horas: alarga el tiempo de protrombina y aparecen signos de coagulopatía",
      "Riesgo de hemorragia: la etiqueta pide precaución, prolonga los parámetros de coagulación",
      "Se han descrito úlceras gástricas y heces anormales en el caballo",
      "No combinar con otros antiinflamatorios, AINE o corticoides",
      "No está evaluada en menores de 3 años, reproductores, yeguas gestantes ni lactantes",
      "Cuidado al manipular la jeringa cargada: la autoinyección accidental es peligrosa, en el ser humano la dipirona causa agranulocitosis"
    ]
  },
  {
    slug: "morfina",
    descripcion: "Opioide agonista mu puro. Patrón de referencia de la analgesia intensa, y el opioide con el que se comparan los demás.",
    fuente: "FDA/DailyMed — MORPHINE SULFATE ORAL SOLUTION (etiqueta humana, con recuadro de advertencia)",
    contra: [
      "Depresión respiratoria significativa",
      "Asma bronquial aguda o grave sin monitorización ni equipo de reanimación a mano",
      "Obstrucción gastrointestinal conocida o sospechada, íleo paralítico incluido",
      "Hipersensibilidad a la morfina",
      "Uso de inhibidores de la MAO en los 14 días previos",
      "Sustancia controlada: registrar cada uso",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "metadona",
    descripcion: "Opioide agonista mu puro con acción también sobre el receptor NMDA. Analgesia larga y sedación moderada.",
    fuente: "FDA/DailyMed — METHADONE HYDROCHLORIDE TABLET (etiqueta humana, con recuadro de advertencia)",
    contra: [
      "Depresión respiratoria significativa",
      "Asma bronquial aguda o grave sin monitorización ni equipo de reanimación",
      "Obstrucción gastrointestinal o íleo paralítico",
      "Hipersensibilidad a la metadona",
      "Traumatismo craneal con hipertensión intracraneal",
      "Sustancia controlada: registrar cada uso",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "buprenorfina",
    descripcion: "Opioide agonista parcial mu, de acción larga y techo analgésico. Cómoda en el gato por la vía transmucosa.",
    fuente: "FDA/DailyMed — SIMBADOL (buprenorfina, etiqueta veterinaria felina, Zoetis)",
    contra: [
      "Hipersensibilidad a la buprenorfina o intolerancia conocida a opioides",
      "No está evaluada en gatos moribundos, es decir los que no se espera que vivan más de 24 horas",
      "Se ha observado excitación opioide (hiperactividad) hasta 8 horas después de la recuperación anestésica",
      "Depresión respiratoria preexistente",
      "Sustancia controlada: registrar cada uso"
    ]
  },
  {
    slug: "butorfanol",
    descripcion: "Opioide agonista kappa y antagonista mu. Buen antitusígeno y sedante, con analgesia visceral de corta duración.",
    fuente: "FDA/DailyMed — BUTORPHIC (butorfanol tartrato, etiqueta veterinaria)",
    contra: [
      "La etiqueta dice que no se use en caballos de reproducción, destetados ni potros: no hay estudios controlados",
      "Precaución con otros sedantes o analgésicos: los efectos se suman",
      "Analgesia con techo: subir la dosis no aumenta el efecto, solo la sedación",
      "Depresión respiratoria preexistente",
      "No usar en caballos destinados a consumo humano",
      "Sustancia controlada: registrar cada uso"
    ]
  },
  {
    slug: "fentanilo",
    descripcion: "Opioide agonista mu de gran potencia y acción muy corta. Se usa en infusión continua durante la anestesia.",
    fuente: "FDA/DailyMed — FENTANYL CITRATE INJECTION (etiqueta humana, con recuadro de advertencia)",
    contra: [
      "Hipersensibilidad al fentanilo",
      "El recuadro de advertencia señala depresión respiratoria mortal, sobre todo al iniciar o al subir la dosis",
      "Junto a benzodiazepinas u otros depresores del sistema nervioso central: sedación profunda, depresión respiratoria, coma y muerte",
      "Requiere monitorización respiratoria continua y material de intubación a mano",
      "Sustancia controlada: registrar cada uso",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "tramadol",
    descripcion: "Analgésico de acción central: opioide débil que además frena la recaptación de serotonina y noradrenalina.",
    fuente: "FDA/DailyMed — TRAMADOL HYDROCHLORIDE TABLET (etiqueta humana, con recuadro de advertencia)",
    contra: [
      "Depresión respiratoria significativa",
      "Asma bronquial aguda o grave sin monitorización ni equipo de reanimación",
      "Obstrucción gastrointestinal o íleo paralítico",
      "Hipersensibilidad al tramadol o a cualquier opioide",
      "Uso de inhibidores de la MAO en los 14 días previos",
      "Junto a otros serotoninérgicos: riesgo de síndrome serotoninérgico",
      "Antecedente de convulsiones: baja el umbral convulsivo",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },

  /* ---------- Anestesia y sedación ---------- */

  {
    slug: "propofol",
    descripcion: "Inductor anestésico intravenoso de acción y recuperación muy rápidas. No tiene efecto analgésico.",
    fuente: "FDA/DailyMed — PROPOFOL MULTIDOSE (etiqueta veterinaria, Covetrus)",
    contra: [
      "Hipersensibilidad al propofol o a sus componentes",
      "Cualquier situación en la que la anestesia general o la sedación estén contraindicadas",
      "El bolo rápido o la sobredosis producen hipotensión, desaturación y apnea: administrar lento, titulando a efecto",
      "Requiere material de intubación y oxígeno disponibles antes de empezar",
      "Gatos: el uso repetido en días consecutivos se asocia a daño oxidativo del eritrocito",
      "No es analgésico: los procedimientos dolorosos necesitan analgesia aparte"
    ]
  },
  {
    slug: "ketamina",
    descripcion: "Anestésico disociativo. Mantiene los reflejos y el tono muscular, así que casi nunca se usa sola.",
    fuente: "FDA/DailyMed — KETAMINE HYDROCHLORIDE INJECTION (etiqueta veterinaria, Cronus Pharma)",
    contra: [
      "Felinos con insuficiencia renal o hepática: la etiqueta lo declara contraindicación expresa. Se detoxifica en hígado y se excreta por riñón; con la función alterada la anestesia se alarga y se han descrito muertes",
      "En gatos, la etiqueta fija un techo de 50 mg/kg por procedimiento",
      "No usar sola en procedimientos dolorosos: no da relajación muscular ni analgesia visceral suficiente",
      "Cardiomiopatía hipertrófica: aumenta el trabajo cardiaco",
      "Para reducir las reacciones de despertar, el animal no debe ser estimulado durante la recuperación",
      "Sustancia controlada: registrar cada uso"
    ]
  },
  {
    slug: "alfaxalona",
    descripcion: "Neuroesteroide inductor de la anestesia. Margen cardiovascular más amplio que el propofol y recuperación limpia.",
    fuente: "FDA/DailyMed — ALFAXAN MULTIDOSE IDX (alfaxalona, etiqueta veterinaria, Jurox)",
    contra: [
      "Hipersensibilidad conocida a la alfaxalona o a sus componentes",
      "Cualquier situación en la que la anestesia general o la sedación estén contraindicadas",
      "No usar en ninguna especie menor que pueda acabar destinada a consumo humano, ni en animales productores de alimentos",
      "El bolo rápido o la sobredosis producen hipotensión, apnea, hipoxia o muerte; pueden aparecer arritmias secundarias a la apnea",
      "No es analgésico: los procedimientos dolorosos necesitan analgesia aparte",
      "Administrar lento y titulando a efecto, con soporte respiratorio disponible"
    ]
  },
  {
    slug: "isoflurano",
    descripcion: "Anestésico inhalatorio halogenado. Se elimina casi todo por vía respiratoria, lo que hace muy manejable la profundidad.",
    fuente: "FDA/DailyMed — ISOFLURANE LIQUID (etiqueta veterinaria, Parnell)",
    contra: [
      "Sensibilidad conocida al isoflurano o a otros agentes halogenados",
      "La cal sodada DESECADA reacciona con el isoflurano y produce monóxido de carbono, que eleva la carboxihemoglobina del paciente: cambiar el absorbedor si lleva tiempo sin usarse",
      "Es depresor respiratorio y cardiovascular dependiente de dosis: exige monitorización continua",
      "No usar en caballos destinados a consumo humano"
    ]
  },
  {
    slug: "sevoflurano",
    descripcion: "Anestésico inhalatorio halogenado menos irritante que el isoflurano, con inducción y despertar más rápidos.",
    fuente: "FDA/DailyMed — SEVOFLURANE LIQUID (etiqueta veterinaria, Parnell)",
    contra: [
      "Sensibilidad conocida al sevoflurano o a otros agentes halogenados",
      "La etiqueta lo define como depresor respiratorio profundo, con cambios de profundidad rápidos y dependientes de dosis: exige vigilancia continua de la respiración",
      "La cal sodada desecada reacciona con los halogenados y genera monóxido de carbono",
      "No usar en animales destinados a consumo humano salvo lo que autorice la etiqueta"
    ]
  },
  {
    slug: "xilacina",
    descripcion: "Agonista alfa-2 adrenérgico. Sedación, analgesia y relajación muscular; en rumiantes se usa a dosis muy inferiores que en el caballo.",
    fuente: "FDA/DailyMed — XYLAZINE INJECTION (etiqueta veterinaria, Covetrus)",
    contra: [
      "La etiqueta pide considerarlo con mucho cuidado ante depresión respiratoria marcada, cardiopatía grave, hepatopatía o nefropatía avanzada, shock endotóxico o traumático, y situaciones de estrés como calor o frío extremos, altitud o fatiga",
      "No usar junto con otros tranquilizantes",
      "Evitar la inyección intracarotídea: provoca convulsiones violentas inmediatas seguidas de colapso. Asegurar que la aguja está en la yugular",
      "Produce bradicardia y bloqueo auriculoventricular incompleto; la atropina previa reduce mucho su frecuencia",
      "Rumiantes: administrar en ayunas para evitar aspiración de alimento y timpanismo durante la sedación profunda",
      "Bovino: mucho más sensible que el equino. Verificar la dosis y la concentración del frasco antes de cargar",
      "Gestación avanzada en bovino: puede inducir el parto",
      "La analgesia es variable, sobre todo en las extremidades distales del caballo: comprobar la profundidad antes de cortar"
    ]
  },
  {
    slug: "dexmedetomidina",
    descripcion: "Agonista alfa-2 más selectivo que la xilacina. Sedación profunda y previsible en perro y gato, reversible con atipamezol.",
    fuente: "FDA/DailyMed — DEXDOMITOR (dexmedetomidina, etiqueta veterinaria, Zoetis)",
    contra: [
      "Enfermedad cardiovascular",
      "Trastornos respiratorios",
      "Enfermedad hepática o renal",
      "Shock, debilitación grave, o estrés por calor, frío o fatiga extremos",
      "Puede dar respuesta paradójica de excitación, y casos aislados de hipersensibilidad",
      "Puede producir apnea: hay que tener oxígeno a mano y valorar revertir con atipamezol si se acompaña de bradicardia"
    ]
  },
  {
    slug: "acepromacina",
    descripcion: "Fenotiazina tranquilizante. Sedación sin analgesia, con acción antiemética y vasodilatadora periférica.",
    fuente: "FDA/DailyMed — ACEPROMAZINE MALEATE INJECTION (etiqueta veterinaria, Covetrus) · sensibilidad en perros ABCB1-1Δ: Deshpande y col., J Vet Intern Med 2016, doi 10.1111/jvim.13827",
    contra: [
      "Intoxicación por organofosforados: las fenotiazinas potencian su toxicidad. La etiqueta prohíbe usarla para controlar los temblores de esa intoxicación",
      "No usar junto a vermífugos o ectoparasiticidas organofosforados, collares antipulgas incluidos",
      "No usar con clorhidrato de procaína: la acepromazina potencia su actividad",
      "Hipovolemia, shock o deshidratación: produce hipotensión por bloqueo alfa",
      "Antecedente de convulsiones",
      "Perros con la mutación ABCB1-1Δ (MDR1): en un ensayo con 29 collies los homocigotos mutados tuvieron sedación significativamente más profunda y prolongada. Bajar la dosis y vigilar",
      "Sementales equinos: riesgo de prolapso peniano permanente",
      "No tiene efecto analgésico: no sirve sola para nada que duela",
      "No usar en caballos destinados a consumo humano"
    ]
  },
  {
    slug: "midazolam",
    descripcion: "Benzodiazepina hidrosoluble de acción corta. Sedante, relajante muscular y anticonvulsivo; se combina con opioides o ketamina.",
    fuente: "FDA/DailyMed — MIDAZOLAM HYDROCHLORIDE INJECTION (etiqueta humana, con recuadro de advertencia)",
    contra: [
      "Hipersensibilidad al midazolam",
      "Glaucoma de ángulo estrecho agudo: las benzodiazepinas están contraindicadas",
      "El recuadro de advertencia describe depresión respiratoria y paro respiratorio; exige monitorización continua de la función respiratoria y cardiaca, y material de reanimación a mano",
      "Junto a opioides: sedación profunda, depresión respiratoria, coma y muerte",
      "No administrar por vía intratecal ni epidural: el conservante es alcohol bencílico",
      "Sustancia controlada: registrar cada uso",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "diazepam",
    descripcion: "Benzodiazepina liposoluble. Anticonvulsivo de urgencia, relajante muscular y estimulante del apetito en el gato.",
    fuente: "FDA/DailyMed — DIAZEPAM INJECTION (etiqueta humana, con recuadro de advertencia)",
    contra: [
      "Hipersensibilidad al diazepam",
      "Glaucoma de ángulo estrecho agudo; en el de ángulo abierto, solo si ya está tratado",
      "Junto a opioides: sedación profunda, depresión respiratoria, coma y muerte",
      "Gatos: se ha descrito necrosis hepática aguda idiosincrásica con el diazepam oral repetido",
      "La suspensión brusca tras uso prolongado da síndrome de abstinencia",
      "Sustancia controlada: registrar cada uso",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "lidocaina",
    descripcion: "Anestésico local tipo amida, de inicio rápido. También antiarrítmico ventricular por vía intravenosa.",
    fuente: "FDA/DailyMed — LIDOCAINE (etiquetas humanas de anestésico local)",
    contra: [
      "Hipersensibilidad conocida a los anestésicos locales tipo amida",
      "Las dosis máximas son un TOPE, no una cantidad a administrar entera: se infiltra lo que el bloqueo requiera sin superarlo",
      "No usar formulaciones con epinefrina en zonas acras (orejas, cola, extremidades distales, pene): la vasoconstricción puede provocar necrosis",
      "Bloqueo cardiaco de alto grado",
      "La etiqueta describe metahemoglobinemia asociada a anestésicos locales; el gato es especialmente susceptible",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "bupivacaina",
    descripcion: "Anestésico local tipo amida de acción larga. Bloqueos que tienen que durar horas.",
    fuente: "FDA/DailyMed — BUPIVACAINE HCL INJECTION (etiqueta humana)",
    contra: [
      "NUNCA por vía intravenosa: la cardiotoxicidad de la bupivacaína es grave y difícil de revertir. Aspirar siempre antes de inyectar",
      "Hipersensibilidad a la bupivacaína o a cualquier anestésico local tipo amida",
      "La etiqueta la contraindica en bloqueo paracervical obstétrico: se han producido bradicardia fetal y muerte",
      "La concentración al 0,75 % no se usa en anestesia obstétrica",
      "La etiqueta describe metahemoglobinemia asociada a anestésicos locales",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "atropina",
    descripcion: "Antimuscarínico. Sube la frecuencia cardiaca, seca secreciones y es antídoto de los organofosforados.",
    fuente: "FDA/DailyMed — ATROPINE (etiquetas humanas de sulfato de atropina)",
    contra: [
      "Hipersensibilidad a cualquier componente de la formulación",
      "Taquiarritmias: empeora la frecuencia",
      "Glaucoma: la midriasis cierra el ángulo",
      "Íleo paralítico: frena aún más la motilidad",
      "Equinos: la atropina sistémica produce íleo, y en esta especie el íleo es un problema serio",
      "Dato de etiqueta humana: comprobar la etiqueta del producto veterinario registrado"
    ]
  },

  /* ---------- Antiparasitarios ---------- */

  {
    slug: "ivermectina",
    descripcion: "Lactona macrocíclica de amplio espectro. Endectocida: cubre nematodos y ectoparásitos a la vez.",
    fuente: "FDA/DailyMed — IVERMECTIN SHEEP DRENCH (etiqueta veterinaria) · sensibilidad de los perros ABCB1-1Δ: Deshpande y col., J Vet Intern Med 2016, doi 10.1111/jvim.13827",
    contra: [
      "Las presentaciones concentradas de uso ganadero NO son para perros. La etiqueta ovina dice literalmente que el producto no se use en otras especies porque pueden aparecer reacciones adversas graves, INCLUIDA LA MUERTE EN PERROS",
      "Perros con la mutación ABCB1-1Δ (MDR1) — collie, pastor australiano, pastor de Shetland, border collie y cruces: la P-glicoproteína truncada deja pasar la ivermectina al sistema nervioso central. Son susceptibles a la toxicidad por ivermectina, loperamida y vincristina",
      "Cachorros menores de 6 semanas: barrera hematoencefálica inmadura",
      "Descartar microfilaremia antes de desparasitar un animal de zona endémica de dirofilaria: la muerte masiva de microfilarias da reacción anafiláctica",
      "Tortugas y quelonios: la ivermectina les es letal"
    ]
  },
  {
    slug: "doramectina",
    descripcion: "Avermectina de acción muy prolongada para ganado, en inyectable o pour-on.",
    fuente: "FDA/DailyMed — DORAMECTIN POUR-ON (etiqueta veterinaria, Durvet/Bimeda)",
    contra: [
      "La etiqueta dice que el pour-on se desarrolló SOLO para bovinos y que no debe usarse en otras especies, porque pueden aparecer reacciones adversas graves, incluida la muerte en perros",
      "El pour-on se aplica solo sobre la piel: no administrar por vía oral ni parenteral",
      "No aplicar sobre piel cubierta de barro o estiércol: no se absorbe bien",
      "No usar en vacas de aptitud lechera en lactancia",
      "Es inflamable: mantener lejos del calor y de las llamas"
    ]
  },
  {
    slug: "selamectina",
    descripcion: "Avermectina de aplicación tópica (spot-on) para perro y gato. Pulgas, ácaros de oído, sarna y prevención de dirofilaria.",
    fuente: "FDA/DailyMed — SELAMECTIN SOLUTION (etiqueta veterinaria)",
    contra: [
      "La etiqueta exige descartar dirofilariosis ANTES de empezar la prevención: la selamectina no mata el adulto ni limpia las microfilarias",
      "No aplicar sobre piel lesionada ni sobre pelaje mojado: la absorción cambia",
      "Cachorros y gatitos por debajo de la edad que indique el envase"
    ]
  },
  {
    slug: "fenbendazol",
    descripcion: "Benzimidazol de amplio margen de seguridad. Nematodos gastrointestinales y pulmonares, y giardia en pautas de varios días.",
    fuente: "FDA/DailyMed — FENBENDAZOLE SUSPENSION (etiqueta veterinaria)",
    contra: [
      "La etiqueta consultada no declara contraindicaciones clínicas: el margen de seguridad del fenbendazol es amplio",
      "La etiqueta sí advierte de la resistencia parasitaria: antes de desparasitar conviene un coprológico y conocer el historial del hato o rebaño",
      "Hipersensibilidad conocida a los benzimidazoles"
    ]
  },
  {
    slug: "albendazol",
    descripcion: "Benzimidazol con actividad además frente a cestodos y a la fasciola adulta. Muy usado en rumiantes.",
    fuente: "FDA/DailyMed — VALBAZEN (albendazol, etiqueta veterinaria, Zoetis)",
    contra: [
      "Vacas: no administrar durante los primeros 45 días de gestación ni durante los 45 días siguientes a retirar los toros. Es teratogénico",
      "Ovejas y cabras: no administrar durante los primeros 30 días de gestación ni durante los 30 días siguientes a retirar los machos",
      "No usar en hembras de aptitud lechera en lactancia",
      "Hipersensibilidad conocida a los benzimidazoles"
    ]
  },
  {
    slug: "praziquantel",
    descripcion: "Cestodicida. Actúa sobre tenias y otros platelmintos, incluidas las formas del hígado.",
    fuente: "FDA/DailyMed — PRAZIQUANTEL SUSPENSION (etiqueta veterinaria)",
    contra: [
      "No usar por debajo de la edad mínima que indique el envase (en varias presentaciones, 4 semanas)",
      "Dosificar por peso: la etiqueta prohíbe superar la dosis recomendada",
      "Pueden aparecer heces blandas o letargo pasajero; si hay vómito o diarrea persistente, suspender"
    ]
  },
  {
    slug: "pirantel",
    descripcion: "Tetrahidropirimidina de acción local en el intestino: casi no se absorbe. De los antiparasitarios más seguros en cachorros.",
    fuente: "FDA/DailyMed — etiquetas veterinarias de pamoato de pirantel (incl. combinaciones)",
    contra: [
      "Las etiquetas consultadas no declaran contraindicaciones clínicas: apenas se absorbe desde el intestino",
      "No mata las larvas migratorias: hay que repetir a las 2-3 semanas para cubrir las formas que van llegando al intestino",
      "Hipersensibilidad conocida al pirantel"
    ]
  },
  {
    slug: "afoxolaner",
    descripcion: "Isoxazolina oral masticable. Pulgas y garrapatas con un mes de cobertura.",
    fuente: "FDA/DailyMed — NEXGARD COMBO (esafoxolaner, etiqueta veterinaria, Boehringer Ingelheim)",
    contra: [
      "La etiqueta no declara contraindicaciones absolutas, pero sí una advertencia de clase: las isoxazolinas se han asociado a reacciones neurológicas — temblores, ataxia y convulsiones",
      "Perros con antecedente de convulsiones: usar con precaución, la advertencia de clase aplica",
      "No usar por debajo del peso ni de la edad mínimos del envase"
    ]
  },
  {
    slug: "fluralaner",
    descripcion: "Isoxazolina de acción muy larga: una toma cubre semanas o meses según la presentación.",
    fuente: "FDA/DailyMed — BRAVECTO (fluralaner, etiqueta veterinaria, MSD)",
    contra: [
      "La etiqueta dice que no hay contraindicaciones conocidas, pero mantiene la advertencia de clase de las isoxazolinas: temblores, ataxia y convulsiones, incluidas convulsiones en perros sin antecedente previo",
      "Perros con antecedente de convulsiones: usar con precaución",
      "Administrar con comida: la absorción depende de ello",
      "No usar por debajo del peso ni de la edad mínimos del envase"
    ]
  },
  {
    slug: "toltrazuril",
    descripcion: "Triazinona anticoccidial. Actúa sobre todas las fases intracelulares de la eimeria, así que una sola dosis suele bastar.",
    fuente: "FDA/DailyMed — TOLTRAMAX 5% SUSPENSION (etiqueta veterinaria). Nota: la etiqueta consultada NO incluye apartado de contraindicaciones",
    contra: [
      "La etiqueta consultada no declara contraindicaciones. Antes de usarlo conviene revisar el prospecto del producto registrado en Ecuador",
      "Es un producto metafiláctico: se administra ANTES del pico de excreción esperado. Dado tarde, con la diarrea ya instalada, hace poco",
      "Hipersensibilidad conocida al toltrazuril"
    ]
  },
  {
    slug: "amprolio",
    descripcion: "Anticoccidial que funciona como análogo de la tiamina: los coccidios lo captan creyendo que es vitamina B1.",
    fuente: "FDA/DailyMed — CORID (amprolio, etiqueta veterinaria, Huvepharma). Nota: la etiqueta consultada solo trae advertencias de seguridad del manipulador",
    contra: [
      "Solo para uso ORAL en animales",
      "Su mecanismo es antagonizar la tiamina: en tratamientos prolongados o a dosis altas puede provocar deficiencia de vitamina B1 y polioencefalomalacia. Vigilar signos nerviosos y suplementar tiamina si aparecen",
      "Puede irritar los ojos del manipulador: lavar con agua abundante si hay contacto"
    ]
  },

  /* ---------- Corticoides ---------- */

  {
    slug: "dexametasona",
    descripcion: "Glucocorticoide potente y de acción larga, sin apenas efecto mineralocorticoide. Antiinflamatorio e inmunosupresor.",
    fuente: "FDA/DailyMed — DEXIUM (dexametasona inyectable, etiqueta veterinaria, Bimeda; NADA pionero Azium 12-559)",
    contra: [
      "Infección viral en fase virémica: contraindicada",
      "Nefritis crónica e hipercorticismo (síndrome de Cushing): contraindicada salvo terapia de urgencia",
      "Insuficiencia cardiaca congestiva, diabetes y osteoporosis son contraindicaciones relativas",
      "Último tercio de la gestación: los corticoides inducen la primera fase del parto y pueden precipitar parto prematuro con distocia, muerte fetal, retención de placenta y metritis",
      "Gestación en perras, conejas y roedoras: se ha producido paladar hendido, y en perras también deformidad de los miembros anteriores, focomelia y anasarca",
      "Equinos: la etiqueta señala que los corticoides provocan laminitis",
      "Enmascara los signos de infección: si hay infección bacteriana debe estar controlada con antibiótico",
      "No usar en terneros destinados a producción de ternera blanca: no hay tiempo de retiro establecido",
      "No suspender de golpe tras uso prolongado: la insuficiencia adrenal secundaria puede durar meses"
    ]
  },
  {
    slug: "prednisolona",
    descripcion: "Glucocorticoide de potencia intermedia y acción corta. El corticoide de fondo para tratamientos prolongados a días alternos.",
    fuente: "FDA/DailyMed — PREDNISONE TABLET (etiqueta humana) y DEXIUM (etiqueta veterinaria de corticoide inyectable) para los efectos de clase",
    contra: [
      "Infección fúngica sistémica",
      "Hipersensibilidad conocida a corticoides",
      "Infección bacteriana sistémica sin cobertura antibiótica: enmascara los signos y favorece la diseminación",
      "Úlcera gastrointestinal",
      "Diabetes mellitus: eleva la glucemia y descompensa el control",
      "Gestación: efectos de clase descritos en perras, conejas y roedoras (paladar hendido) y parto prematuro en el último tercio",
      "No combinar con AINE: se suma el daño de la mucosa digestiva",
      "No suspender de golpe tras uso prolongado: hay que bajar la dosis de forma gradual",
      "Dato de etiqueta humana en la molécula, complementado con la etiqueta veterinaria de clase"
    ]
  },

  /* ---------- Diuréticos, fluidos y electrolitos ---------- */

  {
    slug: "furosemida",
    descripcion: "Diurético de asa, el más potente de uso corriente. Primera línea en el edema pulmonar cardiogénico.",
    fuente: "FDA/DailyMed — FUROSEMIDE TABLET (etiqueta veterinaria, Covetrus)",
    contra: [
      "Anuria: contraindicación expresa de la etiqueta",
      "Deshidratación o desequilibrio electrolítico no corregidos: la etiqueta pide corregirlos antes de empezar",
      "Coma hepático: en cirrosis, un cambio brusco de fluidos y electrolitos puede precipitarlo. No iniciar hasta corregir el cuadro de base",
      "Enfermedad renal progresiva: suspender si durante el tratamiento aumentan la azotemia y la oliguria",
      "Vigilar el potasio: puede hacer falta suplementarlo",
      "Puede bajar el calcio sérico y provocar tetania en animales con tendencia a la hipocalcemia",
      "Gatos: se ha producido pérdida transitoria de audición tras inyección intravenosa rápida de dosis excesivas",
      "Puede descompensar una diabetes latente o activa",
      "Corregir el balance electrolítico antes de una cirugía en un animal que la está recibiendo"
    ]
  },
  {
    slug: "gluconato-calcio",
    descripcion: "Sal de calcio inyectable. Tratamiento de la hipocalcemia aguda: eclampsia, fiebre de leche, tetania.",
    fuente: "FDA/DailyMed — CALCIUM GLUCONATE INJECTION (etiqueta humana)",
    contra: [
      "Hipercalcemia",
      "Administrar SIEMPRE lento y con auscultación o electrocardiograma: la inyección rápida provoca bradicardia y arritmias graves",
      "La etiqueta lo contraindica junto a ceftriaxona en neonatos por precipitación de sales de calcio",
      "Extravasación: el calcio produce necrosis del tejido perivascular",
      "Precaución con digoxina: el calcio potencia sus efectos cardiacos",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta salvo producto registrado"
    ]
  },
  {
    slug: "cloruro-potasio",
    descripcion: "Sal de potasio para corregir hipopotasemia. Se añade a los fluidos, nunca se pasa en bolo.",
    fuente: "FDA/DailyMed — POTASSIUM CHLORIDE (etiqueta humana)",
    contra: [
      "NUNCA en bolo intravenoso ni sin diluir: el potasio directo produce parada cardiaca. Va siempre diluido en el fluido y con velocidad limitada",
      "Hiperpotasemia",
      "Anuria u oliguria: sin diuresis el potasio se acumula",
      "La etiqueta lo contraindica junto a diuréticos ahorradores de potasio (triamtereno, amilorida); lo mismo vale para espironolactona e IECA",
      "Enfermedad de Addison no tratada",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "bicarbonato-sodio",
    descripcion: "Alcalinizante. Para acidosis metabólica grave documentada y para la hiperpotasemia con alteración del electrocardiograma.",
    fuente: "FDA/DailyMed — SODIUM BICARBONATE INJECTION (etiqueta humana)",
    contra: [
      "Alcalosis metabólica o respiratoria",
      "Pérdida de cloro por vómito o aspiración digestiva continua: contraindicación expresa de la etiqueta",
      "Junto a diuréticos que producen alcalosis hipoclorémica",
      "Insuficiencia cardiaca congestiva, insuficiencia renal grave y estados edematosos con retención de sodio: la carga de sodio es alta",
      "Hipocalcemia: alcalinizar baja el calcio ionizado y puede desencadenar tetania",
      "No mezclar en la misma vía con soluciones de calcio: precipita",
      "Sin gasometría es a ciegas: corregir a ojo una acidosis puede producir alcalosis yatrogénica",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "dextrosa",
    descripcion: "Glucosa en solución. Aporte energético y tratamiento de la hipoglucemia; las concentraciones altas hay que diluirlas.",
    fuente: "FDA/DailyMed — DEXTROSE INJECTION 50% (etiqueta humana)",
    contra: [
      "Hemorragia intracraneal o intramedular: la etiqueta la contraindica, la dextrosa al 50 % empeora el edema cerebral por desplazamiento de líquido",
      "Deshidratación grave: agrava el estado hiperosmolar",
      "Hipersensibilidad conocida a la dextrosa",
      "La solución al 50 % es muy hipertónica: nunca por vía subcutánea ni por vena periférica sin diluir, produce flebitis y necrosis",
      "Deficiencia de tiamina: la carga de glucosa puede precipitar una encefalopatía. Suplementar B1 antes en animales anoréxicos o con antecedente de ayuno prolongado",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },

  /* ---------- Diuréticos ---------- */

  {
    slug: "espironolactona",
    descripcion: "Diurético ahorrador de potasio que bloquea la aldosterona. Diurético flojo, pero frena el remodelado cardiaco; se usa asociado a furosemida.",
    fuente: "EMA — Spironolactone Ceva, ficha técnica veterinaria canina, sección 4.3 · FDA/DailyMed — SPIRONOLACTONE TABLET (etiqueta humana)",
    contra: [
      "Hipoadrenocorticismo (enfermedad de Addison): la ficha técnica veterinaria la contraindica expresamente",
      "Hiperpotasemia",
      "Hiponatremia",
      "Junto a AINE en perros con insuficiencia renal: contraindicación expresa de la ficha técnica",
      "Gestación y lactancia",
      "Animales destinados a reproducción",
      "Controlar la función renal y el potasio antes de combinarla con un IECA"
    ]
  },
  {
    slug: "hidroclorotiazida",
    descripcion: "Diurético tiazídico de potencia intermedia. Además reduce la excreción urinaria de calcio, útil en urolitiasis por oxalato.",
    fuente: "FDA/DailyMed — HYDROCHLOROTHIAZIDE CAPSULE (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Anuria: contraindicación expresa de la etiqueta",
      "Hipersensibilidad a este producto o a otros derivados de sulfonamida",
      "Deshidratación o desequilibrio electrolítico no corregidos",
      "Diabetes mellitus: puede desenmascararla o descompensarla",
      "Insuficiencia renal: la tiazida se acumula",
      "Vigilar el potasio, sobre todo si el animal lleva digoxina",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "torasemida",
    descripcion: "Diurético de asa más potente y más duradero que la furosemida, con una sola toma al día en insuficiencia cardiaca.",
    fuente: "FDA/DailyMed — TORSEMIDE TABLET (etiqueta humana). No se pudo recuperar la ficha técnica veterinaria europea (Upcard): comprobar el prospecto del producto registrado",
    contra: [
      "Anuria: contraindicación expresa de la etiqueta",
      "Coma hepático: contraindicación expresa de la etiqueta",
      "Hipersensibilidad a la torasemida o a la povidona",
      "Deshidratación o desequilibrio electrolítico no corregidos: es más potente que la furosemida, la depleción llega antes",
      "Vigilar potasio y función renal: la diuresis excesiva precipita azotemia prerrenal",
      "Dato de etiqueta humana: la ficha técnica veterinaria no pudo consultarse"
    ]
  },
  {
    slug: "manitol",
    descripcion: "Diurético osmótico. Se usa para bajar la presión intracraneal y la intraocular; no se metaboliza, se filtra tal cual.",
    fuente: "FDA/DailyMed — MANNITOL INJECTION (etiqueta humana)",
    contra: [
      "Anuria establecida por enfermedad renal grave",
      "Congestión pulmonar grave o edema pulmonar franco: expande el volumen circulante y lo empeora",
      "Hemorragia intracraneal activa, salvo durante la craneotomía",
      "Deshidratación grave",
      "Daño renal progresivo tras iniciar el manitol, con oliguria y azotemia crecientes: suspender",
      "Insuficiencia cardiaca o congestión pulmonar que progresan tras iniciarlo: suspender",
      "Vigilar sodio y potasio durante todo el tratamiento",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },

  /* ---------- Digestivos y antieméticos ---------- */

  {
    slug: "maropitant",
    descripcion: "Antiemético antagonista del receptor NK-1. Bloquea la sustancia P y corta el vómito de casi cualquier origen, incluido el del transporte.",
    fuente: "FDA/DailyMed — EMEPREV (maropitant citrato, etiqueta veterinaria canina, Dechra)",
    contra: [
      "Cachorros menores de 11 semanas: se observó hipocelularidad de la médula ósea con más frecuencia y más gravedad que en los controles. A partir de las 16 semanas no apareció",
      "Disfunción hepática: usar con precaución, se metaboliza por CYP3A",
      "Obstrucción gastrointestinal o ingestión de tóxicos: la etiqueta dice que no está evaluado. Cortar el vómito ahí puede tapar el cuadro",
      "No está evaluado en reproductores, perras gestantes ni lactantes",
      "Precaución junto a otros fármacos muy unidos a proteínas plasmáticas: AINE, cardiológicos, anticonvulsivos y de conducta",
      "Produce descenso del apetito y del peso dependiente de la dosis; hay que buscar y tratar la causa del vómito, no solo taparlo"
    ]
  },
  {
    slug: "ondansetron",
    descripcion: "Antiemético antagonista 5-HT3. Muy eficaz en el vómito de origen quimioterápico o por irritación digestiva intensa.",
    fuente: "FDA/DailyMed — ONDANSETRON TABLET (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad conocida al ondansetrón",
      "Junto a apomorfina: contraindicación expresa de la etiqueta, se han descrito hipotensión profunda y pérdida de conciencia",
      "Alarga el intervalo QT; se han notificado casos de torsade de pointes. Precaución si el animal lleva otros fármacos que alargan el QT",
      "Reactividad cruzada con otros antagonistas 5-HT3",
      "Insuficiencia hepática: se metaboliza en hígado",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "metoclopramida",
    descripcion: "Procinético y antiemético central. Acelera el vaciado gástrico y cierra el cardias; útil en reflujo e íleo funcional.",
    fuente: "FDA/DailyMed — METOCLOPRAMIDE TABLET (etiqueta humana, con recuadro de advertencia)",
    contra: [
      "Obstrucción mecánica, perforación o hemorragia gastrointestinal: contraindicación expresa. Empujar contra una obstrucción puede romper el intestino",
      "Epilepsia o antecedente de convulsiones: la etiqueta señala que aumenta la frecuencia y la gravedad de las crisis",
      "Feocromocitoma o paraganglioma: puede desencadenar una crisis hipertensiva",
      "Antecedente de discinesia tardía o de reacción distónica a la metoclopramida",
      "Hipersensibilidad a la metoclopramida",
      "El recuadro de advertencia describe discinesia tardía, un trastorno del movimiento potencialmente irreversible cuyo riesgo crece con la duración y la dosis acumulada: usar el menor tiempo posible",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "omeprazol",
    descripcion: "Inhibidor de la bomba de protones. Corta la secreción ácida de forma prolongada; en el caballo es el tratamiento del síndrome de úlcera gástrica.",
    fuente: "FDA/DailyMed — GASTROGARD (omeprazol pasta, etiqueta veterinaria equina, Boehringer Ingelheim) y etiquetas humanas de omeprazol",
    contra: [
      "No está determinada la seguridad en yeguas gestantes ni en lactancia: contraindicación de la etiqueta equina",
      "Hipersensibilidad al omeprazol o a otros benzimidazoles sustituidos",
      "No usar en caballos destinados a consumo humano",
      "El uso prolongado sube la gastrina y, al suspenderlo de golpe, hay rebote ácido: bajar la dosis progresivamente",
      "En perro y gato el uso es fuera de etiqueta: la etiqueta veterinaria disponible es equina"
    ]
  },
  {
    slug: "pantoprazol",
    descripcion: "Inhibidor de la bomba de protones inyectable. La opción cuando el animal vomita y no puede recibir nada por boca.",
    fuente: "FDA/DailyMed — PANTOPRAZOLE SODIUM INJECTION (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad al pantoprazol o a cualquier benzimidazol sustituido. Las reacciones descritas incluyen anafilaxia, shock anafiláctico, angioedema, broncoespasmo, nefritis tubulointersticial aguda y urticaria",
      "Reactividad cruzada con omeprazol y demás inhibidores de la bomba de protones",
      "El uso prolongado da rebote ácido al suspenderlo de golpe",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "famotidina",
    descripcion: "Antagonista H2. Reduce la secreción ácida menos que un inhibidor de bomba, pero actúa antes.",
    fuente: "FDA/DailyMed — FAMOTIDINE TABLET (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Antecedente de reacción de hipersensibilidad grave, anafilaxia incluida, a la famotidina o a otro antagonista H2",
      "Insuficiencia renal: se elimina por riñón, hay que espaciar las tomas",
      "El efecto se pierde con el uso continuado por tolerancia del receptor",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "sucralfato",
    descripcion: "Protector de la mucosa. En medio ácido forma una pasta que se pega a la úlcera y la cubre; no se absorbe.",
    fuente: "FDA/DailyMed — SUCRALFATE TABLET (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad al sucralfato o a cualquier excipiente",
      "Impide la absorción de otros fármacos dados a la vez: separar al menos dos horas de antibióticos, digoxina y levotiroxina",
      "Necesita medio ácido para activarse: si se da junto a un inhibidor de bomba a la misma hora, pierde efecto",
      "Insuficiencia renal: contiene aluminio, que se acumula",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "butilescopolamina",
    descripcion: "Espasmolítico anticolinérgico que no cruza la barrera hematoencefálica. Referencia en el cólico espasmódico del caballo.",
    fuente: "FDA/DailyMed — BUSCOPAN (N-butilescopolamonio bromuro, etiqueta veterinaria equina, Boehringer Ingelheim)",
    contra: [
      "Cólico por impactación asociado a íleo: contraindicación expresa de la etiqueta. Paralizar más un intestino ya parado empeora el cuadro",
      "Glaucoma: contraindicación expresa de la etiqueta",
      "No recomendado en potros lactantes ni en yeguas gestantes o en lactancia: no está establecida la seguridad",
      "Sus efectos se potencian con otros anticolinérgicos, la atropina entre ellos",
      "Produce taquicardia pasajera que enmascara la frecuencia cardiaca como signo de dolor: no fiarse de ella durante unas horas",
      "No usar en caballos destinados a consumo humano"
    ]
  },
  {
    slug: "silimarina",
    descripcion: "Extracto de cardo mariano usado como hepatoprotector. Antioxidante y estabilizador de la membrana del hepatocito.",
    fuente: "Sin etiqueta de producto registrado localizada en FDA/DailyMed ni en EMA: se comercializa como suplemento, no como medicamento",
    contra: [
      "SIN FUENTE REGLAMENTARIA. No se localizó ninguna etiqueta de medicamento veterinario ni humano para la silimarina: se vende como suplemento y por eso no tiene apartado de contraindicaciones aprobado",
      "Sin etiqueta no hay dosis máxima, ni datos de gestación, ni interacciones evaluadas: conviene tratarlo como un producto sin respaldo regulatorio",
      "Antes de usarlo, revisar el prospecto de la marca concreta que se tenga en la mano"
    ]
  },
  {
    slug: "sam-e",
    descripcion: "S-adenosilmetionina, precursor del glutatión. Se usa como hepatoprotector y en el deterioro cognitivo del animal mayor.",
    fuente: "Sin etiqueta de producto registrado localizada en FDA/DailyMed ni en EMA: se comercializa como suplemento (nutracéutico)",
    contra: [
      "SIN FUENTE REGLAMENTARIA. No se localizó etiqueta de medicamento para la S-adenosilmetionina: es un nutracéutico y no tiene contraindicaciones aprobadas",
      "En medicina humana se desaconseja combinar la SAM-e con fármacos serotoninérgicos por riesgo teórico de síndrome serotoninérgico; sin etiqueta veterinaria eso no está evaluado en animales",
      "Antes de usarlo, revisar el prospecto de la marca concreta"
    ]
  },
  {
    slug: "lactulosa",
    descripcion: "Disacárido no absorbible. Laxante osmótico y, sobre todo, atrapa el amoniaco en el colon: es la base del tratamiento de la encefalopatía hepática.",
    fuente: "FDA/DailyMed — LACTULOSE SOLUTION (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Animales que requieran dieta baja en galactosa: la etiqueta la contraindica, la solución contiene galactosa",
      "Precaución en diabéticos: contiene galactosa y lactosa",
      "Obstrucción intestinal",
      "La dosis se ajusta por el resultado, no por el peso: el objetivo son dos o tres heces blandas al día. Pasarse produce diarrea, deshidratación e hipernatremia",
      "La etiqueta advierte de un riesgo teórico de explosión si se hace electrocauterio durante una endoscopia en un paciente tratado, por acumulación de hidrógeno",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "caolin-pectina",
    descripcion: "Adsorbente intestinal. Da consistencia a las heces sin actuar sobre la causa de la diarrea.",
    fuente: "FDA/DailyMed — KAOLIN PECTIN SUSPENSION (etiqueta veterinaria, Durvet). Nota: la etiqueta solo trae una advertencia general",
    contra: [
      "La etiqueta consultada no declara contraindicaciones clínicas: solo advierte que si la diarrea persiste hay que consultar al veterinario",
      "No trata la causa: usarlo solo mientras se busca el diagnóstico, no como tratamiento",
      "Adsorbe también los fármacos administrados por boca: separar al menos dos horas de cualquier otra medicación oral",
      "Agitar bien antes de usar; proteger de la congelación"
    ]
  },
  {
    slug: "probiotico-enterococcus",
    descripcion: "Probiótico con Enterococcus faecium. Repuebla la flora intestinal tras una diarrea o un tratamiento antibiótico.",
    fuente: "Sin etiqueta de medicamento localizada en FDA/DailyMed ni en EMA: los probióticos se registran como alimento complementario, no como medicamento",
    contra: [
      "SIN FUENTE REGLAMENTARIA. No se localizó etiqueta de medicamento: los probióticos se comercializan como alimento complementario y no llevan apartado de contraindicaciones aprobado",
      "Precaución en animales inmunodeprimidos: administrar bacterias vivas a un paciente sin defensas no está evaluado",
      "El antibiótico dado a la misma hora mata el probiótico: separarlos varias horas",
      "Antes de usarlo, revisar el prospecto de la marca concreta"
    ]
  },

  /* ---------- Cardiovasculares ---------- */

  {
    slug: "pimobendan",
    descripcion: "Inodilatador: sensibiliza el miocardio al calcio y dilata arterias y venas. Mejora la contracción sin gastar más oxígeno.",
    fuente: "FDA/DailyMed — PIMOBENDAN CHEWABLE TABLETS (etiqueta veterinaria canina)",
    contra: [
      "Cardiomiopatía hipertrófica: contraindicación expresa. Aumentar el gasto de un ventrículo que no se llena empeora la obstrucción",
      "Estenosis aórtica",
      "Cualquier situación en la que aumentar el gasto cardiaco no convenga por razones funcionales o anatómicas",
      "La etiqueta lo limita a perros con signos clínicos de insuficiencia cardiaca congestiva; no está establecida la seguridad en cardiopatía asintomática",
      "No está evaluado en perros menores de 6 meses, con defectos congénitos, con diabetes u otra enfermedad metabólica grave, ni en reproductores"
    ]
  },
  {
    slug: "benazepril",
    descripcion: "Inhibidor de la enzima convertidora de angiotensina. Baja la poscarga y frena el remodelado; también reduce la proteinuria.",
    fuente: "FDA/DailyMed — BENAZEPRIL HYDROCHLORIDE TABLET (etiqueta humana, con recuadro de advertencia). La ficha técnica veterinaria europea no pudo recuperarse",
    contra: [
      "El recuadro de advertencia es de toxicidad fetal: los fármacos que actúan sobre el sistema renina-angiotensina pueden lesionar y matar al feto. Suspender en cuanto se detecte la gestación",
      "Hipersensibilidad al benazepril o a cualquier otro IECA",
      "Antecedente de angioedema",
      "Deshidratación o hipovolemia: el IECA quita el mecanismo que sostiene la filtración glomerular y precipita azotemia",
      "Estenosis arterial renal bilateral",
      "Vigilar la creatinina y el potasio al iniciar y al subir la dosis, sobre todo si el animal lleva diurético",
      "Dato de etiqueta humana: la ficha técnica veterinaria no pudo consultarse"
    ]
  },
  {
    slug: "enalapril",
    descripcion: "IECA de eliminación mayoritariamente renal, a diferencia del benazepril, que también se elimina por bilis.",
    fuente: "FDA/DailyMed — ENALAPRIL MALEATE TABLET (etiqueta humana, con recuadro de advertencia)",
    contra: [
      "Recuadro de advertencia de toxicidad fetal: suspender en cuanto se detecte la gestación",
      "Hipersensibilidad al enalapril o antecedente de angioedema con un IECA",
      "Deshidratación o hipovolemia",
      "Insuficiencia renal: se elimina sobre todo por riñón, hay que ajustar la dosis; en ese caso el benazepril suele ser mejor opción",
      "Estenosis arterial renal bilateral",
      "Vigilar creatinina y potasio al iniciar y al subir la dosis",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "digoxina",
    descripcion: "Digitálico. Aumenta la contractilidad y frena la conducción por el nodo auriculoventricular; se usa sobre todo para controlar la fibrilación auricular.",
    fuente: "FDA/DailyMed — DIGOXIN TABLET (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Fibrilación ventricular: contraindicación expresa de la etiqueta",
      "Hipersensibilidad a la digoxina o a cualquier digitálico",
      "Margen terapéutico estrechísimo: la dosis tóxica está pegada a la eficaz. Sin digoxinemia se va a ciegas",
      "Hipopotasemia: multiplica la toxicidad. Si el animal lleva furosemida, corregir el potasio antes",
      "Insuficiencia renal: se elimina por riñón y se acumula",
      "Bloqueo auriculoventricular de segundo o tercer grado, y síndrome del seno enfermo",
      "Cardiomiopatía hipertrófica obstructiva",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "diltiazem",
    descripcion: "Bloqueante de canales de calcio con efecto sobre el nodo AV. Frena la frecuencia en taquiarritmias supraventriculares y relaja el miocardio hipertrófico.",
    fuente: "FDA/DailyMed — DILTIAZEM HYDROCHLORIDE INJECTION (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Síndrome del seno enfermo sin marcapasos",
      "Bloqueo auriculoventricular de segundo o tercer grado sin marcapasos",
      "Hipotensión grave o shock cardiogénico",
      "Taquicardia ventricular: dar un bloqueante de calcio ante una taquicardia de complejo ancho ha producido deterioro hemodinámico y fibrilación ventricular. Hay que distinguir el origen antes",
      "Fibrilación o flutter auricular con vía accesoria: puede desencadenar una aceleración del ritmo que ponga en riesgo la vida",
      "No administrar por vía intravenosa junto a betabloqueantes ni con pocas horas de diferencia",
      "Hipersensibilidad al diltiazem",
      "Insuficiencia hepática o renal: se metaboliza en hígado y se elimina por riñón y bilis",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "amlodipino",
    descripcion: "Bloqueante de calcio de acción vascular. Es el antihipertensivo de elección en el gato con hipertensión sistémica.",
    fuente: "FDA/DailyMed — AMLODIPINE BESYLATE TABLET (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad conocida al amlodipino",
      "Hipotensión o hipovolemia: es un vasodilatador, baja más la presión",
      "En el gato con enfermedad renal, bajar la presión demasiado rápido reduce la perfusión renal: controlar la presión tras iniciar",
      "Insuficiencia hepática: se metaboliza en hígado",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "atenolol",
    descripcion: "Betabloqueante cardioselectivo. Baja la frecuencia y la contractilidad; se usa en cardiomiopatía hipertrófica y en taquiarritmias.",
    fuente: "FDA/DailyMed — ATENOLOL TABLET (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Bradicardia sinusal",
      "Bloqueo cardiaco de grado mayor que el primero",
      "Shock cardiogénico",
      "Insuficiencia cardiaca manifiesta: el bloqueo beta deprime aún más la contractilidad y puede precipitar un fallo más grave",
      "Hipersensibilidad al atenolol",
      "No suspender de golpe: la retirada brusca de un betabloqueante puede desencadenar arritmias e isquemia",
      "Broncoespasmo: aunque es cardioselectivo, la selectividad se pierde al subir la dosis",
      "Insuficiencia renal: se elimina por riñón",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "sotalol",
    descripcion: "Antiarrítmico de clase III con efecto betabloqueante. Se usa en taquiarritmias ventriculares.",
    fuente: "FDA/DailyMed — SOTALOL HYDROCHLORIDE TABLET (etiqueta humana, con recuadro de advertencia)",
    contra: [
      "El recuadro de advertencia es de proarritmia mortal: el sotalol puede causar taquicardia ventricular asociada a alargamiento del QT. Se inicia bajo monitorización electrocardiográfica continua",
      "Bradicardia sinusal, síndrome del seno enfermo, bloqueo auriculoventricular de segundo o tercer grado sin marcapasos",
      "Síndrome de QT largo congénito o adquirido",
      "Shock cardiogénico o insuficiencia cardiaca descompensada",
      "Potasio sérico por debajo de 4 mEq/L: contraindicación expresa de la etiqueta",
      "Asma bronquial o cuadros broncoespásticos",
      "Hipersensibilidad al sotalol",
      "Insuficiencia renal: la etiqueta ajusta el intervalo según el aclaramiento de creatinina",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "dobutamina",
    descripcion: "Inotrópico beta-1. Aumenta la contractilidad con poca subida de la frecuencia; se usa en infusión continua en shock cardiogénico.",
    fuente: "FDA/DailyMed — DOBUTAMINE IN DEXTROSE INJECTION (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Estenosis subaórtica hipertrófica idiopática: contraindicación expresa de la etiqueta",
      "Hipersensibilidad a la dobutamina o a cualquiera de sus componentes",
      "Hipovolemia no corregida: primero se llena el tanque, luego se aprieta el corazón",
      "Exige monitorización continua de electrocardiograma y presión arterial",
      "Puede producir subidas marcadas de frecuencia cardiaca y de presión sistólica",
      "Solo en infusión continua con bomba: nunca en bolo",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "dopamina",
    descripcion: "Catecolamina de efecto dependiente de la dosis: a dosis bajas dilata, a medias es inotrópica y a altas es vasopresora.",
    fuente: "FDA/DailyMed — DOPAMINE HYDROCHLORIDE INJECTION (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Feocromocitoma: contraindicación expresa de la etiqueta",
      "Hipovolemia no corregida: vasoconstreñir un tanque vacío empeora la perfusión",
      "Taquiarritmias ventriculares",
      "Extravasación: produce vasoconstricción local intensa y necrosis del tejido. Vía central si se puede",
      "Solo en infusión continua con bomba, nunca en bolo",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "epinefrina",
    descripcion: "Adrenalina. Agonista alfa y beta: el fármaco de la parada cardiorrespiratoria y de la anafilaxia.",
    fuente: "FDA/DailyMed — ADRENALIN (epinefrina inyectable, etiqueta humana). Su apartado 4 CONTRAINDICATIONS dice literalmente «None»",
    contra: [
      "La etiqueta NO declara ninguna contraindicación: en una urgencia vital no hay motivo que impida usarla",
      "Los anestésicos halogenados sensibilizan el miocardio a las catecolaminas: bajo anestesia inhalatoria puede producir taquicardia o fibrilación ventricular",
      "No usar formulaciones con epinefrina para anestesia local en zonas acras (orejas, cola, extremidades distales, pene): necrosis por vasoconstricción",
      "Cuidado con la concentración: la mayoría de los errores graves son de dilución, no de indicación",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "norepinefrina",
    descripcion: "Noradrenalina. Vasopresor alfa potente; primera línea en el shock séptico que no responde a fluidos.",
    fuente: "FDA/DailyMed — LEVOPHED (norepinefrina bitartrato, etiqueta humana)",
    contra: [
      "Hipotensión por déficit de volumen: la etiqueta la contraindica salvo como medida de urgencia mientras se repone el volumen. Mantener la presión con norepinefrina sin reponer volumen produce vasoconstricción visceral grave, caída de la perfusión y de la diuresis, hipoxia tisular y acidosis láctica",
      "Trombosis vascular mesentérica o periférica: extiende la zona de infarto",
      "Anestesia con ciclopropano o halotano: la etiqueta lo considera contraindicado por riesgo de taquicardia o fibrilación ventricular",
      "Hipoxia o hipercapnia profundas: mismo tipo de arritmias",
      "Precaución con inhibidores de la MAO y antidepresivos tricíclicos: hipertensión grave y prolongada",
      "Extravasación: necrosis. Vía central siempre que se pueda",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },

  /* ---------- Respiratorios ---------- */

  {
    slug: "aminofilina",
    descripcion: "Sal soluble de teofilina, apta para inyección. Broncodilatador metilxantínico con efecto estimulante respiratorio.",
    fuente: "FDA/DailyMed — AMINOPHYLLINE INJECTION (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad a la teofilina o a los componentes del producto, la etilendiamina incluida",
      "La etiqueta pide extrema precaución en úlcera péptica activa y en trastornos convulsivos: la metilxantina los agrava",
      "Margen terapéutico estrecho: la toxicidad da vómito, taquiarritmia y convulsiones",
      "Insuficiencia cardiaca o hepática: el aclaramiento baja y el fármaco se acumula",
      "Muchas interacciones: fluoroquinolonas, cimetidina y macrólidos frenan su eliminación",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "teofilina",
    descripcion: "Metilxantina oral. Broncodilatador de fondo en la bronquitis crónica y el colapso traqueal.",
    fuente: "FDA/DailyMed — THEOPHYLLINE EXTENDED-RELEASE TABLET (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad a la teofilina o a los componentes del producto",
      "La etiqueta pide extrema precaución en úlcera péptica activa y en trastornos convulsivos",
      "Margen terapéutico estrecho: la etiqueta recomienda medir la concentración sérica para saber si la dosis es la correcta",
      "Insuficiencia cardiaca o hepática: se acumula",
      "Interacciones: fluoroquinolonas, cimetidina y macrólidos elevan su concentración",
      "Las presentaciones de liberación prolongada no son intercambiables entre sí",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "salbutamol",
    descripcion: "Agonista beta-2 de acción rápida. Broncodilatador de rescate, se usa inhalado con cámara espaciadora.",
    fuente: "FDA/DailyMed — ALBUTEROL SULFATE INHALATION SOLUTION (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad a cualquiera de sus componentes",
      "La etiqueta advierte de broncoespasmo paradójico, que puede poner en peligro la vida: si ocurre, suspender de inmediato",
      "Cardiopatía, arritmias o hipertensión: la selectividad beta-2 se pierde al subir la dosis",
      "Hipopotasemia: los beta-2 desplazan el potasio al interior de la célula",
      "Es un fármaco de rescate: si hace falta cada vez más a menudo, el problema de fondo no está controlado",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "terbutalina",
    descripcion: "Agonista beta-2 inyectable u oral. En el gato sirve como rescate del broncoespasmo cuando no se puede inhalar.",
    fuente: "FDA/DailyMed — TERBUTALINE SULFATE TABLET (etiqueta humana, con recuadro de advertencia)",
    contra: [
      "El recuadro de advertencia prohíbe usarla como tocolítico: se han notificado reacciones graves y muertes en mujeres gestantes",
      "Cardiopatía isquémica, hipertensión y arritmias: precaución expresa de la etiqueta",
      "Hipertiroidismo",
      "Diabetes mellitus: produce hiperglucemia transitoria",
      "Trastornos convulsivos",
      "Hipersensibilidad a aminas simpaticomiméticas",
      "Se han descrito reacciones de hipersensibilidad inmediata y empeoramiento del broncoespasmo tras administrarla",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "bromhexina",
    descripcion: "Mucolítico que rompe las fibras de mucopolisacárido y hace la secreción más fluida.",
    fuente: "Sin etiqueta localizada en FDA/DailyMed (no está comercializada en Estados Unidos) ni ficha técnica europea recuperable",
    contra: [
      "SIN FUENTE REGLAMENTARIA CONSULTABLE. La bromhexina no está registrada en la FDA y no se pudo recuperar una ficha técnica europea: revisar el prospecto del producto registrado en Ecuador antes de usarla",
      "Hipersensibilidad conocida a la bromhexina",
      "Al fluidificar la secreción aumenta el volumen que hay que expectorar: en un animal que no puede toser bien, eso es un problema, no una ayuda"
    ]
  },
  {
    slug: "ambroxol",
    descripcion: "Metabolito activo de la bromhexina, con el mismo efecto mucolítico y algo de acción sobre el surfactante.",
    fuente: "Sin etiqueta localizada en FDA/DailyMed (no está comercializado en Estados Unidos) ni ficha técnica europea recuperable",
    contra: [
      "SIN FUENTE REGLAMENTARIA CONSULTABLE. El ambroxol no está registrado en la FDA: revisar el prospecto del producto registrado en Ecuador antes de usarlo",
      "Hipersensibilidad conocida al ambroxol o a la bromhexina",
      "Al fluidificar la secreción aumenta el volumen que hay que expectorar: valorarlo en el animal que no puede toser con fuerza"
    ]
  },
  {
    slug: "n-acetilcisteina",
    descripcion: "Mucolítico que rompe los puentes disulfuro del moco. Además repone glutatión, y por eso es el antídoto del paracetamol.",
    fuente: "FDA/DailyMed — ACETYLCYSTEINE SOLUTION (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad conocida a la acetilcisteína",
      "Como antídoto del paracetamol la etiqueta dice que NO hay contraindicaciones para la vía oral: en esa indicación se administra igual",
      "Aumenta el volumen de secreción bronquial licuada: si la tos no es eficaz, hay que aspirar la vía aérea",
      "Obstrucción mecánica de la vía aérea: la etiqueta advierte de que hay que mantenerla permeable",
      "Provoca vómito con frecuencia; en la intoxicación por paracetamol el propio cuadro ya produce vómito y el tratamiento oral puede agravarlo",
      "Precaución si hay riesgo de hemorragia gástrica",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },

  /* ---------- Antihistamínicos ---------- */

  {
    slug: "difenhidramina",
    descripcion: "Antihistamínico H1 de primera generación. Sedante y con acción anticolinérgica; se usa en reacciones alérgicas agudas y como antiemético del transporte.",
    fuente: "FDA/DailyMed — DIPHENHYDRAMINE HYDROCHLORIDE INJECTION (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Neonatos y prematuros: contraindicación expresa de la etiqueta",
      "Hembras en lactancia: la etiqueta contraindica los antihistamínicos por el riesgo para el neonato",
      "NO usar como anestésico local: produce necrosis local",
      "Hipersensibilidad a la difenhidramina o a antihistamínicos de estructura parecida",
      "Glaucoma de ángulo estrecho, úlcera péptica estenosante, obstrucción pilórica o del cuello de la vejiga: precaución expresa de la etiqueta",
      "Tiene acción atropínica: precaución en asma bronquial, presión intraocular elevada, hipertiroidismo y cardiopatía",
      "Sedación: no combinar sin más con otros depresores del sistema nervioso central",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "clorfenamina",
    descripcion: "Antihistamínico H1 de primera generación con menos sedación que la difenhidramina. Útil en prurito alérgico del gato.",
    fuente: "FDA/DailyMed — CHLORPHENIRAMINE MALEATE (etiquetas humanas OTC). Nota: la etiqueta de venta libre consultada no incluye apartado de contraindicaciones",
    contra: [
      "La etiqueta OTC consultada no declara contraindicaciones formales. Lo que sigue son efectos de clase de los antihistamínicos H1 de primera generación, recogidos en las etiquetas de difenhidramina e hidroxicina",
      "Hipersensibilidad a antihistamínicos de estructura parecida",
      "Efecto anticolinérgico: precaución en glaucoma, retención urinaria, obstrucción pilórica y cardiopatía",
      "Sedación: se suma a la de otros depresores del sistema nervioso central",
      "Dato de etiqueta humana de venta libre: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "hidroxicina",
    descripcion: "Antihistamínico H1 de primera generación con efecto ansiolítico. Es el antipruriginoso de esta familia con más recorrido en dermatología.",
    fuente: "FDA/DailyMed — HYDROXYZINE HYDROCHLORIDE TABLET (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad a la hidroxicina, a la cetirizina o a la levocetirizina: contraindicación expresa (la cetirizina es su metabolito)",
      "Intervalo QT alargado: contraindicación expresa de la etiqueta",
      "Gestación temprana: contraindicación expresa; produjo anomalías fetales en rata y ratón por encima del rango terapéutico",
      "Lactancia: la etiqueta dice que no debe darse",
      "La etiqueta advierte en mayúsculas de la potenciación con depresores del sistema nervioso central: opioides, analgésicos no opioides y barbitúricos",
      "Efecto anticolinérgico: precaución en glaucoma y retención urinaria",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "cetirizina",
    descripcion: "Antihistamínico H1 de segunda generación. Apenas sedante porque casi no cruza la barrera hematoencefálica.",
    fuente: "FDA/DailyMed — CETIRIZINE HYDROCHLORIDE (etiqueta humana de venta libre; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Antecedente de reacción alérgica a la cetirizina o a un antihistamínico que contenga hidroxicina: la cetirizina es el metabolito de la hidroxicina",
      "Enfermedad hepática o renal: la etiqueta pide consultar, la dosis debe ajustarse",
      "Aunque se le llama no sedante, la etiqueta reconoce que puede dar somnolencia y que se suma a la de tranquilizantes y sedantes",
      "Dato de etiqueta humana de venta libre: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "loratadina",
    descripcion: "Antihistamínico H1 de segunda generación, prácticamente sin sedación.",
    fuente: "FDA/DailyMed — LORATADINE TABLET (etiqueta humana de venta libre). Nota: la etiqueta OTC solo declara la alergia al producto",
    contra: [
      "Antecedente de reacción alérgica a la loratadina o a cualquiera de sus ingredientes: es la única contraindicación que declara la etiqueta",
      "Insuficiencia hepática o renal: se metaboliza en hígado, la dosis debe ajustarse",
      "Muchas presentaciones humanas la combinan con pseudoefedrina, que SÍ es peligrosa en el perro: comprobar siempre que el envase lleve loratadina sola",
      "Dato de etiqueta humana de venta libre: en veterinaria el uso es fuera de etiqueta"
    ]
  },

  /* ---------- Antifúngicos ---------- */

  {
    slug: "itraconazol",
    descripcion: "Antifúngico azólico. Se acumula bien en piel y uñas, y es de elección en dermatofitosis y en varias micosis sistémicas.",
    fuente: "FDA/DailyMed — ITRACONAZOLE CAPSULE (etiqueta humana, con recuadro de advertencia; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "El recuadro de advertencia recoge efectos cardiacos: administrado por vía intravenosa a perros produjo efecto inotrópico negativo. No usar en pacientes con disfunción ventricular o insuficiencia cardiaca",
      "La etiqueta describe casos raros de hepatotoxicidad grave, con fallo hepático y muerte, incluso sin enfermedad hepática previa",
      "Inhibe la CYP3A4 con mucha fuerza: sube la concentración de numerosos fármacos y varios están contraindicados junto a él (metadona, quinidina, alcaloides del ergot, midazolam oral, lovastatina y simvastatina, entre otros)",
      "Hipersensibilidad al itraconazol",
      "Gestación: es teratogénico en animales de laboratorio",
      "Se absorbe mal en ayunas: la etiqueta pide administrarlo tras una comida completa",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "ketoconazol",
    descripcion: "Antifúngico azólico de primera generación. También frena la síntesis de cortisol, y por eso se ha usado en hiperadrenocorticismo.",
    fuente: "FDA/DailyMed — KETOCONAZOLE TABLET (etiqueta humana, con recuadro de advertencia; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "El recuadro de advertencia describe hepatotoxicidad grave, con casos mortales o que requirieron trasplante, en pacientes sin factores de riesgo. La etiqueta lo relega a cuando no haya otro antifúngico disponible o tolerado",
      "El recuadro también advierte de alargamiento del QT y arritmias ventriculares potencialmente mortales por interacción",
      "Contraindicado junto a dofetilida, quinidina, pimozida, cisaprida, metadona, disopiramida, dronedarona y ranolazina, entre otros",
      "Contraindicado junto a midazolam oral, triazolam o alprazolam: sedación potenciada y prolongada",
      "Contraindicado junto a simvastatina y lovastatina: miopatía",
      "Enfermedad hepática",
      "Frena la síntesis de esteroides: en tratamientos largos puede producir insuficiencia adrenal",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "fluconazol",
    descripcion: "Antifúngico azólico muy hidrosoluble. Alcanza bien el sistema nervioso central y la orina, lo que lo hace útil en criptococosis.",
    fuente: "FDA/DailyMed — FLUCONAZOLE TABLET (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad al fluconazol o a cualquier excipiente. Precaución si hay hipersensibilidad a otros azoles",
      "Contraindicado junto a fármacos que alargan el QT y se metabolizan por CYP3A4: eritromicina, pimozida y quinidina",
      "Disfunción hepática: la etiqueta describe casos raros de toxicidad hepática grave, incluidos fallecimientos",
      "Insuficiencia renal: se elimina por riñón sin metabolizar, hay que ajustar la dosis",
      "Gestación",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "terbinafina",
    descripcion: "Antifúngico alilamina. Fungicida frente a dermatofitos y se concentra en piel y faneras.",
    fuente: "FDA/DailyMed — TERBINAFINE TABLET (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Enfermedad hepática crónica o activa: contraindicación expresa de la etiqueta",
      "Antecedente de reacción alérgica a la terbinafina oral, por riesgo de anafilaxia",
      "Conviene comprobar la función hepática antes de un tratamiento largo",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "griseofulvina",
    descripcion: "Antifúngico clásico frente a dermatofitos. Se deposita en la queratina nueva; el tratamiento dura hasta que crece todo el pelo.",
    fuente: "FDA/DailyMed — GRISEOFULVIN SUSPENSION (etiqueta humana, que recoge los datos de teratogenicidad obtenidos en gatas y perras)",
    contra: [
      "Gestación: es teratogénica. La etiqueta documenta efectos teratogénicos en GATAS tratadas semanalmente con 500 a 1000 mg, y teratogenicidad descrita en una perra golden retriever tratada durante cuatro semanas antes y durante toda la gestación. En medicina humana está contraindicada en el embarazo",
      "Porfiria: contraindicación expresa",
      "Fallo hepatocelular: contraindicación expresa",
      "Hipersensibilidad a la griseofulvina",
      "La etiqueta describe reacciones cutáneas graves (síndrome de Stevens-Johnson, necrólisis epidérmica tóxica)",
      "Tratamientos largos: la etiqueta pide vigilar de forma periódica la función renal, hepática y hematopoyética",
      "Se ha descrito mielosupresión, especialmente marcada en gatos con inmunodeficiencia vírica felina",
      "Dato de etiqueta humana, que sin embargo cita expresamente los datos obtenidos en gatas y perras"
    ]
  },
  {
    slug: "anfotericina-b",
    descripcion: "Antifúngico polieno inyectable. Se reserva para micosis sistémicas graves; es fungicida pero muy nefrotóxico.",
    fuente: "FDA/DailyMed — AMPHOTERICIN B LIPOSOME FOR INJECTION (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad demostrada o conocida a la anfotericina B desoxicolato o a cualquier componente, salvo que el beneficio supere claramente al riesgo",
      "Se han notificado anafilaxias con las presentaciones de anfotericina B: ante una reacción grave hay que suspender la infusión de inmediato",
      "Insuficiencia renal: la nefrotoxicidad es su efecto limitante. Hidratar bien antes y durante la infusión, y controlar creatinina y potasio",
      "No dar junto a otros fármacos nefrotóxicos: aminoglucósidos, AINE, cisplatino",
      "Es un fármaco de hospitalización, no de manejo ambulatorio",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "nistatina",
    descripcion: "Antifúngico polieno de acción local. No se absorbe: sirve para candidiasis de mucosas y de piel, no para micosis sistémicas.",
    fuente: "FDA/DailyMed — NYSTATIN SUSPENSION (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad a la nistatina o a cualquier componente de la suspensión",
      "NO sirve para micosis sistémicas: la etiqueta lo dice expresamente, porque no se absorbe desde el tubo digestivo",
      "Suspender si aparece sensibilización o irritación durante el uso",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },

  /* ---------- Hormonales y reproductivos ---------- */

  {
    slug: "oxitocina",
    descripcion: "Hormona uterotónica. Contrae el músculo liso del útero y de la glándula mamaria: parto y bajada de la leche.",
    fuente: "FDA/DailyMed — OXYTOCIN INJECTION (etiqueta veterinaria, Bimeda)",
    contra: [
      "Distocia por presentación anormal del feto: contraindicación expresa de la etiqueta. NO administrar hasta haber corregido la posición. Contraer un útero contra un feto mal colocado lo rompe",
      "Cuello uterino no dilatado: la etiqueta exige dilatación completa antes de usarla en el preparto, sea natural o inducida con estrógenos",
      "Obstrucción del canal del parto por desproporción fetopélvica",
      "Es un preparado potente: administrar con la debida precaución y a la dosis indicada",
      "Sin calcio no funciona: en una hipocalcemia, la oxitocina sola no contrae el útero"
    ]
  },
  {
    slug: "cloprostenol",
    descripcion: "Análogo sintético de la prostaglandina F2 alfa. Luteolítico: destruye el cuerpo lúteo y sirve para sincronizar celos e inducir el parto o el aborto.",
    fuente: "FDA/DailyMed — ESTRUMATE (cloprostenol sódico, etiqueta veterinaria, Merck)",
    contra: [
      "Vacas gestantes: contraindicación expresa de la etiqueta, salvo que se busque el aborto",
      "PELIGRO PARA QUIEN LO MANIPULA: la etiqueta advierte de que se absorbe con facilidad a través de la piel y puede provocar aborto y broncoespasmo. Hay que evitar el contacto directo",
      "Las mujeres en edad fértil, las personas asmáticas y quienes tengan problemas bronquiales o respiratorios deben extremar la precaución al manipularlo",
      "Si cae sobre la piel, lavar de inmediato con agua y jabón",
      "Usar guantes siempre, también para cargar la jeringa"
    ]
  },
  {
    slug: "gonadorelina",
    descripcion: "GnRH sintética. Provoca el pico de LH: se usa para inducir la ovulación y en protocolos de sincronización.",
    fuente: "FDA/DailyMed — GONABREED (gonadorelina, etiqueta veterinaria, Parnell). Nota: la etiqueta no incluye apartado de contraindicaciones",
    contra: [
      "La etiqueta consultada no declara contraindicaciones clínicas y no exige tiempo de retiro ni descarte de leche cuando se usa según lo indicado",
      "No es para uso humano; mantener fuera del alcance de los niños",
      "Su eficacia depende por completo del momento del ciclo: fuera del protocolo correcto no hace nada, y eso se confunde fácilmente con un fallo del producto"
    ]
  },
  {
    slug: "hcg",
    descripcion: "Gonadotropina coriónica. Actúa como la LH: induce la ovulación y sostiene el cuerpo lúteo.",
    fuente: "FDA/DailyMed — P.G. 600 (gonadotropina sérica y coriónica, etiqueta veterinaria porcina, Merck)",
    contra: [
      "No induce celo en cerdas jóvenes que ya han alcanzado la pubertad y están ciclando",
      "No induce celo en cerdas que vuelven a celo con normalidad entre 3 y 7 días tras el destete",
      "Cerdas jóvenes de menos de cinco meses y medio o de menos de 85 kg: pueden no estar suficientemente maduras para mantener ciclos normales ni llevar una gestación a término tras el tratamiento",
      "El uso repetido puede generar anticuerpos que reducen la respuesta",
      "En condiciones ambientales adversas la respuesta empeora y las camadas salen más pequeñas"
    ]
  },
  {
    slug: "ecg-pmsg",
    descripcion: "Gonadotropina sérica de yegua gestante. Actúa como la FSH: recluta folículos, base de la superovulación y de la inducción de celo.",
    fuente: "FDA/DailyMed — P.G. 600 (gonadotropina sérica y coriónica, etiqueta veterinaria porcina, Merck)",
    contra: [
      "Mismas limitaciones que la combinación P.G. 600: no induce celo en hembras jóvenes que ya ciclan ni en cerdas que vuelven a celo con normalidad tras el destete",
      "Hembras jóvenes por debajo de la edad o el peso mínimos: pueden no mantener la gestación a término",
      "Vida media larga: la sobreestimulación ovárica produce quistes foliculares",
      "El uso repetido genera anticuerpos anti-eCG que reducen la respuesta en tratamientos posteriores"
    ]
  },
  {
    slug: "altrenogest",
    descripcion: "Progestágeno oral. Mantiene el bloqueo del celo mientras se administra; al retirarlo, los celos se sincronizan.",
    fuente: "FDA/DailyMed — ALTREN (altrenogest, etiqueta veterinaria equina, Aurora Pharmaceutical)",
    contra: [
      "Yeguas con antecedente o cuadro actual de inflamación uterina (endometritis aguda, subaguda o crónica): contraindicación expresa. El gestágeno puede convertir una inflamación de bajo grado en una infección uterina fulminante",
      "PELIGRO PARA QUIEN LO MANIPULA: se absorbe por la piel. Las mujeres gestantes o en edad fértil deben usar guantes impermeables",
      "Es de uso exclusivo bajo prescripción veterinaria"
    ]
  },
  {
    slug: "medroxiprogesterona",
    descripcion: "Progestágeno de depósito. Se ha usado para frenar el celo y en algunas dermatosis, pero su perfil de efectos adversos es malo.",
    fuente: "FDA/DailyMed — MEDROXYPROGESTERONE ACETATE INJECTION (etiqueta humana, con recuadro de advertencia; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Tromboflebitis activa, o antecedente de trastorno tromboembólico o de enfermedad cerebrovascular",
      "Tumor de mama conocido o sospechado: contraindicación expresa",
      "Enfermedad hepática significativa",
      "Sangrado vaginal sin diagnosticar",
      "Hipersensibilidad al acetato de medroxiprogesterona",
      "El recuadro de advertencia describe pérdida significativa de densidad mineral ósea, mayor cuanto más dura el tratamiento y no del todo reversible",
      "En la perra, los progestágenos se asocian a hiperplasia endometrial quística y piómetra, y a diabetes mellitus por resistencia a la insulina",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "deslorelina",
    descripcion: "Agonista de GnRH en implante. La estimulación continua acaba desensibilizando la hipófisis: castración química reversible.",
    fuente: "FDA/DailyMed — SUPRELORIN F (deslorelina acetato, implante, etiqueta veterinaria, Virbac)",
    contra: [
      "Hipersensibilidad conocida a la deslorelina o a otras hormonas sintéticas",
      "No usar en animales destinados a reproducción: contraindicación expresa de la etiqueta",
      "No está evaluada la seguridad en hembras gestantes ni en lactancia",
      "PELIGRO PARA QUIEN LO MANIPULA: no manipular el implante si se está embarazada, en lactancia o se sospecha embarazo. La administración accidental puede alterar el ciclo menstrual. Evitar el contacto directo con la piel",
      "Al principio produce un efecto estimulante transitorio antes de la supresión: en las primeras semanas puede aparecer celo o aumento de la actividad hormonal"
    ]
  },
  {
    slug: "levotiroxina",
    descripcion: "Hormona tiroidea sintética T4. Tratamiento sustitutivo de por vida en el hipotiroidismo del perro.",
    fuente: "FDA/DailyMed — THYRO-TABS CANINE (levotiroxina sódica, etiqueta veterinaria)",
    contra: [
      "Tirotoxicosis: contraindicación expresa de la etiqueta",
      "Insuficiencia adrenal no corregida: contraindicación expresa. Hay que tratar antes el hipoadrenocorticismo; si no, la levotiroxina puede precipitar una crisis addisoniana",
      "Cardiopatía de base: la etiqueta pide vigilar de cerca durante el ajuste de dosis, y puede hacer falta cambiar la medicación cardiaca",
      "El sobretratamiento produce tirotoxicosis yatrogénica: taquicardia, jadeo, pérdida de peso y nerviosismo. Ajustar por T4 y no por el aspecto del animal"
    ]
  },
  {
    slug: "metimazol",
    descripcion: "Antitiroideo. Bloquea la síntesis de hormona tiroidea; es el tratamiento médico del hipertiroidismo felino.",
    fuente: "FDA/DailyMed — FELIMAZOLE (metimazol, etiqueta veterinaria felina, Dechra)",
    contra: [
      "Hipersensibilidad al metimazol, al carbimazol o al excipiente polietilenglicol",
      "Enfermedad hepática primaria: contraindicación expresa",
      "Fallo renal: contraindicación expresa",
      "Enfermedad autoinmune: contraindicación expresa",
      "Trastornos hematológicos (anemia, neutropenia, linfopenia, trombocitopenia) o coagulopatías: contraindicación expresa",
      "Gatas gestantes o en lactancia: contraindicación expresa. Hay evidencia de efectos teratogénicos y embriotóxicos en rata y ratón",
      "Tiene actividad antivitamina K y puede inducir tendencia al sangrado sin que baje el recuento de plaquetas",
      "Disfunción renal: hay que valorarlo con cuidado. Al corregir el hipertiroidismo baja el filtrado glomerular y puede destaparse una enfermedad renal que estaba enmascarada"
    ]
  },
  {
    slug: "trilostano",
    descripcion: "Inhibidor de la 3-beta-hidroxiesteroide deshidrogenasa. Frena la síntesis de cortisol: tratamiento del hiperadrenocorticismo canino.",
    fuente: "FDA/DailyMed — VETORYL (trilostano, etiqueta veterinaria canina, Dechra)",
    contra: [
      "Hipersensibilidad demostrada al trilostano",
      "Enfermedad hepática primaria: contraindicación expresa",
      "Insuficiencia renal: contraindicación expresa",
      "Perras gestantes: contraindicación expresa. En animales de laboratorio produjo efectos teratogénicos y pérdida temprana de la gestación",
      "Puede aparecer hipoadrenocorticismo a CUALQUIER dosis. En algunos casos la función adrenal tarda meses en volver, y hay perros que no la recuperan nunca",
      "Si se venía de mitotano, la etiqueta pide esperar al menos un mes antes de introducir el trilostano",
      "Exige historia y exploración completas antes de empezar, y controles de electrolitos y ACTH durante el tratamiento"
    ]
  },
  {
    slug: "insulina-nph",
    descripcion: "Insulina de acción intermedia. Base del tratamiento de la diabetes mellitus canina, en dos aplicaciones diarias.",
    fuente: "FDA/DailyMed — VETSULIN (insulina porcina, etiqueta veterinaria) y PROZINC (etiqueta veterinaria)",
    contra: [
      "Episodio de hipoglucemia: contraindicación expresa. Nunca aplicar insulina a un animal que ya está hipoglucémico",
      "Alergia sistémica conocida al cerdo o a productos porcinos, en el caso de la insulina de origen porcino",
      "Hipersensibilidad a cualquier componente del preparado",
      "Cetoacidosis grave, anorexia, letargo o vómito: la etiqueta pide estabilizar antes con insulina de acción rápida y soporte, no empezar con la de acción intermedia",
      "No agitar ni congelar el vial; resuspender con suavidad antes de cargar",
      "Cada tipo de insulina tiene su propia jeringa graduada: mezclar jeringa y concentración es la causa más frecuente de sobredosis"
    ]
  },
  {
    slug: "insulina-glargina",
    descripcion: "Análogo de insulina de acción prolongada y curva plana. Muy usada en el gato diabético, donde puede llevar a la remisión.",
    fuente: "FDA/DailyMed — PROZINC (insulina de acción prolongada, etiqueta veterinaria felina y canina, Boehringer Ingelheim) para los efectos de clase",
    contra: [
      "Episodio de hipoglucemia: contraindicación expresa de las etiquetas de insulina",
      "Hipersensibilidad conocida a la insulina o a cualquier componente del preparado",
      "Cetoacidosis grave, anorexia, letargo o vómito: estabilizar antes con insulina de acción rápida",
      "No mezclar en la misma jeringa con otras insulinas",
      "Cada tipo de insulina tiene su jeringa graduada propia: confundirlas es la causa más frecuente de sobredosis",
      "En veterinaria la glargina es fuera de etiqueta: las etiquetas veterinarias disponibles son de otras insulinas"
    ]
  },
  {
    slug: "desmopresina",
    descripcion: "Análogo de la vasopresina. Trata la diabetes insípida central y, por su efecto sobre el factor de von Willebrand, se usa antes de una cirugía en pacientes con esa enfermedad.",
    fuente: "FDA/DailyMed — DESMOPRESSIN ACETATE INJECTION (etiqueta humana, con recuadro de advertencia; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "El recuadro de advertencia es de hiponatremia: puede ser grave y llegar a convulsiones, coma, parada respiratoria y muerte",
      "Hiponatremia o antecedente de hiponatremia: contraindicación expresa",
      "Insuficiencia renal moderada o grave",
      "Polidipsia: contraindicación expresa, porque el exceso de agua con la orina retenida diluye el sodio",
      "Junto a diuréticos de asa o a corticoides sistémicos o inhalados: contraindicación expresa del recuadro",
      "Enfermedad que curse con desequilibrio de líquidos o electrolitos: gastroenteritis, nefropatía perdedora de sal, infección sistémica",
      "Insuficiencia cardiaca o hipertensión no controlada: la retención de líquido las empeora",
      "Hipersensibilidad a la desmopresina",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },

  /* ---------- Neurológicos y anticonvulsivos ---------- */

  {
    slug: "fenobarbital",
    descripcion: "Barbitúrico anticonvulsivo. Sigue siendo el antiepiléptico de primera línea en el perro por eficacia y precio.",
    fuente: "FDA/DailyMed — PHENOBARBITAL TABLET (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad a los barbitúricos",
      "Deterioro marcado de la función hepática: contraindicación expresa. El fenobarbital se metaboliza en hígado y es hepatotóxico en tratamientos largos",
      "Enfermedad respiratoria con disnea u obstrucción evidente: contraindicación expresa",
      "Antecedente de porfiria manifiesta o latente",
      "NO suspender de golpe: la retirada brusca desencadena estatus epiléptico",
      "Es inductor enzimático potente: acelera el metabolismo de muchos otros fármacos y baja su efecto",
      "Exige controlar la concentración sérica y la bioquímica hepática de forma periódica",
      "Sustancia controlada: registrar cada uso",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "bromuro-de-potasio",
    descripcion: "Anticonvulsivo de eliminación exclusivamente renal. Se usa asociado al fenobarbital o solo cuando hay daño hepático.",
    fuente: "FDA/DailyMed — KBROVET 500 (bromuro de potasio, etiqueta veterinaria canina, Pegasus Laboratories)",
    contra: [
      "⛔ Felino: la etiqueta lo dice sin matices, «not for use in cats». En el gato el bromuro provoca enfermedad respiratoria grave",
      "Antecedente de hipersensibilidad al bromuro",
      "El cloro de la dieta compite con el bromuro: cambiar de alimento o poner fluidos con cloruro sódico baja la concentración de bromuro y puede desencadenar crisis. La etiqueta pide vigilancia estrecha ante cualquier cambio de dieta o de fluidos",
      "Insuficiencia renal: se elimina íntegramente por riñón y se acumula",
      "Tarda meses en alcanzar concentración estable: no sirve para una urgencia"
    ]
  },
  {
    slug: "levetiracetam",
    descripcion: "Anticonvulsivo de mecanismo distinto al resto (proteína SV2A). No se metaboliza apenas en hígado, lo que lo hace cómodo en hepatópatas.",
    fuente: "FDA/DailyMed — LEVETIRACETAM TABLET (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad al levetiracetam: se han descrito anafilaxia y angioedema",
      "Insuficiencia renal: se elimina sin metabolizar por riñón, hay que ajustar la dosis",
      "Vida media corta en el perro: la presentación normal necesita tres tomas al día. Espaciarlas más es la causa habitual de que parezca que no funciona",
      "No suspender de golpe",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "imepitoina",
    descripcion: "Agonista parcial del receptor de benzodiazepinas, con acción anticonvulsiva y ansiolítica. Autorizado en Europa para la epilepsia idiopática canina.",
    fuente: "No se pudo recuperar la ficha técnica europea de Pexion: la EMA remite a la base de datos UPD, que no permite la descarga automática del documento",
    contra: [
      "FUENTE NO RECUPERADA. La ficha técnica europea de imepitoína (Pexion, Boehringer Ingelheim) no pudo consultarse en esta revisión. NO se han escrito contraindicaciones para no inventarlas",
      "Antes de usarla hay que leer el prospecto del producto registrado: es el único documento con las contraindicaciones aprobadas",
      "Lo único que se puede afirmar por su clase: es agonista parcial del receptor benzodiazepínico, así que su efecto se suma al de otros depresores del sistema nervioso central"
    ]
  },
  {
    slug: "gabapentina",
    descripcion: "Análogo del GABA que actúa sobre canales de calcio. Se usa en dolor neuropático y como sedante suave antes de la consulta, sobre todo en gatos.",
    fuente: "FDA/DailyMed — GABAPENTIN CAPSULE (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad a la gabapentina o a sus excipientes",
      "Insuficiencia renal: se elimina sin metabolizar por riñón, la dosis debe reducirse",
      "No suspender de golpe tras uso prolongado",
      "Las presentaciones humanas en solución oral suelen llevar XILITOL, que es tóxico para el perro: comprobar siempre los excipientes antes de usar un jarabe humano",
      "Produce sedación y ataxia dependientes de la dosis",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "pregabalina",
    descripcion: "Análogo de la gabapentina, más potente y de absorción más previsible. Dolor neuropático y ansiedad.",
    fuente: "FDA/DailyMed — PREGABALIN CAPSULE (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad a la pregabalina o a cualquiera de sus componentes: se han descrito angioedema y reacciones de hipersensibilidad",
      "Insuficiencia renal: se elimina por riñón, hay que ajustar la dosis",
      "No suspender de golpe tras uso prolongado",
      "Produce sedación y ataxia dependientes de la dosis",
      "Sustancia controlada en algunos países: comprobar la normativa local",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "fluoxetina",
    descripcion: "Inhibidor selectivo de la recaptación de serotonina. Se usa en ansiedad por separación, agresividad y conductas compulsivas.",
    fuente: "FDA/DailyMed — FLUOXETINE CAPSULE (etiqueta humana, con recuadro de advertencia; existe producto veterinario canino en Estados Unidos)",
    contra: [
      "Junto a inhibidores de la MAO, o dentro de las 5 semanas siguientes a suspender la fluoxetina: contraindicación expresa por síndrome serotoninérgico. La selegilina, usada en veterinaria, es un IMAO",
      "Junto a pimozida o tioridazina: contraindicación expresa por alargamiento del QT",
      "Junto a azul de metileno intravenoso o a linezolid: contraindicación expresa",
      "Precaución con tramadol, trazodona y otros serotoninérgicos: se suman",
      "Hipersensibilidad a la fluoxetina",
      "Tarda de cuatro a seis semanas en hacer efecto: no sirve para un problema puntual",
      "Dato de etiqueta humana: comprobar la etiqueta del producto veterinario si se dispone de él"
    ]
  },
  {
    slug: "trazodona",
    descripcion: "Antidepresivo serotoninérgico con efecto sedante marcado. Se usa para bajar la ansiedad en la consulta y en el reposo postoperatorio.",
    fuente: "FDA/DailyMed — TRAZODONE HYDROCHLORIDE TABLET (etiqueta humana, con recuadro de advertencia; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Junto a inhibidores de la MAO, o dentro de los 14 días siguientes a suspenderlos: contraindicación expresa",
      "Precaución junto a fluoxetina, tramadol u otros serotoninérgicos: riesgo de síndrome serotoninérgico",
      "Hipersensibilidad a la trazodona",
      "Enfermedad hepática o renal: se metaboliza en hígado",
      "Cardiopatía: se ha descrito alargamiento del QT y arritmias",
      "Puede producir sedación profunda y ataxia; el efecto varía mucho de un animal a otro",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },

  /* ---------- Antídotos y reversores ---------- */

  {
    slug: "atipamezol",
    descripcion: "Antagonista alfa-2 selectivo. Revierte en minutos la sedación por dexmedetomidina o medetomidina.",
    fuente: "FDA/DailyMed — ATIPAMEZOLE HYDROCHLORIDE INJECTION (etiqueta veterinaria)",
    contra: [
      "Como el atipamezol siempre se usa junto a dexmedetomidina o medetomidina, la etiqueta lo contraindica en los mismos casos que a estas: cardiopatía, trastornos respiratorios, enfermedad hepática o renal, shock, debilitación grave, y estrés por calor, frío o fatiga extremos",
      "Hipersensibilidad conocida al atipamezol",
      "Revierte la sedación de forma brusca: el animal puede despertar apresivo o agresivo. Manejarlo con precaución",
      "Revierte también la analgesia del alfa-2: si el procedimiento fue doloroso, hay que tener otra analgesia puesta antes de revertir",
      "Puede haber resedación cuando el atipamezol se elimina antes que el sedante"
    ]
  },
  {
    slug: "naloxona",
    descripcion: "Antagonista opiáceo puro. Revierte la depresión respiratoria por opioides en cuestión de minutos.",
    fuente: "FDA/DailyMed — NALOXONE HYDROCHLORIDE INJECTION (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad a la naloxona o a cualquier componente",
      "Dependencia física de opioides: la etiqueta pide administrarla con cautela, la reversión brusca y completa precipita un síndrome de abstinencia agudo",
      "Revierte también la analgesia: si el animal tenía dolor, vuelve entero y de golpe",
      "Su duración es MÁS CORTA que la de la mayoría de los opioides: hay que vigilar la recaída en depresión respiratoria y repetir la dosis si hace falta",
      "No sustituye a las demás medidas: la etiqueta insiste en mantener la vía aérea, ventilar y disponer de vasopresores",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "flumazenilo",
    descripcion: "Antagonista del sitio benzodiazepínico. Revierte la sedación por midazolam o diazepam.",
    fuente: "FDA/DailyMed — FLUMAZENIL INJECTION (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad al flumazenilo o a las benzodiazepinas",
      "Pacientes a los que se dio una benzodiazepina para controlar un cuadro que amenaza la vida, como hipertensión intracraneal o estatus epiléptico: contraindicación expresa. Revertirla devuelve el problema",
      "Signos de sobredosis grave por antidepresivos tricíclicos: contraindicación expresa",
      "El uso de flumazenilo se ha asociado a CONVULSIONES, sobre todo tras sedación prolongada con benzodiazepinas",
      "Su duración es más corta que la del midazolam o el diazepam: puede haber resedación y hay que vigilar",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "vitamina-k1",
    descripcion: "Fitomenadiona. Antídoto de los rodenticidas anticoagulantes: repone el cofactor que el veneno bloquea.",
    fuente: "FDA/DailyMed — PHYTONADIONE INJECTION (etiqueta humana, con recuadro de advertencia; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "El recuadro de advertencia es de vía: se han producido reacciones graves y MUERTES durante e inmediatamente después de la inyección INTRAVENOSA, incluso diluyendo y pasándola lenta, y también por vía intramuscular. Las reacciones parecen anafilaxia, con shock y parada cardiorrespiratoria, y pueden darse en la primera administración. La etiqueta reserva la vía intravenosa e intramuscular a los casos en que la subcutánea no es viable",
      "En la práctica: la vía SUBCUTÁNEA es la de elección, y la ORAL con comida grasa cuando el animal puede tragar",
      "Hipersensibilidad a cualquier componente",
      "El tratamiento dura semanas: los rodenticidas de segunda generación persisten mucho más que la vitamina K. Suspender antes de tiempo hace que el animal vuelva a sangrar",
      "No corrige de inmediato: la coagulación tarda horas en normalizarse. Un animal que ya está sangrando necesita además plasma o sangre",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "carbon-activado",
    descripcion: "Adsorbente. Atrapa el tóxico en la luz digestiva antes de que se absorba; es la base de la descontaminación oral.",
    fuente: "FDA/DailyMed — ACTIVATED CHARCOAL SUSPENSION WITH SORBITOL (etiqueta veterinaria, MWI)",
    contra: [
      "Íleo u obstrucción intestinal: contraindicación expresa de la etiqueta",
      "No administrar junto a medicación oral: el carbón adsorbe también el fármaco que se quiere que actúe",
      "Vigilar 4 horas tras darlo por si aparecen signos de HIPERNATREMIA: ataxia, temblores, convulsiones. La presentación con sorbitol arrastra agua libre al intestino",
      "Mantener la hidratación del paciente; el catártico osmótico produce deshidratación e hipotensión",
      "Animal sin reflejo de deglución o deprimido: el carbón aspirado produce neumonía grave. Si no traga bien, no se le da por boca",
      "No sirve para todo: no adsorbe alcoholes, ácidos, álcalis ni metales como el hierro"
    ]
  },
  {
    slug: "azul-de-metileno",
    descripcion: "Antídoto de la metahemoglobinemia. Devuelve el hierro de la hemoglobina a su forma capaz de transportar oxígeno.",
    fuente: "FDA/DailyMed — METHYLENE BLUE INJECTION (etiqueta humana, con recuadro de advertencia; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "El recuadro de advertencia es de síndrome serotoninérgico: puede ser grave o mortal junto a fármacos serotoninérgicos y opioides. Evitar el uso concomitante con ISRS (fluoxetina), IRSN, IMAO y opioides",
      "Deficiencia de glucosa-6-fosfato deshidrogenasa: contraindicación expresa por riesgo de anemia hemolítica",
      "Hipersensibilidad grave al azul de metileno o a otros colorantes tiazínicos",
      "Gatos: los felinos son especialmente sensibles a los oxidantes; el propio azul de metileno puede producirles cuerpos de Heinz y hemólisis",
      "Extravasación: produce necrosis local",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "fomepizol",
    descripcion: "Inhibidor de la alcohol deshidrogenasa. Antídoto de la intoxicación por etilenglicol: impide que se convierta en el metabolito que destruye el riñón.",
    fuente: "FDA/DailyMed — FOMEPIZOLE INJECTION (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Antecedente de reacción de hipersensibilidad grave documentada al fomepizol o a otros pirazoles",
      "El factor decisivo es el TIEMPO, no la contraindicación: pasadas unas horas desde la ingestión el etilenglicol ya se ha metabolizado y el antídoto llega tarde. En el gato la ventana es todavía más corta que en el perro",
      "Se administra diluido y en infusión lenta",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "pralidoxima",
    descripcion: "Reactivador de la colinesterasa. Complemento de la atropina en la intoxicación por organofosforados.",
    fuente: "FDA/DailyMed — PROTOPAM CHLORIDE (pralidoxima cloruro, etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "La etiqueta dice que NO hay contraindicaciones absolutas. Las relativas son la hipersensibilidad conocida y las situaciones en que el riesgo supere claramente al beneficio",
      "NO sustituye a la atropina: la atropina es el tratamiento de los signos muscarínicos y se pone primero",
      "No sirve en intoxicación por fósforo, fosfatos inorgánicos ni organofosforados sin actividad anticolinesterásica: contraindicación expresa de la etiqueta",
      "La etiqueta señala que no está indicada como antídoto de plaguicidas de otro tipo: hay que saber qué producto se ingirió",
      "Pierde eficacia con las horas: cuando la unión enzima-tóxico envejece, ya no se puede reactivar",
      "Insuficiencia renal: se elimina por riñón",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "edta-calcico",
    descripcion: "Quelante del plomo. Forma un complejo estable que se elimina por orina.",
    fuente: "FDA/DailyMed — EDETATE CALCIUM DISODIUM INJECTION (etiqueta humana, con recuadro de advertencia; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Anuria: contraindicación expresa de la etiqueta",
      "Enfermedad renal activa: contraindicación expresa",
      "Hepatitis: contraindicación expresa",
      "El recuadro de advertencia dice que el producto puede producir efectos tóxicos mortales. No superar nunca la dosis diaria recomendada",
      "Encefalopatía por plomo con edema cerebral: la vía intravenosa puede elevar de forma letal la presión intracraneal. En esos casos se prefiere la intramuscular; si hay que usar la intravenosa, en infusión lenta",
      "Quela también cinc y otros metales esenciales: en tratamientos largos hay que reponerlos",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },

  /* ---------- Vitaminas y minerales ---------- */

  {
    slug: "complejo-b",
    descripcion: "Mezcla inyectable de vitaminas del grupo B. Se usa como apoyo en anorexia, estrés metabólico y en la deficiencia de tiamina.",
    fuente: "FDA/DailyMed — VITAMIN B COMPLEX HP INJECTION (etiqueta veterinaria, MWI)",
    contra: [
      "Se han notificado reacciones de tipo alérgico tras inyectar productos que contienen TIAMINA: la etiqueta pide administrar con precaución y mantener al animal en observación estrecha",
      "Hipersensibilidad conocida a cualquiera de las vitaminas del preparado",
      "Son hidrosolubles y el exceso se elimina por orina: el problema no es la acumulación, es la reacción a la inyección"
    ]
  },
  {
    slug: "cianocobalamina",
    descripcion: "Vitamina B12. Se administra en la malabsorción intestinal y en la insuficiencia pancreática exocrina, donde su déficit es habitual.",
    fuente: "FDA/DailyMed — VITAMIN B COMPLEX HP INJECTION (etiqueta veterinaria, que la incluye) y etiquetas humanas de cianocobalamina",
    contra: [
      "Hipersensibilidad conocida a la cianocobalamina o al cobalto",
      "Las reacciones de tipo alérgico descritas para los complejos vitamínicos inyectables aplican también aquí: observar al animal tras la inyección",
      "Es hidrosoluble y de gran margen: el exceso se elimina por orina",
      "Medir la cobalamina sérica antes y después tiene sentido; suplementar a ciegas no dice nada"
    ]
  },
  {
    slug: "vitamina-ad3e",
    descripcion: "Combinación inyectable de vitaminas liposolubles. Muy usada en producción como apoyo en carencias.",
    fuente: "Sin etiqueta específica de AD3E localizada en FDA/DailyMed. Los datos de toxicidad de las liposolubles proceden de las etiquetas de vitaminas A y D",
    contra: [
      "FUENTE PARCIAL. No se localizó una etiqueta de producto AD3E en las bases consultadas: revisar el prospecto del producto registrado en Ecuador",
      "Son vitaminas LIPOSOLUBLES: a diferencia de las del grupo B, se acumulan. La sobredosis repetida de vitamina D produce hipercalcemia y calcificación de tejidos blandos, y la de vitamina A, alteraciones óseas",
      "No repetir las dosis por rutina ni acortar los intervalos del prospecto",
      "Gestación: el exceso de vitamina A es teratogénico",
      "Hipercalcemia previa"
    ]
  },
  {
    slug: "vitamina-e-selenio",
    descripcion: "Combinación de selenio y tocoferol para la enfermedad del músculo blanco y otras miopatías nutricionales.",
    fuente: "FDA/DailyMed — BO-SE (selenito sódico y acetato de tocoferol, etiqueta veterinaria, Merck)",
    contra: [
      "Ovejas GESTANTES: la etiqueta lo prohíbe en mayúsculas. Se han notificado muertes y abortos en ovejas gestantes inyectadas con este producto",
      "Se han descrito reacciones anafilactoides, algunas mortales, con signos de excitación, sudoración, temblor, ataxia, dificultad respiratoria y disfunción cardiaca",
      "El selenio tiene margen terapéutico estrecho: la dosis tóxica está cerca de la eficaz. No repetir por rutina ni combinar varios productos con selenio a la vez",
      "El cuadro de deficiencia de selenio y tocoferol se parece a otras enfermedades: la etiqueta advierte de que hay que confirmar el diagnóstico antes de tratar"
    ]
  },
  {
    slug: "hierro-dextrano",
    descripcion: "Hierro inyectable de depósito. Prevención de la anemia ferropénica del lechón, que nace con muy pocas reservas.",
    fuente: "FDA/DailyMed — IRON HYDROGENATED DEXTRAN INJECTION (etiqueta veterinaria, MWI)",
    contra: [
      "Lechones nacidos de cerdas con deficiencia de VITAMINA E o de SELENIO: la etiqueta señala que el riesgo de toxicidad por hierro es mayor en ellos",
      "Los signos de intoxicación por hierro que describe la etiqueta son convulsiones, dificultad respiratoria, temblores o debilidad muscular, postración y muerte, además de reacción en el punto de inyección con inflamación, infección o necrosis",
      "No repetir la dosis ni adelantarla: el hierro parenteral no tiene vía de excreción, se acumula",
      "Respetar el punto de inyección que indique la etiqueta: la reacción local puede dejar residuo y lesión"
    ]
  },
  {
    slug: "calcio-borogluconato",
    descripcion: "Sal de calcio inyectable para grandes animales. Tratamiento de la fiebre de leche y de la tetania de la hierba.",
    fuente: "FDA/DailyMed — CALCIUM GLUCONATE INJECTION (etiqueta humana) para los efectos de clase de las sales de calcio inyectables",
    contra: [
      "Administrar SIEMPRE lento y con auscultación o electrocardiograma: la inyección rápida de calcio produce bradicardia, bloqueo y parada cardiaca. Es el error más frecuente y el más grave",
      "Hipercalcemia",
      "Suspender la infusión si aparece arritmia y reanudarla más despacio cuando el ritmo se normalice",
      "Extravasación: el calcio produce necrosis del tejido perivascular. La vía subcutánea deja lesión y abscesos",
      "Precaución con digitálicos: el calcio potencia sus efectos cardiacos",
      "Fuente de clase, de etiqueta humana de gluconato cálcico: comprobar el prospecto del producto veterinario registrado"
    ]
  },
  {
    slug: "propilenglicol",
    descripcion: "Precursor de glucosa. Se administra por boca en la cetosis del bovino lechero: el hígado lo convierte en glucosa.",
    fuente: "Cuerpos de Heinz en el gato: Christopher y col., Vet Pathol 1990, doi 10.1177/030098589002700501 · Hickman, Rogers y Morris, Am J Vet Res 1990;51(3):475-8",
    contra: [
      "GATOS: no usarlo ni en el alimento. El propilenglicol produce cuerpos de Heinz de forma dependiente de la dosis y acorta la vida del eritrocito. En el estudio de 1990 todos los gatitos alimentados con propilenglicol desarrollaron cuerpos de Heinz (hasta el 36 %) y la vida media del eritrocito bajó de 12,6 a 8,3 días. Los cuerpos de Heinz tardaron de 6 a 8 semanas en desaparecer tras retirarlo",
      "El bazo del gato no filtra bien los eritrocitos con cuerpos de Heinz, lo que agrava el problema en esta especie",
      "Bovino: la sobredosis produce depresión del sistema nervioso central y ataxia. Respetar la dosis, no es un producto inocuo por ser oral",
      "No se localizó etiqueta de medicamento registrado: las contraindicaciones anteriores proceden de literatura revisada por pares"
    ]
  },
  {
    slug: "sulfato-de-magnesio",
    descripcion: "Sal de magnesio inyectable. Tratamiento de la hipomagnesemia y antiarrítmico en algunas taquicardias ventriculares refractarias.",
    fuente: "FDA/DailyMed — MAGNESIUM SULFATE IN WATER INJECTION (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Insuficiencia renal: contraindicación de peso, porque el magnesio se elimina SOLO por riñón y se acumula hasta producir bloqueo neuromuscular y parada",
      "La etiqueta lo contraindica por vía intravenosa en las dos horas previas al parto en la hembra con toxemia gestacional",
      "Administración prolongada durante la gestación: la etiqueta describe hipocalcemia y desmineralización ósea en el feto",
      "Bloqueo auriculoventricular",
      "Administrar lento y vigilando: la sobredosis produce hipotensión, depresión respiratoria y paro. El antídoto es el calcio intravenoso",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },

  /* ---------- Hematológicos ---------- */

  {
    slug: "acido-tranexamico",
    descripcion: "Antifibrinolítico. Impide que el coágulo se disuelva; se usa en hemorragias y en el traumatismo con sangrado activo.",
    fuente: "FDA/DailyMed — TRANEXAMIC ACID INJECTION (etiqueta humana, con recuadro de advertencia; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "El recuadro de advertencia es de VÍA: es solo para uso intravenoso. Administrado por vía neuroaxial (intratecal o epidural) ha producido reacciones graves y mortales, con convulsiones y arritmias",
      "Coagulación intravascular activa: contraindicación expresa",
      "Hemorragia subaracnoidea: contraindicación expresa, se han descrito edema e infarto cerebral",
      "Hipersensibilidad al ácido tranexámico o a cualquier ingrediente",
      "Produce vómito con frecuencia en el perro cuando se administra rápido: pasarlo diluido y lento",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "clopidogrel",
    descripcion: "Antiagregante plaquetario. Se usa en el gato con cardiomiopatía para prevenir el tromboembolismo aórtico.",
    fuente: "FDA/DailyMed — CLOPIDOGREL TABLET (etiqueta humana, con recuadro de advertencia; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Sangrado patológico activo, como úlcera péptica o hemorragia intracraneal: contraindicación expresa",
      "Hipersensibilidad al clopidogrel o a cualquier componente",
      "Cirugía programada: el efecto antiagregante dura toda la vida de la plaqueta, varios días. Hay que suspenderlo con antelación",
      "El recuadro de advertencia trata de los metabolizadores lentos de CYP2C19, en los que el fármaco se activa mal. En veterinaria no se genotipa, pero explica por qué algunos pacientes no responden",
      "No hay antídoto: el sangrado se maneja con transfusión de plaquetas",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "heparina-sodica",
    descripcion: "Anticoagulante que potencia la antitrombina. Se usa en tromboembolismo y en coagulación intravascular diseminada.",
    fuente: "FDA/DailyMed — HEPARIN SODIUM INJECTION (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Antecedente de trombocitopenia inducida por heparina, con o sin trombosis: contraindicación expresa",
      "Hipersensibilidad conocida a la heparina o a productos porcinos: puede dar reacciones anafilactoides",
      "Sangrado activo no controlado, salvo que se deba a coagulación intravascular diseminada",
      "Trombocitopenia grave",
      "La etiqueta la contraindica cuando NO se pueden hacer los controles de coagulación a los intervalos adecuados: sin tiempo de tromboplastina parcial no se puede dosificar con seguridad",
      "El antídoto es el sulfato de protamina, que hay que tener localizado antes de empezar",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },

  /* ---------- Antisépticos y dermatológicos ---------- */

  {
    slug: "clorhexidina",
    descripcion: "Antiséptico de amplio espectro con efecto residual prolongado. Base de la preparación quirúrgica y del lavado de heridas.",
    fuente: "FDA/DailyMed — CHLORHEXIDINE GLUCONATE ORAL RINSE (etiqueta humana)",
    contra: [
      "Hipersensibilidad conocida al gluconato de clorhexidina o a cualquier componente de la fórmula",
      "GATOS: la clorhexidina es tóxica para el epitelio respiratorio del gato; no debe nebulizarse ni usarse en concentraciones altas en vías respiratorias altas",
      "No usar dentro del oído si el tímpano está roto o no se ha podido comprobar: es ototóxica",
      "No usar en el ojo ni cerca de él: causa lesión corneal",
      "No usar en heridas profundas ni en cavidades: irrita el tejido de granulación y retrasa la cicatrización",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "yodo-povidona",
    descripcion: "Antiséptico yodóforo. Amplio espectro, incluidas esporas, pero pierde actividad en presencia de materia orgánica.",
    fuente: "FDA/DailyMed — POVIDONE-IODINE 5% FIRST AID ANTISEPTIC (etiqueta humana de venta libre)",
    contra: [
      "Solo para uso externo",
      "No usar en los ojos",
      "No usar sobre grandes superficies corporales: contraindicación expresa de la etiqueta, por absorción sistémica de yodo",
      "No usar más de una semana seguida sin criterio veterinario",
      "Heridas profundas o punzantes, mordeduras de animal y quemaduras graves: la etiqueta pide valoración profesional antes de aplicarlo",
      "Gatos y animales pequeños: la absorción de yodo por piel lesionada puede alterar la función tiroidea",
      "Dato de etiqueta humana de venta libre: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "peroxido-de-hidrogeno",
    descripcion: "Agua oxigenada. Antiséptico de contacto que actúa por liberación de oxígeno; su efecto es breve y superficial.",
    fuente: "FDA/DailyMed — AEROAID (peróxido de hidrógeno, etiqueta humana de venta libre)",
    contra: [
      "Solo para uso externo",
      "No usar cerca de los ojos ni sobre mucosas: contraindicación expresa de la etiqueta",
      "No usar sobre grandes superficies corporales",
      "Heridas profundas o punzantes, mordeduras de animal y quemaduras graves: la etiqueta pide valoración profesional",
      "No usar en cavidades cerradas ni en trayectos fistulosos: el oxígeno liberado no tiene salida y puede producir embolia gaseosa",
      "Es citotóxico para el tejido de granulación: sirve para limpiar una herida sucia, no para curarla día tras día",
      "Dato de etiqueta humana de venta libre: en veterinaria el uso es fuera de etiqueta"
    ]
  },
  {
    slug: "sulfadiazina-de-plata",
    descripcion: "Antibacteriano tópico para quemaduras. Combina la acción de la plata con la de una sulfonamida.",
    fuente: "FDA/DailyMed — SILVER SULFADIAZINE CREAM 1% (etiqueta humana; en veterinaria el uso es fuera de etiqueta)",
    contra: [
      "Hipersensibilidad a la sulfadiazina de plata o a cualquier otro ingrediente de la preparación",
      "Hembras gestantes próximas al parto y neonatos en los dos primeros meses de vida: contraindicación expresa de la etiqueta, porque las sulfonamidas aumentan el riesgo de kernícterus",
      "Superficies extensas: la absorción depende del porcentaje de superficie corporal y de la profundidad de la lesión, y puede dar cualquiera de los efectos adversos de las sulfonamidas",
      "Insuficiencia hepática o renal: si la eliminación baja, el fármaco se acumula",
      "Dato de etiqueta humana: en veterinaria el uso es fuera de etiqueta"
    ]
  }

];

/* ============================================================
   MOMENTO DE USO — el segundo eje de la lista
   ============================================================

   La familia contesta "¿qué es esto?". Esto contesta "¿cuándo lo
   agarro?". Son dos preguntas distintas y por eso son dos ejes, no uno
   que sustituye al otro: la familia sirve para buscar una alternativa o
   pensar una interaccion; el momento sirve con el animal delante.

   Un farmaco puede llevar DOS cajones y salir en los dos. La ketamina es
   de anestesia y de urgencias, y esconderla en uno solo seria peor que
   repetirla. Dos es el tope: con tres, el eje deja de separar nada.

   Esto es criterio de uso, no dato de etiqueta, asi que NO lleva fuente y
   NO pretende tenerla. Es una estanteria: se corrige desde la ficha
   cuando no coincida con como trabaja Daniel.

   Claves validas: urgencias · anestesia · diaria · cronico · hato
   ============================================================ */

export const MOMENTOS = [
  { clave: "urgencias", etiqueta: "Urgencias", icono: "🚨", nota: "Lo del carro de paro y lo que se agarra corriendo." },
  { clave: "anestesia", etiqueta: "Anestesia y cirugía", icono: "💉", nota: "Lo que se prepara antes de entrar a la mesa." },
  { clave: "diaria", etiqueta: "Consulta diaria", icono: "🩺", nota: "Lo que sale casi todos los días en consulta." },
  { clave: "cronico", etiqueta: "Tratamiento crónico", icono: "📅", nota: "Lo que el dueño se lleva a casa durante meses." },
  { clave: "hato", etiqueta: "Hato y producción", icono: "🐄", nota: "Ganado: reproducción, desparasitación y carencias." }
];

export const MOMENTO_DE_USO = {
  /* --- Antibacterianos --- */
  "amoxicilina": ["diaria"],
  "amoxicilina-clavulanico": ["diaria"],
  "ampicilina": ["diaria"],
  "penicilina-g": ["diaria", "hato"],
  "cefalexina": ["diaria"],
  "ceftiofur": ["hato"],
  "enrofloxacina": ["diaria", "hato"],
  "marbofloxacina": ["diaria"],
  "oxitetraciclina-la": ["hato"],
  "doxiciclina": ["diaria"],
  "gentamicina": ["diaria"],
  "amikacina": ["diaria"],
  "florfenicol": ["hato"],
  "tilosina": ["hato"],
  "tulatromicina": ["hato"],
  "trimetoprim-sulfa": ["diaria", "hato"],
  "metronidazol": ["diaria"],

  /* --- AINEs y analgesia --- */
  "meloxicam": ["diaria"],
  "carprofeno": ["diaria"],
  "firocoxib": ["diaria"],
  "flunixin": ["hato"],
  "ketoprofeno": ["diaria", "hato"],
  "fenilbutazona": ["diaria"],
  "dipirona": ["urgencias"],
  "morfina": ["anestesia"],
  "metadona": ["anestesia"],
  "buprenorfina": ["anestesia"],
  "butorfanol": ["anestesia"],
  "fentanilo": ["anestesia"],
  "tramadol": ["anestesia", "diaria"],

  /* --- Anestesia y sedacion --- */
  "propofol": ["anestesia", "urgencias"],
  "ketamina": ["anestesia", "urgencias"],
  "alfaxalona": ["anestesia"],
  "isoflurano": ["anestesia"],
  "sevoflurano": ["anestesia"],
  "xilacina": ["anestesia", "hato"],
  "dexmedetomidina": ["anestesia"],
  "acepromacina": ["anestesia"],
  "midazolam": ["anestesia", "urgencias"],
  "diazepam": ["urgencias", "anestesia"],
  "lidocaina": ["anestesia", "urgencias"],
  "bupivacaina": ["anestesia"],
  "atropina": ["urgencias", "anestesia"],

  /* --- Antiparasitarios --- */
  "ivermectina": ["diaria", "hato"],
  "doramectina": ["hato"],
  "selamectina": ["diaria"],
  "fenbendazol": ["diaria", "hato"],
  "albendazol": ["hato"],
  "praziquantel": ["diaria"],
  "pirantel": ["diaria"],
  "afoxolaner": ["diaria"],
  "fluralaner": ["diaria"],
  "toltrazuril": ["hato"],
  "amprolio": ["hato"],

  /* --- Corticoides --- */
  "dexametasona": ["urgencias", "diaria"],
  "prednisolona": ["diaria", "cronico"],

  /* --- Diureticos, fluidos y electrolitos --- */
  "furosemida": ["urgencias", "cronico"],
  "espironolactona": ["cronico"],
  "hidroclorotiazida": ["cronico"],
  "torasemida": ["cronico"],
  "manitol": ["urgencias"],
  "gluconato-calcio": ["urgencias"],
  "cloruro-potasio": ["urgencias"],
  "bicarbonato-sodio": ["urgencias"],
  "dextrosa": ["urgencias"],

  /* --- Digestivos --- */
  "maropitant": ["diaria"],
  "ondansetron": ["diaria"],
  "metoclopramida": ["diaria"],
  "omeprazol": ["diaria"],
  "pantoprazol": ["diaria"],
  "famotidina": ["diaria"],
  "sucralfato": ["diaria"],
  "butilescopolamina": ["urgencias"],
  "silimarina": ["cronico"],
  "sam-e": ["cronico"],
  "lactulosa": ["cronico"],
  "caolin-pectina": ["diaria"],
  "probiotico-enterococcus": ["diaria"],

  /* --- Cardiovasculares --- */
  "pimobendan": ["cronico"],
  "benazepril": ["cronico"],
  "enalapril": ["cronico"],
  "digoxina": ["cronico"],
  "diltiazem": ["cronico", "urgencias"],
  "amlodipino": ["cronico"],
  "atenolol": ["cronico"],
  "sotalol": ["cronico"],
  "dobutamina": ["urgencias"],
  "dopamina": ["urgencias"],
  "epinefrina": ["urgencias"],
  "norepinefrina": ["urgencias"],

  /* --- Respiratorios --- */
  "aminofilina": ["cronico"],
  "teofilina": ["cronico"],
  "salbutamol": ["urgencias", "cronico"],
  "terbutalina": ["urgencias"],
  "bromhexina": ["diaria"],
  "ambroxol": ["diaria"],
  "n-acetilcisteina": ["urgencias", "diaria"],

  /* --- Antihistaminicos --- */
  "difenhidramina": ["urgencias", "diaria"],
  "clorfenamina": ["diaria"],
  "hidroxicina": ["diaria"],
  "cetirizina": ["diaria"],
  "loratadina": ["diaria"],

  /* --- Antifungicos --- */
  "itraconazol": ["diaria"],
  "ketoconazol": ["diaria"],
  "fluconazol": ["diaria"],
  "terbinafina": ["diaria"],
  "griseofulvina": ["diaria"],
  "anfotericina-b": ["cronico"],
  "nistatina": ["diaria"],

  /* --- Hormonales y reproductivos --- */
  "oxitocina": ["urgencias", "hato"],
  "cloprostenol": ["hato"],
  "gonadorelina": ["hato"],
  "hcg": ["hato"],
  "ecg-pmsg": ["hato"],
  "altrenogest": ["hato"],
  "medroxiprogesterona": ["cronico"],
  "deslorelina": ["cronico"],
  "levotiroxina": ["cronico"],
  "metimazol": ["cronico"],
  "trilostano": ["cronico"],
  "insulina-nph": ["cronico"],
  "insulina-glargina": ["cronico"],
  "desmopresina": ["cronico"],

  /* --- Neurologicos --- */
  "fenobarbital": ["cronico", "urgencias"],
  "bromuro-de-potasio": ["cronico"],
  "levetiracetam": ["cronico", "urgencias"],
  "imepitoina": ["cronico"],
  "gabapentina": ["cronico"],
  "pregabalina": ["cronico"],
  "fluoxetina": ["cronico"],
  "trazodona": ["cronico"],

  /* --- Antidotos y reversores --- */
  "atipamezol": ["anestesia", "urgencias"],
  "naloxona": ["urgencias", "anestesia"],
  "flumazenilo": ["urgencias", "anestesia"],
  "vitamina-k1": ["urgencias"],
  "carbon-activado": ["urgencias"],
  "azul-de-metileno": ["urgencias"],
  "fomepizol": ["urgencias"],
  "pralidoxima": ["urgencias"],
  "edta-calcico": ["urgencias"],

  /* --- Vitaminas y minerales --- */
  "complejo-b": ["diaria", "hato"],
  "cianocobalamina": ["diaria"],
  "vitamina-ad3e": ["hato"],
  "vitamina-e-selenio": ["hato"],
  "hierro-dextrano": ["hato"],
  "calcio-borogluconato": ["urgencias", "hato"],
  "propilenglicol": ["hato"],
  "sulfato-de-magnesio": ["urgencias", "hato"],

  /* --- Hematologicos --- */
  "acido-tranexamico": ["urgencias", "anestesia"],
  "clopidogrel": ["cronico"],
  "heparina-sodica": ["urgencias"],

  /* --- Antisepticos --- */
  "clorhexidina": ["anestesia", "diaria"],
  "yodo-povidona": ["anestesia", "diaria"],
  "peroxido-de-hidrogeno": ["diaria"],
  "sulfadiazina-de-plata": ["diaria"]
};

/* ============================================================
   PENETRACIÓN TISULAR
   ============================================================

   A dónde llega el fármaco. Es un dato distinto de la descripción y por eso
   va en campo aparte, con su propia fuente: la descripción dice qué es, esto
   dice dónde alcanza concentración útil.

   ------------------------------------------------------------
   POR QUÉ ESTO NO ES UN EJE DE CLASIFICACIÓN
   ------------------------------------------------------------
   La penetración es real y está documentada, pero NO sirve para meter cada
   fármaco en un órgano. Un antibiótico se elige por el germen, no por el
   sitio: una cistitis por E. coli y una piodermia por Staphylococcus están
   en órganos distintos y pueden llevar el mismo fármaco.

   Por eso esto vive DENTRO de la ficha, cuando ya estás decidiendo, y no
   como cajón de la lista. Un fármaco puede tener tres frases de penetración;
   un cajón solo admite una.

   ------------------------------------------------------------
   SOLO LO QUE ESTÁ ESCRITO EN ALGUNA PARTE
   ------------------------------------------------------------
   Aquí hay 20 fármacos de 155. Los otros 135 NO están porque su etiqueta no
   dice nada de distribución tisular, no porque se me haya olvidado. Rellenar
   los huecos de memoria sería exactamente lo que este archivo no hace.

   Si un fármaco no aparece, su ficha deja el campo vacío. Vacío es la
   respuesta correcta cuando no hay fuente.
   ============================================================ */

export const PENETRACION = {
  "amoxicilina": {
    texto: "Difunde con facilidad a la mayoría de tejidos y líquidos corporales, CON LA EXCEPCIÓN del cerebro y el líquido cefalorraquídeo. Unión a proteínas baja (≈18 %).",
    fuente: "FDA/DailyMed — etiqueta humana de amoxicilina/clavulánico, sección Clinical Pharmacology"
  },
  "amoxicilina-clavulanico": {
    texto: "Difunde con facilidad a la mayoría de tejidos y líquidos, salvo cerebro y líquido cefalorraquídeo. Ninguno de los dos componentes se une mucho a proteínas: clavulánico ≈25 %, amoxicilina ≈18 %.",
    fuente: "FDA/DailyMed — etiqueta humana de amoxicilina/clavulánico, sección Clinical Pharmacology"
  },
  "cefalexina": {
    texto: "Unión a proteínas baja (10-15 %). Alcanza concentraciones muy altas en ORINA: del orden de 1000 a 5000 µg/mL según la dosis. La etiqueta no describe penetración en sistema nervioso.",
    fuente: "FDA/DailyMed — CEPHALEXIN CAPSULE (etiqueta humana), sección Clinical Pharmacology"
  },
  "doxiciclina": {
    texto: "Lipófila y con unión a proteínas alta (≈92 %), lo que le permite alcanzar el interior de la célula: por eso funciona contra Wolbachia, rickettsias y micoplasma. Se concentra en bilis y se elimina activa por orina y heces.",
    fuente: "Papich, Parasit Vectors 2017, doi 10.1186/s13071-017-2449-1 (unión a proteínas y lipofilia) · FDA/DailyMed — DOXYCYCLINE (etiqueta humana), sección Clinical Pharmacology (bilis y excreción)"
  },
  "gentamicina": {
    texto: "Se distribuye en el LÍQUIDO EXTRACELULAR, no dentro de la célula. Alcanza más de 100 µg/mL en orina. Una parte queda retenida en el tejido, sobre todo en el RIÑÓN — de ahí su nefrotoxicidad. Si la función renal está dañada, penetra peor en el propio parénquima renal.",
    fuente: "FDA/DailyMed — GENTAMICIN SULFATE INJECTION (etiqueta humana), sección Clinical Pharmacology"
  },
  "amikacina": {
    texto: "Como los demás aminoglucósidos, queda sobre todo en el espacio EXTRACELULAR. A dosis recomendadas alcanza concentraciones útiles en hueso, corazón, vesícula biliar y pulmón, y concentraciones altas en orina, bilis y esputo. Cruza la placenta y alcanza el líquido amniótico.",
    fuente: "FDA/DailyMed — AMIKACIN SULFATE INJECTION (etiqueta humana), sección Clinical Pharmacology"
  },
  "marbofloxacina": {
    texto: "Ampliamente distribuida en los tejidos del perro. La etiqueta veterinaria trae las concentraciones tisulares medidas en beagles a las 2, 18 y 24 horas de una dosis oral.",
    fuente: "FDA/DailyMed — MARBOFLOXACIN TABLET (etiqueta veterinaria), sección Clinical Pharmacology"
  },
  "metronidazol": {
    texto: "Alcanza el LÍQUIDO CEFALORRAQUÍDEO, la saliva y la leche en concentraciones parecidas a las del plasma. Entra en la bacteria por difusión pasiva y se activa dentro: eso mantiene un gradiente que favorece su entrada.",
    fuente: "FDA/DailyMed — METRONIDAZOLE TABLET (etiqueta humana), sección Clinical Pharmacology — Distribution"
  },
  "trimetoprim-sulfa": {
    texto: "Las concentraciones en ORINA son bastante más altas que en sangre. Ambos llegan a esputo, líquido vaginal y oído medio; el trimetoprim además a las secreciones bronquiales. Los dos cruzan la placenta y pasan a la leche.",
    fuente: "FDA/DailyMed — SULFAMETHOXAZOLE AND TRIMETHOPRIM TABLET (etiqueta humana), sección Clinical Pharmacology"
  },
  "tulatromicina": {
    texto: "Alcanza concentraciones MARCADAMENTE más altas en el parénquima PULMONAR que en plasma, y se mantienen ahí varios días después de dejar de medirse en sangre. La propia etiqueta advierte de que la relevancia clínica de esas concentraciones no está determinada.",
    fuente: "FDA/DailyMed — DRAXXIN 25 (tulatromicina, etiqueta veterinaria, Zoetis), sección Clinical Pharmacology"
  },
  "itraconazol": {
    texto: "Volumen de distribución enorme (>700 L). En pulmón, riñón, hígado, hueso, estómago, bazo y músculo alcanza 2-3 veces la concentración del plasma, y en tejido queratinizado —PIEL sobre todo— hasta 4 veces. En LÍQUIDO CEFALORRAQUÍDEO, mucho MENOS que en plasma. De la queratina no vuelve: se elimina al regenerarse la epidermis, y por eso el tratamiento dura lo que tarde en crecer el pelo.",
    fuente: "FDA/DailyMed — ITRACONAZOLE CAPSULE (etiqueta humana), sección Clinical Pharmacology — Distribution"
  },
  "ketoconazol": {
    texto: "Ampliamente distribuido en los tejidos, pero al LÍQUIDO CEFALORRAQUÍDEO llega una proporción despreciable. Se elimina sobre todo por bilis: alrededor del 57 % aparece en heces.",
    fuente: "FDA/DailyMed — KETOCONAZOLE TABLET (etiqueta humana), sección Clinical Pharmacology — Distribution"
  },
  "fluconazol": {
    texto: "Se reparte como el agua corporal total y penetra en todos los líquidos estudiados. En meningitis fúngica alcanza en LÍQUIDO CEFALORRAQUÍDEO alrededor del 80 % de la concentración plasmática — es el azol de elección cuando hay que llegar al sistema nervioso.",
    fuente: "FDA/DailyMed — DIFLUCAN (fluconazol, etiqueta humana), sección Clinical Pharmacology"
  },
  "terbinafina": {
    texto: "Se distribuye al SEBO y a la PIEL. Su semivida terminal de 200 a 400 horas refleja lo despacio que sale de tejidos como la piel y la grasa: sigue actuando mucho después de la última toma.",
    fuente: "FDA/DailyMed — TERBINAFINE TABLET (etiqueta humana), sección Clinical Pharmacology"
  },
  "griseofulvina": {
    texto: "Se deposita en las células precursoras de QUERATINA y tiene más afinidad por el tejido enfermo. Queda fuertemente unida a la queratina nueva, que se vuelve resistente a la invasión del hongo: el tratamiento dura hasta que crece todo el pelo o la uña.",
    fuente: "FDA/DailyMed — GRISEOFULVIN SUSPENSION (etiqueta humana), sección Clinical Pharmacology"
  },
  "nistatina": {
    texto: "NO se absorbe de forma significativa desde el tubo digestivo. Actúa solo donde toca: por eso sirve en candidiasis de mucosas y de piel, y no sirve para ninguna micosis sistémica.",
    fuente: "FDA/DailyMed — NYSTATIN SUSPENSION (etiqueta humana), sección Indications and Usage"
  },
  "fenobarbital": {
    texto: "Se absorbe y se distribuye rápido a todos los tejidos y líquidos, con concentraciones ALTAS EN CEREBRO, hígado y riñón. Cuanto más liposoluble es un barbitúrico, antes penetra en todos los tejidos.",
    fuente: "FDA/DailyMed — PHENOBARBITAL TABLET (etiqueta humana), sección Clinical Pharmacology"
  },
  "gabapentina": {
    texto: "Casi no se une a proteínas (menos del 3 %). En pacientes epilépticos, la concentración en LÍQUIDO CEFALORRAQUÍDEO antes de la dosis siguiente es alrededor del 20 % de la plasmática.",
    fuente: "FDA/DailyMed — GABAPENTIN CAPSULE (etiqueta humana), sección Clinical Pharmacology — Distribution"
  },
  "levetiracetam": {
    texto: "Prácticamente no se une a proteínas (menos del 10 %) y su volumen de distribución se aproxima al del agua corporal, intracelular y extracelular. Eso explica que apenas tenga interacciones por desplazamiento de otros fármacos.",
    fuente: "FDA/DailyMed — LEVETIRACETAM INJECTION (etiqueta humana), sección Clinical Pharmacology — Distribution"
  },
  "ivermectina": {
    texto: "La glicoproteína P de la barrera hematoencefálica la mantiene FUERA del sistema nervioso central. Esa es toda su seguridad: en los perros con la mutación ABCB1-1Δ (MDR1) la proteína es no funcional, la ivermectina entra al cerebro y aparece la neurotoxicidad.",
    fuente: "Deshpande y col., J Vet Intern Med 2016, doi 10.1111/jvim.13827 (perros ABCB1-1Δ y su susceptibilidad a ivermectina, loperamida y vincristina)"
  }
};
