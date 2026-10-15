# CLAUDE.md

Guía para trabajar en este repositorio.

**Idioma**: todo lo que se publica está **en inglés** — los comentarios del
código, los nombres de los tests, el README y el CHANGELOG. Mantén esa
convención al tocar `src/`. Este fichero es la excepción y va en español: es la
guía interna, no viaja en el `.vsix` (lo excluye `.vscodeignore`) y no la lee
nadie de fuera. Es la misma regla que sigue Atria, la extensión hermana.

**Y es el ÚNICO documento interno.** Fueron cinco capas —este fichero, un
`ARCHITECTURE.md`, un agente de Copilot en `.github/agents/`, un `AGENT.md` por
carpeta de `src/` y una guía didáctica en `docs/`— con 7598 líneas entre todas.
Lo que las tumbó no es el tamaño sino que **el mismo hecho estaba escrito en
cinco sitios**: el día que el shell dejó de reasignarse se corrigieron dos, y las
otras tres siguieron diciendo que `refresh()` escribe `webview.html`. Ninguno de
los dos checks podía verlo — comprueban que una RUTA exista y que un
IDENTIFICADOR exista, no que la frase de alrededor siga siendo verdad.

Lo que se conservó de aquellas capas es lo que ninguna otra cosa dice: los
invariantes, los casos que se aprendieron a base de romperse y lo que cuesta cada
decisión. Lo que se tiró son unas 2000 líneas de «REAL OBSERVED EXAMPLES»
—trazas en YAML narrando paso a paso lo que el código hace— y unas 600 de
catálogos de cadenas de log. Las dos cosas se pudren en silencio y las dos se
leen mejor en el código.

**Puntuación de lo que se publica**: nada de RAYAS (`—`, `–`) ni de comillas
tipográficas (`’`, `“`, `”`) en el README, el CHANGELOG y las cadenas
localizadas. Se leen como texto de máquina, que es exactamente lo que una ficha
de marketplace no puede parecer. Cada raya se sustituye por lo que de verdad
estaba haciendo, y hay que mirarla una a una: dos puntos cuando lo que sigue
explica lo de antes, paréntesis cuando es una enumeración metida en medio, coma
cuando el inciso es corto, y punto y frase nueva cuando eran dos ideas. Un
reemplazo a ciegas por guiones deja la prosa peor que como estaba.

Tres excepciones, y las tres son de verdad:

- **Los `…` de una etiqueta de UI** (*Move to Group…*, *Rename Group…*, *Set
  Group Color…*) se quedan: en VS Code ese carácter significa «esto abre un
  diálogo», así que quitarlo cambia lo que la etiqueta promete. Lo mismo las
  flechas cuando nombran una tecla.
- **El chino y el japonés se quedan como están.** En chino `“”` son las comillas
  nativas y `——` es el guión estándar; sustituirlos por ASCII no despersonaliza
  la traducción, la escribe mal. Lo que sí se corrige ahí es una raya SUELTA al
  modo inglés, que es un calco del original y no tipografía de la lengua. Hoy no
  la usa nadie —los bundles son catalán y español— y la excepción se queda
  escrita en el escaneo porque es la regla y no un caso.
- **Este fichero y los comentarios del código**, por lo mismo que la regla de
  idioma de arriba: son internos, no viajan en el `.vsix` y están escritos con
  esa voz de cabo a rabo.

**Lo barre `check-docs`**, sobre lo que se publica: el README, el CHANGELOG, los
`package.nls*` y los bundles de `l10n/`. Lo que el check **no** decide es el
reemplazo: cuál toca es un juicio por frase, y por eso corta en vez de arreglar.

## Cómo se llama

**Dos nombres y una regla: EDITORS puede ir solo, BAYS no.** Es el mismo trato
que hace Atria (*Atria Navigator* fuera, *Navigator* dentro), y por las mismas
razones.

| superficie | nombre |
|---|---|
| `displayName`, o sea el título del marketplace | **Bays (SideTabs)** |
| Todo lo que se lee DENTRO de la ventana: la barra de actividad, la vista, la sección de ajustes, la categoría de los comandos y el canal de salida | **Editors** |
| Cada FILA de la lista | una **bay** (*Close Bay*, *Pin Bay*, *Reorder Bays*) |
| `name`, `publisher`, el prefijo `bays.`, ids y claves guardadas | **sin tocar** |

- **La barra de actividad es una fila de NOMBRES COMUNES** —Explorer, Search,
  Source Control— y un nombre propio ahí sobresale como un anuncio. *Editors* es
  además lo que la vista ES: la sección *Open Editors* del explorador, con sitio.
- **`Editors` a secas se rechazó como TÍTULO**: es un nombre común, así que en
  el marketplace no identifica nada y puede estar cogido —el título es lo único
  que se comprueba por unicidad—.
- **Y el paréntesis es CONTINUIDAD, no una palabra clave.** Esto tiene un
  pasado: *SideTabs* es la extensión de la que Bays es la continuación, así que
  hay gente que busca por aquel nombre lo que ya tenía, y el título es lo único
  que puede contestarles. Ni los `keywords` ni la descripción llegan ahí: se
  leen después de haber encontrado la ficha, y el problema es encontrarla. De ahí
  la forma —la marca, y entre paréntesis de dónde viene— que es además por lo que
  el paréntesis no se queda para siempre: cuando ya no quede nadie buscando
  *SideTabs*, lo que sobra es el paréntesis y no la marca.
- **Y la fila sigue siendo una bay**, que es lo que hace coherente el título: una
  bay es el hueco donde se aparca un editor. Renombrarla a *editor* dejaría
  `Editors: Close Editor` letra por letra igual que el `View: Close Editor` del
  workbench en la paleta.
- **El renombrado no movió NADA guardado**: `name` sigue siendo `bays`, así que
  el id, la URL, las instalaciones y `@ext:Lovervoid.bays` son los de siempre.
  El almacén de la extensión va indexado por ese id, y moverlo habría
  perdido grupos, colores y orden en todas las ventanas.
- **Los textos de `capabilities.*` dicen «la extensión»** y no un nombre: son
  el único sitio donde el manifiesto habla de sí mismo en prosa, y ahí los dos
  nombres estarían igual de fuera de sitio.

## Cómo contestar en el chat

**Corto.** Contexto en una línea, el bug, el cambio, y lo que cuesta. Nada de
folios: quien lee esto tiene TDA y un muro de texto no se lee, se salta — así
que una respuesta larga no es más útil, es menos.

Sirve para el CHAT y no para el repo: los comentarios del código, los mensajes
de commit y este fichero siguen explicando el porqué entero, porque ahí se leen
una vez y se consultan cuando hacen falta. Lo que se recorta es la conversación.

Reglas prácticas: la conclusión primero; una tabla antes que tres párrafos; los
detalles solo si se piden; y no repetir en prosa lo que ya dice un diff o un
comando en verde.

## Tareas — el tablero de Trello

**Tablero:** [Bays](https://trello.com/b/xNWbjyaN/bays) (workspace *Proyectos*). Es uno por proyecto: Atria,
Bays y Dark Mode Lover son tres repos que solo comparten el `Lovervoid.code-workspace` que
los abre juntos, y cada uno lleva su tablero y esta misma sección con sus ids. **Manda el
tablero**, no el doc: el estado vivo de cada tarea está en Trello. Se opera con las
herramientas MCP de Trello (`trelloWriteCard` · `trelloReadCard` · …).

**Un documento apunta, no repite.** Si algo del repo habla de una tarea, la enlaza por su
número —`[#12](https://trello.com/c/<shortLink>)`— y no copia su título ni su estado, que
es lo primero que se desincroniza. Siempre como enlace, nunca un `#12` suelto. El doc se
queda con lo que no cabe en una tarjeta: el porqué, el orden entre tareas, lo descartado.
`plan-backlog.md` sigue siendo el buzón de notas sin trackear, no un segundo tablero: lo
que de ahí se decide hacer pasa a tarjeta.

**Listas** (prefijo `ari:cloud:trello::list/workspace/61a4866a8aeb30111cab2111/`):

| Lista | Para qué | id |
|---|---|---|
| Backlog | Lo que toca, ordenado por prioridad (`pos` 1…N) | `6a3c3e08f17c9fb289efb066` |
| En proceso | Solo lo que tiene trabajo abierto ahora mismo | `6a3c3e08f17c9fb289efb067` |
| Por verificar | Código hecho y commiteado; falta la prueba real (F5, el `.vsix`) o una decisión de Alfonso | `6ab272b9224daf0443507d0e` |
| Hecho | Cerrado | `6a3c3e08f17c9fb289efb068` |
| Planes de futuro | Ideas grandes sin fecha: se apuntan para no perderlas, no para hacerlas ya | `6ab272bae2909e76f027fde8` |
| Aparcado | Empezado o decidido, pero bloqueado por algo concreto y nombrado | `6ab272bcb28265a526a9f0e1` |

*Aparcado* y *Planes de futuro* no son lo mismo: lo aparcado espera a que se quite un
bloqueo concreto; un plan de futuro espera a que se decida hacerlo.

**Etiquetas** (prefijo `ari:cloud:trello::label/workspace/61a4866a8aeb30111cab2111/`): una
de área por tarjeta, y *Avería* encima si además está roto en lo publicado o bloquea.
Aquí no hay colores a propósito: se cambian y la tabla envejecería sola. Lo que no cambia es
el id, que es lo que se pasa a `attach_label`.

| Etiqueta | Área | id |
|---|---|---|
| Filas | las filas de una bay, sus iconos y las variantes | `6a3c3e08f17c9fb289efb06e` |
| Grupos | los grupos y el arrastre entre ellos | `6a3c3e08f17c9fb289efb072` |
| Acciones | las acciones, los menús y los ajustes | `6a3c3e08f17c9fb289efb071` |
| Integración | git y lo que llega de otras extensiones | `6a3c3e08f17c9fb289efb06f` |
| Infra | build · checks · tests · docs · l10n · release | `6a3c3e08f17c9fb289efb06d` |
| Avería | roto en lo publicado / bloqueante (se suma al área) | `6a3c3e08f17c9fb289efb070` |

Ante duda, leer el tablero (`trelloReadBoard` → `list_labels`); esta tabla es un espejo, no
la fuente. Y un cambio que toca a los tres repos (los scripts de `scripts/` están copiados en
cada uno) es una tarjeta *Infra* en cada tablero donde aterriza, enlazadas entre sí.

### El flujo

Alfonso propone un cambio en conversación y no se hace en el acto → **creo la tarjeta**,
pensada y redactada, sin pedir permiso ni esperar a que diga "apunta esto". Si se hace en el
acto, no hay tarjeta: hay commit.

**Anatomía.** Título `#<n> [área] qué pasa, en una línea`, con el verbo o el síntoma
delante; nada de "revisar X". El área es el nombre de la etiqueta en minúscula y sin tilde
(`filas` · `grupos` · `acciones` · `integracion` · `infra`). El `<n>` es el **idShort de Trello**, el número que la tarjeta lleva en su URL
(`/c/<shortLink>/87-…`): no se inventa ni se lleva cuenta aparte. Trello no lo asigna hasta
que la tarjeta existe, así que crearla son dos pasos: `create` con el título sin número y
`update` con el `#<n>` delante, leído de la url que devuelve el create. Cuerpo:

```
**Qué pasa.** El problema o la oportunidad, con el porqué. Si hay una decisión de diseño
detrás, va aquí: la tarjeta tiene que valer sola dentro de tres meses, leída en frío.
**Dónde.** Rutas y símbolos reales (`fichero:línea` cuando se sepa).
**Hecho cuando.** Criterio observable. Nada de "funciona bien".
**Esfuerzo:** S/M/L · **Origen:** de dónde sale (conversación, bug, revisión…)
```

Lo que NO va: el plan de implementación paso a paso (eso se decide al hacerla), ni una
decisión ya tomada disfrazada de pregunta abierta.

**Movimientos.** Empiezo algo → *En proceso*. Termino el código pero no puedo verificarlo yo
→ *Por verificar*, con un "Te queda: …" concreto en la tarjeta. Lo cierro → *Hecho*
(`mark_done`), y si el cierre dejó una decisión que importa, la anoto en la tarjeta **antes**
de moverla. Lo que depende de otra cosa → *Aparcado*, diciendo de qué. Una tarea que resulta
ser el comportamiento correcto se cierra con el porqué escrito, no se borra.

**Un commit que menciona una tarjeta no la cierra.** Antes de mover algo a *Hecho* se
comprueba contra su "Hecho cuando" que está hecho de verdad.

**El orden del Backlog lo llevo yo**, con criterio y sin preguntar (Alfonso lo delegó el
2026-09-22): lo que se ve roto o se paga a diario y es barato va arriba, lo que depende de una
decisión suya o de trabajo manual va abajo, y lo que ni siquiera está decidido si se quiere va a
*Planes de futuro*. Al reordenar, una línea en el chat con el porqué del orden.

**Lo que no hago solo:** archivar tarjetas que escribió Alfonso, ni marcar hecho lo que no he
verificado.

## Qué es

Extensión de VS Code (`Lovervoid.bays`, pide VS Code ≥ 1.85). Sustituye la barra
horizontal de pestañas por una **lista vertical de «bays»** —los editores
abiertos— dibujada dentro de un `WebviewView` en la barra lateral, con grupos,
variantes y estado de git. Se activa en `onStartupFinished`.

**El término del dominio es «bay» y no «tab».** Una pestaña nativa de VS Code es
una `vscode.Tab`; una bay es lo que esta extensión sabe de ella.

## Comandos

```bash
npm install
npm run watch         # esbuild --watch + tsc --noEmit --watch (los dos proyectos); F5 → Extension Development Host
npm run compile       # la puerta de calidad: check-types + lint + test + check-docs + check-layers + build de desarrollo
npm run package       # lo mismo más check-release, y un build de producción (minificado, sin sourcemaps)
npm run check-types   # tsc --noEmit sobre LOS DOS tsconfig
npm run lint          # eslint src
npm test              # bundlea src/test/*.test.ts → out/test/ y lo corre con node --test
npm run check-docs    # las rutas que cita la prosa existen, y lo publicado no lleva rayas
npm run check-layers  # las capas, los ids de comando, los ajustes, lo que se desmonta, la frontera de confianza, el contrato del webview, los bundles de l10n y que git no tracke documentacion de agentes
npm run check-release # la versión del manifiesto tiene entrada propia, fechada y única, en el changelog
npm run vsix          # vsce package, con el canal derivado de la versión
npm run release       # lo mismo, publicando
npm run test:integration  # bundlea src/test-integration/ y lo corre DENTRO de un VS Code real
```

`npm run compile` es la puerta de calidad y es lo que corre el CI
(`.github/workflows/ci.yml`, Node 22 y 24 × Linux y Windows). **El lint sale
LIMPIO: 0 errores y 0 warnings, y ésa es la línea.** Un warning nuevo no se
asume: se arregla o se justifica aquí — un warning permanente acaba en warning
que nadie lee.

**Lo que lee JSON ajeno pide `unknown` y no `any`**, y la diferencia es justo la
que importa: `unknown` no se puede leer sin comprobarlo antes, así que obliga a
que la comprobación exista, mientras que `any` deja que falte y compile. Los
temas de iconos, los temas de producto y la API de git entran por ahí, y los tres
tienen su narrador mínimo al lado (`asRecord`, `asString`).

**Hace falta Node 22.22.2+ o 24.15+**: `npm test` le pasa un glob a `node --test`,
y las versiones anteriores no lo expanden. `engines.node` copia el rango que
imponen `eslint` y sus vecinas, porque con un `>=22` a secas `npm install` avisa
de EBADENGINE por dependencias que el propio `package.json` da por satisfechas.

### Dos suites de tests, y el corte es el asunto

- **`src/test/` es PURA**: no importa `vscode`, esbuild la bundlea y `node --test`
  la corre en unos 150 ms, así que corre mientras trabajas. Son 185 casos sobre
  los módulos de `src/utils/` y `src/shared/`.
- **`src/test-integration/` es lo que solo se puede afirmar DENTRO de un VS Code
  real** —las clases `TabInput*`, la activación, los comandos registrados— y paga
  una descarga y un extension host, así que es un paso propio. Son 14 casos.

**Si sacas lógica no trivial de un módulo que importa `vscode`, muévela a
`src/utils/` como función pura y dale tests.** Es el patrón que ya siguen
`idRules.ts`, `pathParts.ts`, `diffRules.ts` y `stateIndicator.ts`: **la REGLA
recibe lo que la plataforma resolvió** —una uri como cadena, un esquema, una ruta
relativa— en vez de importarlo, y el adaptador que la alimenta vive en
`platform/` o al lado de quien la llama. `bayStateCode` es el ejemplo entero:
recibe una forma estrecha de tres campos (`BayStateFacts`) que una `Bay`
satisface tal cual, así que la precedencia se fija con tests que corren sin
extension host.

### Cuando pido «dale salida»

**«Darle salida» —o «sácalo», o «ciérralo»— significa CERRAR la versión, y son
cuatro pasos en este orden**: subir `version` en `package.json`, escribir su
entrada en CHANGELOG.md, commitear todo lo que quede suelto, y construir el
paquete con `npm run vsix`. Lo que se entrega al final es la RUTA del `.vsix`,
que es lo que de verdad se ha pedido.

No es una pregunta: dicho eso, se hacen los cuatro sin volver a preguntar por
ninguno. Qué número toca y qué forma tiene la entrada lo dicen las dos secciones
que siguen; los commits van con su gitmoji y se parten por lo que cambia cada
uno, nunca en uno solo que diga «cambios».

**Lo que NO incluye es publicar.** `npm run release` sube al marketplace y una
versión no se despublica, así que la salida acaba en un fichero en el disco y
quien lo sube es él.

### Antes de empaquetar: la versión y el changelog

**Todo paquete que vaya a publicarse necesita una versión que no se haya
publicado nunca y una entrada del changelog que la nombre.** Son dos escrituras
a mano —`version` en `package.json` y una cabecera `## [x.y.z]` fechada en
CHANGELOG.md— y las dos van **antes** de construir el `.vsix`, porque el
changelog viaja dentro. Cuál de las dos falla en silencio y quién corta cada una
está en *Lo que el build se niega a dejar pasar*, con `check-release`.

Qué número toca lo dice la convención que el propio CHANGELOG.md declara en su
cabecera: los minor IMPARES (0.5, 0.3, …) salen por el canal **pre-release** del
marketplace y los pares son releases estables.

**Y cada entrada es una LISTA de lo que cambió, y nada más.** Una bala nombra el
cambio y se acaba ahí: ni por qué se hizo, ni contra qué se pesó, ni qué había
antes, ni qué cuesta. Todo eso vive en el commit que lo hizo y en esta guía, que
son los dos sitios donde se puede leer entero y donde se mantiene al día; en la
página del marketplace es un párrafo por bala que nadie lee y que además envejece
solo, porque la razón de un cambio la sustituye el cambio siguiente y la nota de
la versión vieja se queda escrita. Nada de párrafos sueltos entre las balas: si
algo no cabe en una bala es que no es un cambio. La única prosa que puede quedar
dentro de una bala es la que el lector NECESITA para actuar sobre ella: los
valores de un ajuste nuevo, una clave que hay que apagar antes de desinstalar.

**Y la regla NO se declara en la cabecera del changelog.** Una nota diciendo que
ahí no se explica nada es prosa sobre el documento en un documento del que se
acaba de barrer justo eso, y encima justifica una ausencia a quien solo ha venido
a ver qué cambió. Lo que la cabecera sí dice es lo que el LECTOR necesita: qué
significan las categorías, y que el minor impar es el canal pre-release, o sea
qué número está a punto de instalar.

Lo que hay escrito hasta 0.4.7 no sigue esa forma —hay balas de cinco líneas
explicando contra qué se pesó cada cambio— y no se reescribe hacia atrás: lo que
se añada de aquí en adelante sí.

### Al publicar: `npm run vsix` y `npm run release`

**`vsce` no se teclea a mano.** Lo componen esos dos scripts
(`scripts/release.js`), y lo que hacen es derivarlo en vez de recordarlo.

- **El CANAL lo decide la paridad del minor**: impar al canal pre-release, par
  estable. El marketplace no lo deduce de nada —quien lo dice es `--pre-release`—
  y olvidarlo en un impar publica esa versión como ESTABLE, o sea que el
  marketplace la sirve como la última a todo el mundo y actualiza sola. Una
  versión no se despublica, así que la única salida es publicar otra encima: es
  el fallo más caro de aquí, callado, en el último paso de todos y el único sin
  vuelta atrás.
  - **Se dice en voz alta antes de correr nada**, con el número del que sale:
    `[release] 0.5.1: minor 5 is odd, so PRE-RELEASE`. Una línea que nombra la premisa y la
    conclusión se puede leer como equivocada ANTES de la subida, que es el único
    momento en que leerla sirve de algo.
  - **Y pasarla a mano se RECHAZA**: lo que se le añada al comando se le entrega
    a `vsce` tal cual —una ruta de salida, por ejemplo—, pero teclear de vuelta la
    derivada es exactamente el acordarse que esto existe para quitar.
  - **No hay ningún campo del manifiesto que diga el canal**, y conviene saberlo
    para no ir a buscarlo: es una bandera de publicación y nada más.
- **`--allow-missing-repository` NO se pasa, y es deliberado**: Bays declara
  `repository`, así que los enlaces que `vsce` deriva de él resuelven y la
  pregunta no se hace. Una bandera que calla una pregunta que nadie está haciendo
  es una bandera que esconde el día que el campo desaparezca. (Atria sí la lleva,
  porque su repositorio es privado y no declara el campo.)

Lo que el script **no** puede hacer, porque no está de su lado: saber si esa
versión ya se ha publicado. Esa respuesta vive en el marketplace y quien la da es
`vsce publish` negándose. La otra mitad la cubre `check-release`, que cuelga del
`vscode:prepublish` y corta antes de construir nada.

Y **`vsce` no es una dependencia de este proyecto** y no necesita serlo: se
ejecuta de donde esté instalado, como ya se ejecutaba. Sin él en el PATH, el
script lo dice con esas palabras en vez de dejar un `ENOENT` suelto.

## Lo que el build se niega a dejar pasar

La puerta de calidad no comprueba lo que PRODUCE, así que los fallos que importan
son los que salen en **verde**. Los corta `esbuild.js`:

- **El entry point de CSS ausente, un `@import` que no resuelve, y una hoja de
  `src/styles/` que no importa nadie.** La tercera es la que no cubría nada: una
  hoja que EXISTE y que nadie importa se cae del bundle con el build en verde, y
  sus reglas sencillamente no llegan al panel — que se ve como lo que la cascada
  deje y no como un error. Las tres van por `process.exitCode` y no por `throw`,
  porque corren dentro del `onEnd` del watch, una línea antes del
  `[watch] build finished` que `.vscode/tasks.json` declara como su
  `endsPattern`: reventar ahí deja el `preLaunchTask` de F5 esperando para
  siempre.
- **El ORDEN de los `@import`.** Varias hojas dependen de la cascada y ninguna lo
  dice en tiempo de ejecución: `bay-content.css` tiene que cargar antes que
  `variants.css`, que le sobreescribe el tamaño del icono y del texto, y
  `bay-file-states.css` detrás de las dos, porque sus colores de nombre empatan
  con ellas. Las parejas que cargan peso están en `CSS_ORDER`; una hoja que no
  comparte selector con nadie es libre de moverse.
- **Un nombre de codicon que `codicon.css` no declara, y un glifo escrito fuera
  de `shared/icons.ts`.** Un nombre de codicon es una cadena y no hay regla para
  uno que la fuente no conoce: mal escrito no dibuja NADA, con el `check-types`,
  el lint y el build en verde. La segunda mitad vale tanto como la primera: un
  glifo escrito dentro de un módulo se ha escapado de la tabla, y con ella del
  escaneo por rol.
- **Un escaneo de tests vacío, o un subdirectorio dentro de `src/test/`.** A
  `node --test` se le entrega un glob plano, así que un test anidado no llega a
  ser entry point y no corre nunca, sin error por ninguno de los dos lados. Los
  dos son un `throw`, seguro **solo ahí**: `buildTests` cuelga de `main()`, cuyo
  `.catch` sale con código 1. El borrado de `out/test/` va delante de todo
  return: con los bundles del build anterior en disco, esa pasada verde reporta
  sus casos viejos contra código que ya no existe.

Y tres scripts en `scripts/`, colgados de `compile` y de `package`:

- **`check-docs`** afirma que toda ruta relativa a `src/` que la documentación y
  los comentarios citan sigue nombrando un fichero que existe, que toda imagen a
  la que apunta un markdown está, y que lo que el marketplace renderiza no lleva
  rayas ni comillas tipográficas. Cuando se escribió, la prosa todavía citaba los
  módulos del cliente por sus nombres `.js` de antes, meses después de que el
  cliente pasara a TypeScript.
- **`check-layers`** corre las reglas de más abajo: pertenencia de carpeta, ids
  de comando declarados contra registrados contra nombrados en un menú, las
  claves de ajuste que se leen por su nombre, lo que hay que desmontar, los
  identificadores que esta guía cita, la frontera de confianza, el contrato del
  webview, la paridad de los bundles de traducción y que **git no tracke el
  estado de una herramienta de IA** (abajo).
- **`check-release`** afirma que la versión del manifiesto tiene su propia
  entrada en el changelog, fechada, escrita y única, y la primera. La versión la
  rechaza `vsce publish` y nadie más; el changelog no lo rechaza NADIE, así que
  una release sin entrada se publica perfectamente y aterriza como una versión de
  la que su página no sabe decir qué cambió. Ésa es la mitad que vale un check, y
  es como salieron 0.3.5, 0.3.6 y 0.3.7 sin documentar.

### El estado de una herramienta se queda en LOCAL, y esta guía no

Las instrucciones de cualquier asistente, los directorios que cada uno se trae y
la configuración de un servidor MCP **están en disco y no en git**. Son de ESTA
máquina y no del proyecto: a quien clona el repositorio para leer el código no le
sirven de nada, y ahí envejecen sin que las lea nadie. La de MCP tiene además una
razón propia, y es que suele llevar una clave dentro.

**Este fichero es la excepción, y SÍ va en git.** No es configuración de una
herramienta sino el REGISTRO DE DISEÑO de este repositorio, así que pertenece
donde pertenece el código que describe. Lo que gana es exactamente lo que a lo
demás se le acepta perder: un `git clean -x` no se lo lleva, una edición mala se
deshace, y cuándo dejó de ser verdad una regla está escrito en el commit que la
cambió. Eso último es lo que sostiene la convención de esta guía —los comentarios
explican el porqué en PRESENTE y no narran el pasado—, que solo se puede permitir
mientras el pasado esté en algún sitio.

**Un `CLAUDE.<algo>.md` sí se queda fuera**: eso ya es una variante local, y la
frontera es exactamente ésa.

**Y no basta con `.gitignore`**, que es la diferencia entre una regla y una
costumbre: ese fichero no saca lo que YA estaba trackeado, no alcanza a un
`git add -f`, y un nombre nuevo —el asistente del año que viene— no está en la
lista. Quien lo hace cumplir es `checkNoAgentDocs`, que mira el ÍNDICE y corta.
Afirma que no estén trackeados, **no** que no existan.

**Y lo que se apoya en esta guía sigue sabiendo vivir sin ella.** La mitad inversa
de la comprobación de citas —la que pregunta si alguna excepción de `NOT_OURS` ha
dejado de citarse— no puede correr sin guía delante: las trece saldrían a la vez
como muertas y la puerta cortaría por nada. Hoy la guía viaja, así que eso solo
pasa en un árbol al que le falte; se salta **en voz alta**, que es lo único que
impide que un check que no corre se convierta en un check que nadie echa de
menos.

## Las capas, y cómo se comprueba cada una

| carpeta | qué contiene | cómo se comprueba |
|---|---|---|
| `src/utils/` | reglas **puras**, cada una con sus tests | ningún fichero importa `vscode` |
| `src/platform/` | adaptadores finos sobre la API de VS Code | todos importan `vscode` |
| `src/shared/` | lo que compilan **los dos** proyectos de TypeScript | ni `vscode` ni DOM |
| `src/webview/` | el cliente, que corre en un navegador | no importa `vscode` |

La regla no es cosmética: **una carpeta sin criterio de pertenencia comprobable
se llena sola.** Y las dos direcciones importan, porque el hueco se abre por
cualquiera de las dos — un módulo puro que acabe en `platform/` reabre el
problema una carpeta más allá.

Lo que la regla **no** dice es que todo lo puro viva en `utils/`: va en una sola
dirección. Cuando una regla pura tiene un único subsistema por consumidor, vive
con él.

## Doble bundle, dos proyectos TypeScript

`esbuild.js` produce dos artefactos con configuraciones incompatibles entre sí:

| | entry | salida | formato | tsconfig | lib |
|---|---|---|---|---|---|
| Host | `src/extension.ts` | `dist/extension.js` | CJS / node | `tsconfig.json` | sin DOM |
| Cliente | `src/webview/main.ts` | `dist/webview/main.js` | IIFE / browser | `src/webview/tsconfig.json` | + **DOM** |

El tsconfig del cliente vive **dentro** de `src/webview/` para que el
`projectService` de typescript-eslint lo encuentre subiendo directorios; el
tsconfig raíz excluye esa carpeta. `npm run check-types` corre los DOS
precisamente para que esto no se cuele.

El grafo de imports de `main.ts` define el orden de init; no hay globales
compartidas entre ficheros, y `vscodeApi.ts` es dueño de la única llamada a
`acquireVsCodeApi()`.

**El arrastre se arma PEREZOSAMENTE**, la primera vez que llega un `render` con
el ajuste puesto: con el shell congelado el ajuste se puede mover sin que el
documento se reconstruya, así que leerlo una vez del `<body>` al arrancar dejó de
bastar.

Consecuencia práctica: editar `src/webview/*.ts` o `src/styles/*.css` solo hace
efecto tras un rebuild, y **después de tocar el SHELL** (`BaysHtmlBuilder.buildShell`)
hace falta una **recarga entera (Ctrl+R)** en el host de desarrollo: el shell se
asigna una vez por webview, así que nada por debajo de una recarga lo sustituye.

## El bucle de actualización

Es la parte que cruza muchos ficheros. Del lado del host:

1. **`extension.ts`** cablea todo: construye los servicios (`BayStateService`
   primero, luego `GroupCustomizationService`, `BaySyncService`,
   `BayDragDropService`, `FileActionRegistry`, `BayIconManager`, `ThemeService`,
   `ProductIconService`, `CopilotService`, `GroupActions`, `BaysWebviewProvider`,
   y más tarde `ClaudeConversationService`), arranca `iconManager.initialize()`
   **sin bloquear** (`void …`; su `onDidInitialize` posterior dispara
   `provider.refreshTheme()`, que repinta Y reenvía la fuente del tema), registra
   el provider y llama a `syncService.activate()`.
2. **`BaySyncService`** mantiene el estado de acuerdo con VS Code
   **RECONCILIANDO**, nunca aplicando deltas (ver *El estado se RECONSTRUYE, no se
   parchea*). Alrededor:
   - **`BayEventService`** — registra los oyentes de VS Code (`onDidChangeTabs`,
     `onDidChangeTabGroups`, `onDidChangeActiveTextEditor`,
     `onDidChangeTextEditorSelection`, renombrados y borrados de fichero), y casi
     todos se reducen a pedir una reconciliación.
   - **`ActiveStateService`** — recalcula `isActive` a partir de las pestañas
     nativas: el camino rápido del resaltado entre dos reconciliaciones.
   - **`BayHeadService`** — abre el fichero de un diff que el usuario ACABA de
     abrir con su fichero cerrado. Nada más.
   - **`BayHierarchyService`** — quiénes son las variantes de una bay
     (`fetchVariants`, un recorrido por `sourceBayId`) y la sincronización del
     cursor.
   - **`GitSyncService`**.
3. **`BayStateService`** es la fuente de verdad en memoria (`Map<id, Bay>` más
   los grupos). Sus mutaciones disparan **cuatro** eventos distintos:

   | evento | lo dispara | qué acaba haciendo |
   |---|---|---|
   | `onDidChangeState` | `notifyChange()` y los mutadores directos | `provider.refresh()`: un cambio ESTRUCTURAL, así que se recompone la lista entera y se reconcilia. **Nunca una reconstrucción del documento.** |
   | `onDidChangeStateSilent` | `notifyActiveChange()` | `refreshSilent()` manda `updateActiveBay` |
   | `onDidChangeBayState` | `updateBayStateWithAnimation()` | manda `bayStateChanged` para UNA bay |
   | `onDidChangeBayLabel` | `notifyBayLabelChange()` | manda `updateBayLabel` para UNA bay |

4. **`BaysWebviewProvider.refresh()`** (30 ms de debounce) llama a
   **`BaysHtmlBuilder.buildSections()`** y manda un `render` con el resultado. Lo
   que viaja son **DATOS** (`GroupSection[]`, `BayView`, `VariantView`) y el
   markup lo construye el **CLIENTE** en `webview/rows.ts`. Los iconos son la
   única excepción y viajan como HTML, deduplicados por clave en
   `html/IconKeyRegistry`: un marcador de tema es un `data:` URI de kilobytes, así
   que diez pestañas `.ts` mandarían diez copias del mismo SVG.
   - **Y cada entrada cruza UNA vez por cliente** (`utils/iconDelta.ts`, puro y con
     tests). El cliente guarda el diccionario entre mensajes, y lo que viaja es lo
     que le falta (`IconLedger`). Se reenvía entero, como un RESET, exactamente
     cuando el cliente no puede tenerlo: en cada `ready` —un webview recargado
     también lo manda— y en un cambio de tema, que reacuña las claves desde `i0`
     con otros marcadores detrás. Antes cada `render` reenviaba TODOS los iconos
     vistos en la sesión, kilobytes cada uno, con cada cambio estructural.
   - **El cliente funde el diccionario al RECIBIR, nunca al pintar**
     (`receiveIcons`): un render que llega a mitad de un arrastre se aplaza y el
     siguiente lo sustituye, y las entradas que solo traía el primero se perderían
     con él.
5. **El cliente** (`webview/interactions.ts`, bundleado en
   `dist/webview/main.js`) atiende los clics y el menú contextual y contesta con
   `postMessage`.

### El contrato vive en `src/shared/protocol.ts`

La definición única de todos los mensajes de los dos sentidos, más el modelo del
menú y el modelo de la vista (`BayView`, `VariantView`, `GroupSection`). Lo
importan el host **y** el cliente, y lo compilan **los dos** tsconfig, así que
tiene que seguir libre de `vscode` y de DOM.

- **Del cliente al host van 12 mensajes**, y el host los despacha por un mapped
  type (`MessageHandlers`, uno por cada `WebviewToHostMessage['type']`): añadir
  una variante **rompe la compilación** hasta que exista su handler.
- **Del host al cliente van 8**, y ahí el compilador no puede ayudar: el cliente
  no tiene despacho central sino oyentes que filtran por tipo, así que una
  variante añadida a `HostToWebviewMessage` **compila sin que la escuche nadie**
  y la feature no hace nada, en silencio. Lo cierra
  **`WEBVIEW_MESSAGE_LISTENERS`**, un `Record` sobre esa unión que obliga a
  nombrar el oyente en el mismo fichero donde se añade la variante — y
  `check-layers` comprueba que ese oyente de verdad filtre por ese tipo.
- Lo que el compilador **sigue sin poder** comprobar: los atributos
  `data-bay-id` que escribe `rows.ts` tienen que casar con las lecturas de
  `dataset.bayId` de `interactions.ts` y `dragdrop.ts`.

**Un mensaje nuevo empieza aquí.** Un desajuste es hoy un error de compilación y
no una actualización que se pierde en silencio.

### Las actualizaciones parciales

Los cambios de activo, de sucio y de git/diagnósticos se parchean por su propio
`postMessage` en vez de dar la vuelta por la lista:

- **activo** → `notifyActiveChange()` → `updateActiveBay` (conmuta `.active`).
- **estado de una bay** → `updateBayStateWithAnimation()` → `bayStateChanged`
  (sustituye el nodo `.bay-state`).
- **etiqueta de una bay** → `notifyBayLabelChange()` → `updateBayLabel` (lo usa
  el enriquecedor de títulos de Claude Code).
- **iconos diferidos** → tras el primer pintado, `patchIcons()` manda
  `updateIcons` para sustituir los `.bay-icon` de reserva. Los iconos se pintan
  de caché de forma síncrona; los fallos se resuelven en paralelo, **uno por
  icono distinto y no uno por fila** (`groupRequests`: diez `.ts` leían y
  codificaban el mismo SVG diez veces, porque la caché se escribe después de
  leer). El parche nombra una CLAVE por fila y su markup va en el diccionario, una
  vez; y la clave es la misma que reusará el siguiente render, porque la
  resolución diferida devuelve las mismas dos formas que la síncrona (marcador
  de tema o HTML). Un parche que resuelve al placeholder no se manda.
- **reordenar arrastrando** → el webview mueve el DOM él mismo y el host reordena
  su modelo en silencio, sin reconstruir nada.

**Todo lo que muta el estado de sincronización o abre una tab** —cada
reconciliación, el re-key de un renombrado, la apertura del padre de un diff—
**corre por una sola cola de promesas** (`BaySyncService.enqueue()`). Nunca mutes
ese estado fuera de ella.

### El estado se RECONSTRUYE, no se parchea

Cada evento de tabs pide una reconciliación (`scheduleReconcile`, una por ráfaga:
`TIMINGS.RECONCILE_DEBOUNCE`), y la reconciliación convierte **todas** las tabs
nativas otra vez y las funde con lo que hay en pantalla. Es síncrona a propósito:
sin un `await` en medio, nada puede mover las tabs entre leerlas y adoptarlas
(`BayStateService.adoptGroups`, un solo cambio sin eventos).

**Fue incremental, y ésa era la fuente de toda la deriva.** Se leía todo al
arrancar y en un split, y entre medias se aplicaban los deltas de
`opened`/`closed`/`changed` a mano: cuatro manejadores con `await` en medio, cada
uno una ocasión de aplicar un cambio a un estado que ya se había movido, y nada
que corrigiera el resultado hasta el siguiente split. Lo que se veía:

- una previa sin bloquear que seguía al editor activo se quedaba colgando del
  `.md` anterior — el `changed` actualizaba su etiqueta y nunca su padre;
- el mapa y el grupo guardando OBJETOS distintos para un mismo id, en cuanto el
  padre de un diff se añadía dos veces (el repliegue de la apertura y el evento
  encolado detrás) — y se dibujaba el que ya no recibía actualizaciones;
- y la vista peleándose con VS Code: reabría el `.md` que el usuario acababa de
  cerrar para que su previa no se quedara sin padre, y el mismo evento traía el
  cierre que lo volvía a quitar.

Lo que una reconstrucción NO puede leer de las tabs es lo que posee el PANEL, y
son las reglas puras de `utils/reconcileRules.ts`, con tests:

- **el orden de cada grupo** (`orderGroup`): lo que ya estaba conserva su sitio,
  casado por id y si no por uri —un split renumera las columnas y con ellas los
  ids—; lo nuevo va detrás, en el orden nativo;
- **cuándo una bay sigue siendo la misma** (`sameShape`): entonces se conserva el
  OBJETO y solo se copian las banderas nativas, que es lo que mantiene vivo lo que
  otros servicios escriben encima — la cuenta medida de un diff, el título de
  Claude, el cursor. La etiqueta de un webview o un terminal no cuenta: se
  retitulan en caliente, y eso es un parche de etiqueta y no una bay nueva;
- **qué variantes se han quedado sin padre** (`orphanedVariants`): se degradan a
  fila raíz.

Y cada cambio sale por el canal más estrecho que lo dice: un cambio de forma, de
conjunto o de orden es un `notifyChange`; el dirty, git y los diagnósticos, un
parche de una fila; un retitulado, un parche de etiqueta; el activo, el camino
silencioso.

- **Un cierre que conduce Bays aplaza la reconciliación** (`hasIntentionalCloses`):
  a mitad de la cascada las tabs nativas pierden un instante al padre que se va a
  reabrir, y reconstruir con eso lo mandaría al final de su grupo. Al soltarse el
  último marcador (`onDidSettleCloses`) corre la que estaba pendiente.
- **Un renombrado es lo único que las tabs no pueden decir** —qué fichero nuevo
  ES el viejo—, así que se re-keya la bay en su sitio ANTES de reconstruir; la
  ventana del debounce es lo que deja llegar primero a ese evento.

## El invariante: `webview.html` se asigna UNA vez

El shell (`BaysHtmlBuilder.buildShell`) se asigna en `resolveWebviewView` y nunca
más. Todo lo demás viaja por `postMessage`. **Lo comprueba `check-layers`**, que
cuenta las asignaciones en todo `src/` y corta con dos o con cero.

Reasignarlo es lo que la extensión hacía en cada cambio estructural —una pestaña
abierta, cerrada, anclada— y **destruye el documento entero**: el scroll, el foco
del teclado, los grupos plegados, el bundle del cliente, las hojas de estilo, la
fuente de codicons y la fuente del tema empotrada en base64, todo pagado otra
vez. Cada una de esas pérdidas costaba después su propia restauración, y cada una
de esas restauraciones existía únicamente por culpa de la reasignación.

Lo que lo sustituye es una **reconciliación por clave** (`webview/render.ts`): se
computa una firma por bloque —una por cabecera de grupo y una por `.bay-block`—
y un bloque cuya firma no ha cambiado **no se toca**. Ese «no se toca» es la
ganancia entera: conserva su foco, su clase de plegado y cualquier animación en
curso. La decisión de qué se conserva, qué se sustituye y qué se inserta vive
aparte y con tests (`utils/renderPlan.ts`), porque es donde están los casos
límite y ninguno se ve cuando sale mal.

Y el paseo es por **SECCIONES** y no por una lista plana: las filas de cada
grupo van dentro de su propia caja (`.group-rows`, que construye
`buildGroupRows`), así que hay un cursor por caja en vez de uno solo para
`#bays`. Lo que decide QUÉ hacer con cada bloque no cambia —sigue siendo el plan
puro— y lo que cambia es DÓNDE va. La caja existe por el plegado (ver *Los
grupos*) y se reapta aparte: no es un bloque con firma, así que no entra en el
plan y se compara contra las secciones que llegan.

Tres cosas cuelgan de esto y no son opcionales:

- **El primer pintado cuelga del `ready` del cliente**, que es su primera
  sentencia. Un mensaje mandado a un webview que todavía no ha registrado su
  oyente se PIERDE, así que el host no puede pintar en el momento en que asigna
  el shell.
- **El `@font-face` del tema viaja por mensaje** a un `<style id="themeFont">`
  que el shell manda VACÍO. Leer la fuente de un tema es I/O de disco, y ponerla
  en el `<head>` dejaría el panel en blanco hasta que estuviera. Un cambio de
  tema de iconos tiene que reenviarla (`refreshTheme`), o los glifos del tema
  nuevo se pintan con la fuente del anterior.
- **No se reconcilia nada a mitad de un arrastre** (`dragInFlight`): sustituiría
  justo los nodos contra los que el gesto está midiendo. Lo que llegue se pinta
  al soltar.

Lo que queda del modelo viejo es `getState()`, y sigue haciendo falta: el
documento ya no se recarga ante un cambio, pero sí cuando el webview nace otra
vez (al mover el panel, o al volver de estar oculto sin contexto retenido).

## El modelo Bay

Una **bay** es una pestaña de VS Code. `bay.metadata` es **inmutable** —se
computa al crearla y no se toca más— y `bay.state` es **mutable** durante su
vida. Muta `bay.state.*`, nunca `bay.metadata.*`. Los métodos de `Bay` delegan en
funciones puras de `models/actions/*`, que reciben `(metadata, state)`.

**`activateFn` se INYECTA** en esas acciones para evitar una dependencia
circular: anclar y desanclar necesitan activar primero.

### Los cinco tipos, y el que no existe

```ts
type BayType = 'file' | 'webview' | 'custom' | 'notebook' | 'terminal';
```

- `TabInputText` → `file`
- `TabInputWebview` → `webview` — **`uri === undefined`**
- `TabInputCustom` → `custom`
- `TabInputNotebook` → `notebook`
- `TabInputTerminal` → `terminal` — **`uri === undefined`**
- `TabInputTextDiff` → **`file`**, no un tipo aparte
- cualquier otro input → **`webview`** (dos secciones más abajo)

**No hay un `bayType: 'diff'`, y eso es la decisión.** Un diff es una bay
ordinaria de tipo `file` a la que se le reconoce por tener `metadata.sourceBayId`
puesto, con `metadata.diffType` diciendo de qué clase de diff se trata
(`working-tree`, `staged`, `snapshot`, `commit`, `edit`, `merge-conflict`,
`incoming`, `current`, `incoming-current`, `preview`, `unknown`).

#### Y el TERMINAL sí es un tipo

`TabInputTerminal` está **vacío**: ni uri, ni viewType, ni un id de terminal. Es
el único input al que no se le puede preguntar nada, así que las tres respuestas
que una bay necesita de él salen de otro sitio — y meterlo en `webview` habría
escondido justo eso:

| qué | de dónde sale |
|---|---|
| su id | el ASIENTO (`terminalBayId`), nunca la etiqueta |
| su tab | el asiento otra vez (`matchesNative`) |
| su icono | el `iconPath` que declaró quien lo creó (`platform/terminalIcons.ts`), y el codicon `terminal` cuando no declaró ninguno |

**La etiqueta queda fuera de las tres, y ahí está el asunto.** El título de un
terminal lo reescribe el shell mientras la tab vive —Claude Code escribe su
estado dentro— así que un id derivado de él deriva con cada pulsación de tecla, y
la bay guardada bajo el anterior deja de encontrarse: el manejador de cambios la
busca por el id que recompone de la tab nativa, falla, y deja atrás una fila que
no se puede ni activar, ni cerrar, ni reetiquetar. Con el asiento el id no se
mueve, y el retitulado es un parche en sitio como el de un webview.

**Y el emparejado no tiene NADA que comparar salvo el asiento**, porque el input
está vacío: sin él la respuesta tendría que ser la etiqueta, que aquí ni
identifica —dos terminales con el mismo nombre son el caso corriente— ni se está
quieta. Una bay de terminal sin asiento por tanto no resuelve a ninguna tab, que
es la dirección segura: una fila muerta se ve, y una que activa el terminal que
no era no.

#### Un input que VS Code NO describe es un `webview`

`vscode.Tab.input` vale `undefined` cuando el editor no cae en ninguna de las
clases que el API expone (`kind: 0`): un editor de fusión, un chat, una ventana
interactiva, un diff de varios ficheros — y una VISTA arrastrada al área de
editores, que es como llega ahí el panel de Claude Code.

Era `file`, y eso lo dejaba **muerto**: una bay sin uri se activa y se cierra por
su tab NATIVA, y `matchesNative` solo toma esa vía para una bay de tipo
`webview`. Dicho `file`, la fila no contestaba a ningún clic; y el icono caía en
el codicon de reserva —`preview`—, que es como se veía el fallo desde fuera: una
pestaña de Claude con cara de vista previa de markdown.

### Las variantes

Una **variante** es una bay con `sourceBayId` apuntando a su padre. Se dibuja
sangrada debajo de él. Los diffs, las instantáneas, los cambios preparados y **la
vista previa de un markdown** son todos variantes.

**Y ese campo es la ÚNICA copia de la relación: el padre no lleva cuenta de sus
variantes.** La llevó (`hasVariant`/`variantCount`), y era una segunda copia del
mismo hecho mantenida por un registro que corría en el evento de apertura de la
variante — y se quedaba a cero, en silencio, cuando el padre todavía no estaba
en el estado en ese instante, sin nada que lo reintentara. Todo lo que actúa
sobre «una bay y sus variantes» —cerrar, mover, el resync de un `.md` cerrado,
un renombrado— cortaba por esa cuenta antes de mirar `sourceBayId`, así que un
padre con la cuenta mal se movía o se cerraba SOLO y dejaba un Working Tree
bajo la cabecera de la que se iba. Hoy todos preguntan a `fetchVariants`, que
recorre `sourceBayId` y no puede discrepar consigo mismo.

Una variante **hereda el `viewMode` de su fuente** al engancharse
(`BayHierarchyService`).

#### Una variante NACE EN EL GRUPO DE SU PADRE

Es la ley de la que cuelga el resto de la sección, y no es una preferencia: la
lista se compone **por grupo** (`buildBays` recorre las bays de UNO), así que una
variante cuya tab vive en otro grupo no se puede dibujar bajo su padre. Lo que se
ve entonces es lo peor de las dos cosas — la variante sale como **fila huérfana**
bajo una cabecera ajena, y el padre sigue ofreciendo el botón que la abre, porque
para él no ha aparecido ninguna.

**El caso que la enseñó**: pulsar *Open Preview* en una bay que no era la que
estaba delante. `markdown.showPreview` **no acepta columna** — la lee de
`window.activeTextEditor`— así que la previa aterrizaba donde estuviera el foco.

De ahí las tres formas de cumplirla, y cuál toca lo decide **de dónde saca su
columna la orden**, nunca el gusto:

| la orden | cómo |
|---|---|
| acepta una columna (`vscode.diff`) | se le pasa la del padre |
| la deduce del EDITOR de delante (`markdown.showPreview`) | se pone el padre delante primero |
| la deduce del GRUPO de delante (`git.openChange`, que abre en `ViewColumn.Active`) | se enfoca el grupo (`focusGroup`) |

- **Enfocar el grupo NO basta para la previa**: con un webview delante no hay
  editor de texto del que leer una columna, y el comando cae en la columna uno.
  Lo que tiene que estar delante ahí es el EDITOR fuente.
- **Y quién es el padre no siempre es la bay pulsada.** *Compare with Active
  Editor* compara dos ficheros DISTINTOS, y ahí el padre es el lado ORIGINAL
  (`determineParentUri`), o sea el editor activo — así que la columna que se le
  pasa es la SUYA. Que no es siempre la del grupo activo: con un webview delante,
  `activeTextEditor` es el último editor de texto que cambió de entrada, viva
  donde viva.
- **La mitad inversa ya existía** y conviene leerla al lado: cuando la que
  aparece primero es la VARIANTE, `openMissingParent` abre el padre **en el
  grupo de la variante**. Las dos reglas dicen lo mismo desde los dos extremos —
  padre e hija en el mismo grupo—, y por eso ninguna necesita mover una tab
  después.

Lo que la ley **no** alcanza es una previa que abre el propio VS Code en otro
grupo (*Open Preview to the Side*, la paleta): ahí la tab está de verdad en otro
sitio y la fila huérfana es la respuesta honesta. Lo que se arregla es lo que
abre ESTA extensión.

#### Y VIAJA CON ÉL

La ley se cumplía al NACER y no al MOVERSE. Arrastrar una bay a otro grupo movía
su fila y dejaba sus diffs y su previa colgando bajo la cabecera de la que se
iba: la fila huérfana de arriba, producida por nosotros y no por un comando
ajeno, con el padre ofreciendo otra vez el botón que las abre porque para él no
ha aparecido ninguna.

Lo mueve todo `BayHierarchyService.moveBayWithVariants`, el gemelo de
`closeBayWithVariants` y por lo mismo: **una bay ES su fila más sus variantes**,
así que las dos órdenes que actúan sobre el bloque entero se componen en el
servicio, que es quien alcanza la jerarquía. Las DOS puertas que mueven una bay
pasan por ahí — el arrastre entre grupos y `bays.moveToGroup`.

- **Las variantes se recogen ANTES de mover nada.** El id de una bay lleva
  dentro su columna, así que en cuanto el padre aterriza el suyo ha cambiado y
  `fetchVariants` no encontraría a nadie.
- **Y el padre va PRIMERO**, al revés que en el cierre, donde el orden lo decide
  quién desregistra a quién: así el grupo destino nunca enseña una variante sin
  la fila de la que cuelga. Lo que se ve en medio es esa misma huérfana en el
  grupo del que se va, y está a punto de irse.
- **Se mueve la tab VIVA y no se cierra nada**, una sola forma para toda clase
  de tab (`moveToGroup`). Eran dos, y la de los ficheros era cerrar y reabrir
  por uri:
  - un DIFF tiene uri y no es un fichero, así que reabrirlo por ella sirve el
    documento pelado — una variante mudada de esa manera llega siendo otra cosa;
  - y cerrar un padre con su previa viva es un cierre EXTERNO para
    `BayEventService`, que dispara el resync que reabre un source sin padre,
    contra una mudanza que está relocalizando ese mismo source;
  - lo que una mudanza debe es la TAB, y moverla la conserva entera: su estado
    de previsualización, el contenido de un webview, los dos lados de un diff.
    Reabrir reconstruye una aproximación a partir de una uri y una bandera.
- **Y lo que NO se hizo es meter las variantes DENTRO del objeto bay**, que era
  la otra salida: una variante es una tab NATIVA de VS Code, así que se modele
  como se modele hay que mover N tabs. Lo que aquello compraría es que nadie
  pueda olvidarse, y eso lo compra más barato un solo método con nombre y esta
  sección.

#### El `+N -M` de una variante se MIDE

Lo que un diff escribe junto a su nombre sale de sus DOS documentos
(`services/core/DiffStatsService.ts`, sobre `utils/lineDiff.ts`, puro y con
tests): las dos caras de una tab de diff son documentos que VS Code ya tiene
abiertos —el fichero, y lo que sirven los proveedores `git:`, de snapshot o de
Claude para la otra— así que la cuenta es una lectura de los dos y un diff por
líneas. No se lanza ningún proceso. Escribía `+0 -0` en todo working tree y
todo staged: era un marcador de posición puesto al enlazar la variante, y nada
lo sustituía nunca.

- **Solo la CUENTA, nunca el guion de edición**, y eso es lo que lo hace
  barato: la distancia de Myers se calcula en O((N+M)·D) y O(D), y con ella y
  la diferencia de longitudes salen las dos cifras. Se recorta antes la cabeza y
  la cola comunes, y pasado `MAX_EDITS` se cae a una cuenta por multiconjunto
  que cuenta una línea movida como quitada y añadida — nunca de menos.
- **Corre como un BARRIDO colgado del evento de estado**, y la guarda contra el
  bucle es la VERSIÓN de los documentos: escribir una cuenta dispara ese mismo
  evento, así que cada variante recuerda las versiones a las que se midió y un
  barrido que las encuentra iguales no escribe nada. El otro disparador es un
  documento cambiando, con debounce: el fichero bajo un working tree se mueve
  con cada tecla, y la cara del índice de un staged es un documento que el
  proveedor de git reescribe al preparar y al deshacer.
- **Hasta que aterrice, la fila no escribe nada**: un `+0 -0` de espera se lee
  como una respuesta medida. Las previas no tienen caras, y una edición de
  Copilot trae su cuenta en el label y se la queda.

#### Una bay y sus variantes se dibujan como UN bloque

Una variante es un diff, una instantánea o la previa DE la fila de la que
cuelga, así que el bloque entero es **una entrada de la lista** y no una fila con
cosas pegadas debajo. De ahí salen tres reglas, y las tres se comprueban mirando
un bloque:

- **UNA superficie, y se enciende ENTERA en cuanto cualquiera de sus filas es
  la tab activa**: la bay, o una de sus variantes. Activar un diff enciende el
  bloque exactamente como activar el fichero, y ninguna fila toma un tono
  propio. La pinta el BLOQUE, no las filas (`.bay-block:has(> .bay.active)`), y
  es una pastilla: metida hasta la columna de la tarjeta de la cabecera
  (`--bays-card-gap`) y con su misma curva. Con el puntero encima toma el tono
  de hover de la lista; activa, el de una selección sin teclado — la tab activa
  es una selección y el teclado está en otra parte. La activa gana al hover.
  - **Recorta a su curva** (`overflow: clip`): la banda de órdenes cierra la
    fila a sangre con botones cuadrados, y uno encendido en la primera o la
    última fila del bloque pondría una esquina cuadrada sobre la redonda.
  - **Las marcas del arrastre ganan durante el gesto**
    (`body.drag-active .bay-block.drag-target-group`): un destino es lo único
    que hay que leer entonces.
- **Lo que dice en CUÁL de las filas estás es el NOMBRE de la activa**, en el
  color activo del tema; lo que dice de qué fichero es el diff es que el padre
  conserva el PESO de su nombre.
- **No hay NINGUNA raya entre filas**, ni dentro del bloque ni entre dos. Lo que
  dice dónde acaba una entrada es el hueco entre bloques (`--bays-block-gap`,
  2px) y la superficie que enciende cada uno; una línea bajo cada fila era un
  canto dibujado en una lista cuyas entradas ya tienen uno, y peleaba con la
  superficie por el mismo trabajo. Con ella se fue `--bays-dpr`, que existía
  solo para que esa línea midiera un píxel de dispositivo.
- **Los huecos, todos**: entre dos bloques 2px; dentro de un bloque ninguno; de
  la cabecera al primer bloque y del último a la cabecera siguiente, el margen
  de la tarjeta; y en los dos extremos de la lista, sin cabecera que lo ponga,
  ese mismo margen (`#bays > .group-rows:first-child` / `:last-child`).

Con ellas se fue lo último que dibujaba un canto ahí: la **barra de acento** de
una variante activa, que además costaba una segunda aritmética.

### Los ids

| qué | id |
|---|---|
| con uri (file, custom, notebook) | `${uri}-${viewColumn}` |
| webview | `${bayType}:${key}#${asiento}-${viewColumn}`, con `key` = el `viewType` saneado, o la etiqueta cuando no hay ni viewType ni asiento |
| terminal | `terminal:#${asiento}-${viewColumn}` — sin etiqueta ninguna |
| variante | `diff:${modifiedUri}::${originalUri}-${viewColumn}` |

**El de un webview se ancla al `viewType` y no a la etiqueta**, y es a propósito:
la etiqueta se reescribe en caliente (Claude Code enseña el nombre de la sesión
actual), así que anclado a ella cada renombrado huerfanaría la bay. **Sin
`viewType` la etiqueta se cae igual y manda el asiento**: un editor que VS Code
no describe también se retitula solo —un chat se llama como la conversación— y
el asiento ya identifica la tab, así que el label solo añadiría deriva. Solo sin
asiento no queda más remedio que la etiqueta.

**Son deterministas y NO hay caché.** El mismo input da el mismo id siempre, así
que no hay nada que guardar y nada que invalidar. `generateVariantId` empotra el
`modifiedUri.toString()` ENTERO —con la query que VS Code le cuelgue, un ref de
git incluido— y funciona porque `vscode.Tab.input` no muta mientras la pestaña
vive: la ruta de apertura y las de cierre y sincronización derivan el mismo id.
No se intenta colapsar «el mismo diff lógico» entre dos pestañas distintas: cada
una tiene el suyo.

**El mismo fichero abierto en dos grupos son dos bays**, con estado independiente
(`isDirty`, `isPinned`, `cursorLine`). Git y los diagnósticos son **por URI y no
por grupo**, así que `updateTabDiagnostics` usa `findBaysByUri` (plural) a
propósito: refresca la copia de todos los grupos y no solo la primera.

### Las capabilities son CINCO campos

```ts
type BayCapabilities = {
  canClose, canPin, canRevealInExplorer, canTogglePreview, canHaveChildren
};
```

Y nada más. **No hay `canSplit` ni `canReveal`**: lo demás se computa bajo
demanda en `models/actions/*` a partir de si hay `metadata.uri`, en vez de
guardarse como una bandera que habría que mantener al día.

De ahí salen dos reglas que no son evidentes: `canPin` **no** mira la uri —un
webview se puede anclar— sino que es `!isPinned && !sourceBayId`, así que **una
variante no se ancla nunca**; y `canRevealInExplorer` es falso para lo que no
tiene fichero en disco (un `untitled:`, un remoto).

### El estado de una fila, y su precedencia

Lo que viaja al cliente es un **código** (`BayStateCode`) y no markup. La
precedencia la decide `utils/stateIndicator.ts` y es lo único de esto que se
puede romper sin que se vea nada hasta que un fichero con un error deja de
decirlo:

```
error > aviso > estado de git > sin guardar > limpia
```

Cómo se DIBUJA cada código —el glifo, el título y la clase que tiñe el nombre—
vive en `shared/bayState.ts`, en una sola tabla, porque tres respuestas sobre un
mismo hecho se separan si viven aparte. `nameClass` no es siempre el código:
`untracked` tiñe el nombre como añadido y `dirty` como modificado, porque lo que
el nombre dice es de qué COLOR está el fichero y no cuál de las nueve preguntas
lo puso ahí.

## Lo que cada carpeta puede tocar

| carpeta | tiene que | NO puede |
|---|---|---|
| `models/` | definir el modelo y las acciones puras | sincronizar con la Tab API, dibujar, resolver iconos, hablar con git |
| `services/core/` | convertir pestañas en bays y mantenerlas de acuerdo con VS Code | generar markup, ejecutar comandos de usuario, tocar iconos o APIs externas |
| `services/ui/` | iconos, temas y la lógica del arrastre | conocer la Tab API o hablar con git |
| `services/integration/` | git, Copilot y los transcripts de Claude | mutar el estado de las bays |
| `providers/` | componer los DATOS de la vista y despachar los mensajes | mutar el modelo |
| `commands/` | resolver el id y **delegar** | llevar lógica dentro |
| `webview/` | construir el DOM y contestar al puntero | saber nada de `vscode` |

**Un comando recibe un id de bay como CADENA**, nunca una instancia, y el patrón
es siempre el mismo: `resolve(arg: unknown)` valida que sea una cadena, pregunta
por `getBayById`, y el comando **solo delega**. Los comandos se invocan desde el
webview (que solo puede mandar cadenas) y programáticamente (que puede mandar
cualquier cosa), así que la validación no es higiene.

## Los casos que se aprendieron a base de romperse

Ésta es la parte que no se deduce leyendo el código, porque es lo que el código
está esquivando.

### Un webview no tiene uri, y nunca se le inventa una

`uri === undefined` para Settings, Extensions, Claude Code y cualquier webview.
**Fabricar una URI falsa (`untitled:`, `bays://`) provoca `[UriError]`**: toda
acción de fichero comprueba `if (bay.metadata.uri)` antes de nada.

Un webview **se activa por índice** (`workbench.action.openEditorAtIndex` tras
enfocar su grupo), con un repliegue a un comando concreto por etiqueta
(`BayHelpers.WEBVIEW_COMMANDS`: Settings, Keyboard Shortcuts, Welcome, Release
Notes, Interactive Playground).

### Dos clics seguidos: gana el ÚLTIMO

Activar una tab espera varios viajes al workbench —enfocar el grupo, leer el
layout, esperar a que el foco llegue a otra ventana— antes de la única orden que
cambia la tab activa (`openEditorAtIndex`). Dos filas pulsadas muy seguidas
corren dos activaciones a la vez, y sin nada más gana la que TERMINA la última:
con un grupo en una ventana flotante la espera más larga es fácilmente la del
PRIMER clic, y queda activa la fila que no se pulsó la última.

Toda activación pasa por un mismo `latestWins` (`utils/latestWins.ts`, puro y
con tests) en `models/actions/activationActions.ts`, y cada paso que mueve el
foco pregunta antes si sigue siendo la más reciente; la que no, se para ahí sin
tocar nada. Vale para cualquier origen —un clic, un comando, un pin—, porque
todos activan por ahí.

### Activar una pestaña de preview puede fallar la primera vez

Una pestaña en preview (en cursiva) puede convertirse en permanente justo entre
que se encuentra y que se activa. De ahí el reintento
(`ACTIVATION_RETRY_DELAY` 50 ms, `ACTIVATION_MAX_RETRIES` 3) y, como último
recurso, `vscode.open`.

El caso contrario —que VS Code convierta una preview en permanente— la
reconciliación lo copia **en silencio a propósito**: actualiza la bandera en el
sitio y no notifica nada, porque `isPreview` no se dibuja en ninguna parte y el
id no se deriva de ella.

### Una pestaña se puede cerrar a mitad de una acción

`findNativeTab` puede devolver `undefined` en cualquier momento. Los comandos lo
tratan como lo que es —una carrera normal— y refrescan en vez de reportar un
error.

### La vista previa de un markdown es una VARIANTE

**No hay `PreviewService` ni un conmutador fuente↔preview.** La previa es una bay
variante de verdad (`diffType: 'preview'`, con `sourceBayId` apuntando al `.md`),
dibujada como una fila sangrada bajo su padre igual que un diff.

Quien la crea es el botón de acción de fichero (`FileActionRegistry`), que
ejecuta `markdown.showPreview`; VS Code abre una pestaña webview de verdad y la
conversión normal la recoge en la siguiente sincronización.

- **Quién es el padre se resuelve por el NOMBRE**: `findPreviewSource` casa la
  etiqueta de la previa («Preview readme.md», «Vista previa readme.md») contra
  las pestañas de texto abiertas comprobando que acabe en `' ' + fileName` —
  prefiriendo una coincidencia en su propio grupo y aceptando una única
  coincidencia inequívoca en cualquier otro. Sin coincidencia se queda sin
  `sourceBayId` y se dibuja como huérfana, **nunca se descarta**.
- **El botón desaparece cuando ya hay previa** (`quickActionFor`): crear una
  segunda sería redundante. No hay botón de vuelta — la previa es una fila con su
  propia X.
- **Se re-engancha en CADA reconciliación**, porque el padre se recalcula al
  convertir: una previa sin bloquear sigue al editor activo y cambia de etiqueta
  («Preview a.md» → «Preview b.md»), y con ella de padre. `sameShape` ve el padre
  distinto y la reconstruye bajo el `.md` nuevo.
- **Y la vista NUNCA abre el `.md` por su cuenta.** Cerrar el fuente no cierra la
  previa en VS Code, y abrir la previa con *Open Preview* sustituye a un `.md` en
  cursiva: en los dos casos la previa se queda sin padre por decisión del usuario,
  y se dibuja como fila raíz. Lo hizo —reabría el fuente para que la regla de
  jerarquía se cumpliera— y era la vista peleándose con un cierre que alguien
  acababa de hacer.

### Una variante puede aparecer antes que su padre

Abrir un diff con el fichero base cerrado. `BayHeadService.openMissingParent`
abre el fichero de verdad (`openTextDocument` + `showTextDocument` con
`preserveFocus`) en el grupo del diff, y la reconciliación encolada detrás ve a
los dos.

- **Solo al ABRIRSE el diff**, y nunca en una reconciliación: es la respuesta a
  lo que el usuario acaba de pedir. Un padre que el usuario cierra con su diff
  abierto se queda cerrado, y el diff se dibuja como fila raíz.
- **Nunca para una previa**: ver arriba.
- **No hay ningún placeholder de «cargando»**: `state.isLoading` existe en el
  tipo pero sale siempre en `false`. Si la apertura falla —un remoto, un permiso,
  un fichero borrado— el diff se dibuja como fila raíz.

### Claude Code y la pelea por la etiqueta

VS Code solo expone la etiqueta TRUNCADA de una pestaña de Claude
(`aiTitle.slice(0,24) + "…"`). `ClaudeConversationService` lee el título entero
de los transcripts JSONL de Claude
(`~/.claude/projects/<slug>/<sessionId>.jsonl`), prefiriendo un `custom-title` no
vacío sobre el `ai-title`, casando por `startsWith` sobre el prefijo sin los `…`
y **descartando cualquier empate** — una coincidencia ambigua es ninguna. Un
`fs.watch` con debounce la vuelve a correr.

**Y un transcript se lee UNA vez y después solo por lo que ha crecido**
(`utils/transcriptScan.ts`, puro y con tests). Es JSONL que solo crece por el
final, y crece todo el rato que Claude trabaja, con salidas de herramienta
enteras: medido, hay tramos de 13 MB sin una sola línea de título en un
transcript de 80 MB. La lectura vieja tomaba una cola de 256 KB y, sin título en
ella, el fichero ENTERO — así que a mitad de un turno largo cada pasada del
vigilante parseaba el transcript completo en el hilo del extension host (283 ms y
~55 MB de buffer por pasada, medido sobre ese fichero). Ahora:

- **la primera lectura** camina hacia atrás desde el final por trozos y para en
  el trozo que tiene un título, bajo un tope de bytes;
- **las siguientes** leen solo los bytes añadidos (1,2 ms por pasada con 64 KB
  nuevos): el título más reciente o está en ellos o es el que ya se sabía;
- **las líneas se cortan por el BYTE de salto de línea** y nunca sobre texto
  decodificado: un `0x0A` no aparece dentro de una secuencia UTF-8, así que el
  borde de un trozo no puede partir un carácter;
- y la última línea a medio escribir no se consume: la siguiente pasada la lee
  entera.

**Y la rama genérica de «cambió la etiqueta de un webview» EXCLUYE estas
pestañas.** Sin esa exclusión, el camino genérico sobreescribiría el título
completo con la truncación de 24 caracteres en el siguiente evento de pestaña:
las dos fuentes se pelearían indefinidamente.

### Git

- **Todo es opcional y todo falla en silencio.** La extensión de git puede no
  estar; se devuelve `null` y no se reporta nada.
- **El arranque es una carrera**, y por eso la inicialización es perezosa con
  varios intentos (0 ms, 500 ms, 2000 ms).
- **Un conflicto gana a todo**: con un merge conflict se ignora el estado del
  árbol y del índice.
- **El árbol de trabajo gana al índice** cuando los dos dicen algo.
- **Las rutas se normalizan siempre**: minúsculas en Windows, sensible a
  mayúsculas en Unix.
- **Un oyente por repositorio**, seguido en un `Set` para no duplicarlo.
- El mapeo de los códigos de la API de git a los seis valores de `GitStatus`
  (`modified`, `added`, `deleted`, `untracked`, `ignored`, `conflict`) es
  exhaustivo.

### Copilot

`isAvailable()` antes de ofrecer nada: la extensión puede no estar instalada, y
un item de menú que no hace nada se lee como una vista rota. Una bay sin uri no
se puede adjuntar.

### Iconos

- **El orden de resolución es nombre > extensión > languageId.**
- **Siempre hay repliegue**: sin icono en el tema, un codicon genérico.
- **VS Code ya cachea los iconos**; no se añade otra capa de caché.
- Un tema **basado en fuente** (Seti) se sirve por un marcador
  `font-icon:CHAR:COLOR` en vez de por un data URI.
- Un SVG con **ruta relativa** se resuelve contra el directorio del tema.
- **El mapa del tema se construye UNA vez aunque se pida muchas**
  (`_mapBuild`, sobre `utils/singleFlight.ts`, puro y con tests): el primer render
  pide un icono por fila que falló la caché, todos antes de que aterrice la
  primera construcción, y cada uno lanzaba la suya — seis lecturas y parseos del
  JSON del tema al arrancar, medidos en la traza. Un cambio de tema FUERZA una
  nueva y la que estaba en vuelo, que leía el tema viejo, no escribe nada.
- Un **cambio de tema** reconstruye el mapa, con su propio debounce
  (`ICON_THEME_CHANGE_DEBOUNCE`, 100 ms).
- Los iconos de las pestañas de otras extensiones resuelven al **logo real de la
  extensión dueña** (`platform/webviewExtensionIcons.ts`): casa el `viewType` o
  la etiqueta contra las instaladas —los `customEditors` declarados de forma
  exacta, los paneles webview por heurística de tokens del nombre, las páginas
  `Extension: <nombre>` por `displayName`, y las VISTAS por el nombre que
  declaran en `contributes.views`— y empotra su `packageJSON.icon` como data URI
  por el camino diferido. Sin coincidencia, los codicons de
  `utils/builtinIcons.ts`.
  - **La de las vistas es la que alcanza a una tab sin `viewType`**, que es lo
    único que le queda a una vista arrastrada al área de editores: su etiqueta ES
    el nombre declarado, así que el mapeo es exacto y no una heurística. La
    heurística de tokens se queda deliberadamente fuera de una etiqueta: una
    etiqueta es un TÍTULO y puede decir cualquier cosa, y adivinar un dueño desde
    ahí pone un logo de marca en una pestaña que no tiene nada que ver.
- Un **terminal** no pasa por ninguno de los dos caminos —ni fichero, ni
  `viewType`— y lleva el icono que declaró quien lo creó
  (`platform/terminalIcons.ts`). El puente entre la tab y el terminal es el
  NOMBRE, y solo se toma cuando es **inequívoco** —exactamente un terminal
  abierto llamado como la tab—, que es la misma disciplina de `findPreviewSource`
  y por lo mismo. Sin coincidencia, el codicon `terminal`, que es lo que la tab
  nativa dibuja para un shell y por tanto la respuesta correcta para casi todos.

### El arrastre

- **Un `<img>` se arrastra SOLA.** Pulsar sobre uno y mover arranca el arrastre
  de imagen del navegador encima del nuestro, y con él se acaba la corriente de
  `mousemove` que el bloque va siguiendo: agarrar una bay por su icono se llevaba
  el dibujo y dejaba la fila donde estaba. Lo corta `-webkit-user-drag: none`
  sobre toda imagen de la vista (`base.css`) — los iconos de fila son del tema y
  llegan como markup que compone el host, así que no hay aquí ningún elemento en
  el que escribir un `draggable`.
- **Una bay anclada NO se mueve nunca.**
- **Una variante no se arrastra sola**: está atada a su padre.
- **Lo no anclado no puede caer sobre la sección de lo anclado**, para que la
  separación siga significando algo.
- **Se valida ANTES de ejecutar**, no después.
- **El webview es dueño del movimiento del DOM al soltar**; el host reordena su
  modelo en silencio y **no vuelve a dibujar** para reflejar un arrastre que
  salió bien.
- **A qué grupo se lleva la bay lo dice el PUNTERO** y no el centro del clon
  (`groupAt(e.clientY)`). Los dos se separan tanto como mida el bloque, y un
  bloque es una bay con sus variantes debajo: agarrado por la última, el centro
  va media altura por encima de la mano, así que había que pasarse esa media
  altura por debajo de la cabecera del grupo de destino para que contara — y
  hacia el último grupo de la lista, esa distancia puede no existir dentro del
  panel. Lo que se arrastra se suelta donde se apunta. El CENTRO se queda para la
  reordenación dentro del grupo, que es otra pregunta: ahí no se apunta a nada
  sino que se busca la RANURA en la que cabe el bloque, y eso lo decide dónde
  queda el bloque entero.
- **La banda de cada grupo es lo que el grupo OCUPA** (`buildGroupRegions`): la
  unión de su cabecera y la caja de sus filas, que son los dos elementos que
  llevan `data-groupid`. Medida de una cabecera a la SIGUIENTE, cada banda
  dependía de la posición de un vecino — y un orden inesperado en el DOM da una
  banda invertida, que no contiene ningún punto: el grupo deja de existir como
  destino sin que nada lo diga.
  - **Y no queda ni una ZONA MUERTA**: el hueco entre dos tarjetas es de la de
    arriba y los dos extremos llegan a los bordes del panel. La franja que hay
    POR ENCIMA de la primera cabecera —el margen de su tarjeta— no era de nadie,
    así que pasarse un pelo arrastrando hacia arriba contestaba `null` y el gesto
    se leía como una reordenación dentro del grupo de origen. Pasarse es lo
    normal cuando se apunta al primero de la lista.
  - **Una caja PLEGADA no entra en la unión**: es `display: none`, así que su
    rectángulo es todo ceros y arrastraría la banda hasta el borde de arriba del
    panel. Lo que queda de ese grupo es su cabecera, que es lo que se ve de él.
  - **Con menos de DOS bandas no hay destino** y el gesto se queda en reordenar.
    Se cuentan bandas y no cabeceras porque con un solo grupo poblado el host no
    manda ninguna.
- **Mientras dura el arrastre NINGUNA fila contesta al puntero**
  (`body.drag-active .bay-block`). Lo hacían solo las del grupo de ORIGEN —son
  las que llevan `.drag-shifting`— y las ancladas, así que el clon cruzaba las de
  los demás grupos encendiéndolas una a una: cada una levantaba su hover y abría
  su banda de órdenes bajo un bloque que se está moviendo. Lo que dice cuál es el
  grupo de destino es `.drag-target-group`, y una fila iluminándose por su cuenta
  compite justo con eso.
  - **Y la CABECERA con ellas**, por lo mismo un escalón más arriba: sus tres
    órdenes llegan con el puntero, así que un clon cruzándola le abría la banda
    entera — y justo encima de la marca que sí tiene algo que decir ahí, que es
    `.drag-over`. Lo que se queda es el candado de un grupo bloqueado, que no
    espera al puntero porque reporta un ESTADO.
  - **Y no le cuesta nada al gesto**: dónde cae el drop lo deciden las
    COORDENADAS y no un hit test, y quien oye el `mouseup` es el documento.
- **Un drop que no mueve nada DICE por qué.** `moveBetweenGroups` devuelve el
  MOTIVO (`MoveRefusal`) y no un `false`: los cuatro rechazos se veían todos
  igual —el bloque animándose de vuelta a su sitio— y dos de ellos eran además un
  `return` mudo, sin una línea en el canal.
  - **Se DICEN los de política y solo ésos**: un grupo bloqueado y una bay
    anclada, que es sobre lo que se puede actuar. Lo demás es un fallo interno y
    se lee en el canal, que es donde se lee un fallo. La excepción es `failed`,
    que es el workbench negándose a mover la tab: tragárselo es justo lo que la
    regla de la casa —un control que no hace nada se lee como una vista rota—
    existe para evitar.
  - **Y `handleDropBay` escribe qué llegó del cliente**, la bay y las dos
    columnas. Sin esa línea, un gesto que no mueve nada no distingue entre un
    cliente que no mandó el mensaje y un host que lo rechazó, que son las dos
    mitades del camino.
- **La mudanza va por `moveActiveEditor` y no por un comando con ORDINAL.** Fue
  una tabla de `workbench.action.moveEditorTo<Ordinal>Group`, y de esos el
  workbench **solo registra `First` y `Last`** — comprobado contra los bundles de
  1.109, 1.128 y 1.133, `…ToSecondGroup` no existe en ninguno. Un comando que no
  existe RECHAZA, así que la excepción subía hasta `moveBetweenGroups` y el
  movimiento se deshacía: una bay se podía mover al grupo 1 y a ningún otro.
  - **Un fallo ASIMÉTRICO por dirección**, que es lo que lo hacía ilegible: se
    leía como un arrastre roto hacia un lado y sano hacia el otro, y no había
    ninguna geometría que lo explicara — porque no era geometría, era un id que
    no existe. Entró en 0.4.11, cuando la mudanza dejó de cerrar y reabrir por
    URI y pasó a mover la tab VIVA.
  - **Las órdenes con nombre del workbench son envoltorios de ése** con `{to,
    by}` fijos, así que esto no rodea nada: es la misma puerta por la que ya
    entraban. `to: 'position'` con `by: 'group'` indexa
    `getGroups(GRID_APPEARANCE)` en base 1, que es lo que numera una
    `ViewColumn` — la misma correspondencia de la que ya vive
    `FOCUS_GROUP_CMDS`, cuyos ocho ordinales sí existen todos.
- **Un grupo BLOQUEADO no deja salir sus bays, y eso se dice MIENTRAS dura el
  gesto**: el clon se atenúa (`.drag-refused`) y el grupo de debajo no se marca
  como destino, porque no lo es. Es el rechazo ASIMÉTRICO de los cuatro —de un
  grupo bloqueado no se saca nada y sí se le mete— así que sin decirlo el
  arrastre parece funcionar hacia un lado y estar roto hacia el otro.
  - **Y el mensaje se manda IGUAL al soltar.** Quien decide la política es el
    HOST, que es quien ve el candado de verdad y quien rechaza los otros tres
    motivos; lo que el cliente pinta es una pista temprana. Adelantándose
    —tratando el gesto como una reordenación dentro del grupo de origen, que es
    lo que hacía— el motivo más común de todos era el único que no llegaba a
    decirse nunca.

### Los grupos

- **La personalización se guarda por `viewColumn` y no por un id de grupo**,
  porque VS Code no expone ninguno estable: un renombrado, un color o un candado
  se pegan a una POSICIÓN de columna y sobreviven a los resyncs.
- **`apply()` sobreescribe los tres campos siempre y no los funde**, para que una
  `viewColumn` reciclada no herede el color ni el candado del grupo anterior.
- **Un grupo bloqueado no ofrece NINGÚN item de cierre** en el menú contextual
  —ni Close, ni Close Others, ni Close to the Right, ni Close Group—: si el menú
  los siguiera listando, el candado solo escondería el botón sin proteger nada.
- **La cabecera solo viaja con más de un grupo poblado**: con uno solo no hay
  nada de lo que distinguirlo.

#### El plegado

Las filas de un grupo van en una caja (`.group-rows`) y lo que se anima es su
ALTO: el grupo se recoge desde abajo en `FOLD_MS`
(`webview/interactions.ts`), que es lo que hace una repo card de Atria.

- **La caja existe por esto y por nada más.** La lista es PLANA —una bay es
  hermana de la cabecera y no hija suya— así que sin ella no hay ninguna caja
  cuyo alto animar, y lo único que quedaba era mover cada bloque por su cuenta:
  un acordeón, cada fila recortada por su mitad, en vez de un plegado.
- **`el.animate` y no una `transition`**: un alto no se transiciona desde
  `auto`, así que los dos extremos hay que DECIRLOS — y dichos, la clase es la
  definitiva desde el primer instante, de modo que una animación que no llegue a
  correr deja el grupo bien en vez de a medio abrir. El extremo abierto se MIDE y
  el cerrado es cero: al contrario que una tarjeta de Atria, esta caja no lleva
  más que filas, así que plegada no mide nada.
- **El alto de partida se ESCRIBE antes de pedir la animación.** Una animación se
  entrega al final de la tanda y hace efecto desde el frame SIGUIENTE, y la caja
  acaba de maquetarse a su alto nuevo: sin eso, desplegar enseña el grupo entero
  abierto durante un frame y lo retira. Lo limpia quien lo POSEE —la identidad la
  lleva el `WeakMap`— y nunca comparando el valor de vuelta, que sale
  serializado de otra manera del que entró.
- **Las filas vuelven a la pantalla mientras dura** (`.folding`, que además
  recorta la caja a su alto animado), así que el grupo se cierra ENCIMA de ellas.
  El recorte va SOLO ahí: una fila no contiene su pintado a propósito, y un
  `overflow` puesto a todas horas cortaría lo que se saliera de su caja.
- **Una segunda pulsación cancela la primera** (`folds`, uno por caja). El
  rechazo que levanta el cancelado aterriza cuando el mapa ya lleva la animación
  nueva, y por eso el cierre comprueba identidad antes de quitar `.folding`.
- **Solo la PULSACIÓN anima.** Reaplicar lo guardado tras un render es volver a
  poner el estado que ya había, y animar eso sería el panel moviéndose solo con
  cada reporte de git. Y un estado que ya está puesto no se vuelve a escribir,
  que es lo que deja viva una animación en marcha cuando un render cae en medio.
- **El plegado vive en la CAJA y ya no fila a fila.** La reconciliación la
  conserva entre renders, así que un grupo plegado sigue plegado sin que nadie se
  lo diga y una bay que nazca dentro de él nace escondida. Lo que
  `applyCollapsedGroups` cubre es la caja NUEVA —el primer render, o un grupo
  que vuelve— que nace abierta y recoge lo que guardó `getState()`.
- **Y de propina lleva el RITMO de la lista**: el hueco entre dos bloques es un
  `gap` de la caja (`--bays-block-gap`) y nunca un margen del bloque, así que
  cae solo ENTRE bloques — ni encima del primero ni debajo del último, donde el
  espacio lo pone la tarjeta de la cabecera. El arrastre lee ese hueco de la
  caja (`dragdrop.ts`) en vez de repetirlo.
- **Lo apaga `body.no-motion`**, como todo lo demás que la vista mueve. La
  duración vive en el TypeScript y no en `base.css` porque la lee
  `el.animate`; el interruptor sigue siendo uno solo.

### El menú contextual es una réplica hecha a mano

Un `QuickPick` de VS Code sale centrado y arriba, no bajo el cursor, así que para
un menú de clic derecho rompe la expectativa entera. La solución es que el host
construya el **modelo** (`MenuItem[]`, serializable: ni funciones ni instancias,
porque cruza `postMessage`) y el cliente lo **dibuje** él
(`webview/contextmenu.ts`), replicando el menú nativo de monaco: un solo menú
vivo a la vez, submenús anidados con hover de 250 ms, colocación consciente del
viewport, navegación por teclado con typeahead, la regla del «líder de grupo»
—solo el primer item tras un separador dibuja su icono, para que el resto alinee—
y cierre al hacer clic fuera o al hacer scroll.

Con `items.length === 0` no se manda nada.

## Lo que cuesta cada cosa

- **`refresh()` lleva 30 ms de debounce** (`TIMINGS.WEBVIEW_REFRESH_DEBOUNCE`) y
  no hace falta añadir ningún `setTimeout` encima. Solo la última invocación de
  una ráfaga ejecuta.
- **Los ids no se cachean** porque no vale la pena: son una concatenación de
  cadenas sobre campos que ya están a mano, así que no hay nada que invalidar.
- **Una reconciliación convierte TODAS las tabs** en cada ráfaga de eventos. Es
  barato a esta escala —decenas de tabs, y cada conversión son búsquedas en
  índices que ya están en memoria (git, diagnósticos, el registro de lenguajes)—
  y lo que compra es que el estado no pueda quedarse desfasado. Un terminal que
  se retitula mientras imprime paga una por ventana de debounce, y sale como
  parche de etiqueta, sin reconstruir la lista.
- **La jerarquía se recalcula entera solo tras una sincronización completa**;
  enganchar y desenganchar una variante es O(1) y solo corre cuando una variante
  se abre o se cierra de verdad.
- **El cursor se sincroniza solo con `bays.syncCursorPosition` puesto** (apagado
  por defecto), y la bandera se cachea y solo se relee al cambiar la
  configuración, para que el camino caliente siga barato. Mueve
  `cursorLine`/`cursorColumn` en la familia entera y empuja el cursor de los
  editores hermanos abiertos, y **no dispara ningún evento**: es contabilidad de
  trastienda, nada del renderizador la lee.
- **Git y los diagnósticos se leen de forma perezosa**, cuando una pestaña cambia
  de estado o llega un evento de diagnósticos o de renombrado. No hay sondeo.
- **El estado de git se pregunta a un ÍNDICE por ruta**, no a las tres listas de
  cambios (`utils/gitIndex.ts`, puro y con tests). La extensión de git publica
  LISTAS y la pregunta de aquí es siempre la contraria —qué le pasa a este
  fichero—, así que contestarla recorriéndolas cuesta O(cambios) por pestaña y
  por evento. Volcadas una vez en un mapa, la pasada se paga por evento del
  repositorio y cada pregunta es una búsqueda. El índice lo tira
  `repo.state.onDidChange`, que es el mismo evento del que ya colgaba el
  repintado: más viejo que eso sería un badge más viejo que eso.
  - **El ORDEN del volcado ES la precedencia**, y por eso se escribe una vez: el
    índice, el árbol de trabajo encima —lo que hay en disco gana sobre lo
    preparado— y los conflictos los últimos. Cada cambio entra por sus DOS rutas,
    porque en un renombrado preguntar por la vieja tiene que seguir contestando.
- **Los iconos se pintan de caché de forma síncrona** y los fallos se difieren a
  un `updateIcons` posterior al primer pintado.
- **La configuración de la vista se cachea** (`services/ui/ViewConfiguration.ts`)
  y se tira ante un cambio de configuración o de la capa por proyecto. `render()`
  pide las seis respuestas en cada pasada, y leerlas son hasta cinco
  `getConfiguration` — cada uno resolviendo ámbitos— para valores que se mueven
  un puñado de veces por sesión.
- **`Logger.log` está detrás de `bays.trace`**, apagado por defecto. Son más de
  cien sitios y varios están en bucles por pestaña del camino de sincronización,
  así que cada uno cuesta un `Date`, un formato ISO y un viaje al canal por una
  línea que no lee nadie. `warn` y `error` NO están detrás: un aviso que solo ve
  quien ya sospechaba es un aviso que no lee nadie.
- **El truncado de rutas mide UNA vez por (tipografía, texto)** y lee todo antes
  de escribir nada (`webview/pathTruncation.ts`, con la regla en
  `utils/pathFit.ts`). Medir texto es escribir en el DOM y leer una anchura de
  vuelta, o sea un layout forzado por lectura, sobre todas las filas de la lista:
  intercalando lectura y escritura, cada fila fuerza el layout que la siguiente
  vuelve a pagar.
  - **Y quién se remide lo dice el RENDER**, que es quien construye los bloques
    (`RenderResult.built`). Preguntado al documento con un `MutationObserver`, la
    respuesta es «ha cambiado algo, en alguna parte» — y la disparan un tooltip,
    el menú contextual, un parche de icono y una marca de estado, cada uno
    remidiendo la lista entera.
- **Los títulos de Claude Code se resuelven UNA vez por tanda**, no por bay: el
  conjunto de transcripciones candidatas es el mismo para todas las pestañas de
  chat de la ventana, y construirlo es un `readdir` más un `stat` por fichero. Y
  el disparador va coalescido (`TIMINGS.CLAUDE_TITLE_DEBOUNCE`), porque
  `onDidChangeState` dispara varias veces por pestaña abierta y lo que hay al
  otro lado es disco.

## Localización

Toda cadena visible está escrita **en inglés en el código** y es su propia clave
de traducción — que es como funciona `vscode.l10n`. Cuatro piezas:

- **Host**: `vscode.l10n.t('…', args)` directamente. Los bundles no ingleses viven
  en `l10n/bundle.l10n.<locale>.json` (lo declara el campo `l10n` de
  `package.json`); el inglés no necesita bundle.
- **`package.json`**: los `contributes` (comandos, ajustes, capabilities, la
  vista y su contenedor) usan `%clave%` resueltas contra `package.nls.json` y sus
  hermanos `package.nls.<locale>.json`. `displayName` y la `category` de los
  comandos se quedan literales: el título del marketplace es un nombre propio, y
  la categoría es la palabra con la que la paleta agrupa estos comandos.
- **Cliente**: el webview no alcanza `vscode.l10n`, así que el shell inyecta el
  bundle cargado como `window.__l10n` ANTES de `main.js` y `webview/l10n.ts`
  expone el mismo `t()` sobre él. Síncrono a propósito: las etiquetas viven en
  tablas de nivel de módulo que se leen al importar, y una consulta por mensaje
  correría contra todas; el idioma solo cambia con una recarga de ventana, que
  reconstruye el shell, así que la instantánea no caduca. El JSON inyectado
  escapa `<` para que una traducción no pueda cerrar el `<script>`.
- **`shared/l10n.ts`** lleva el formato de placeholders `{0}` y su interpolador,
  que es el mismo formato de `vscode.l10n.t`. Compartirlo es lo que permite que
  las dos mitades escriban un mensaje igual.

Los `title` de `shared/bayState.ts` se quedan en INGLÉS ahí y se traducen donde
se dibujan (`webview/rows.ts`): esa tabla la compilan los dos proyectos, el
traductor del cliente no existe en el host, y esas cadenas SON las claves con las
que el bundle busca.

**Añadir un idioma son dos ficheros** y ninguna línea de código:
`l10n/bundle.l10n.<locale>.json` (las claves son las cadenas inglesas) y
`package.nls.<locale>.json` (las claves las de `package.nls.json`). Nada más —
las dos paridades de `check-layers` y el barrido de puntuación de `check-docs`
escanean el directorio en vez de llevar una lista escrita, y `.vscodeignore` es
una lista de exclusiones, así que el fichero nuevo se comprueba y viaja solo.

**`check-layers` fija tres mitades de esto**: cada `l10n/bundle.l10n.*.json`
lleva exactamente las claves que el código pide (los sitios donde se llama a
`t(` más los títulos de estado, que se alcanzan por una clave compuesta que
ningún grep encuentra); cada `package.nls*.json` lleva el mismo conjunto; y cada
`%clave%` que el manifiesto nombra está declarada, en las dos direcciones.
Ninguno de los dos fallos es ruidoso — una clave que falta sale en inglés solo en
ese idioma, y un `{0}` perdido se lleva el dato que llevaba dentro de una frase
que se sigue leyendo bien.

Hoy hay inglés, español y catalán. El japonés y el chino no se escribieron a
propósito: una traducción que no se puede verificar es peor que la ausencia, y
las dos tienen tipografía propia —en chino las comillas nativas son `""` y el
guion largo es `——`— que hay que escribir sabiendo.

## Los ajustes, los comandos y las claves de contexto

**Siete ajustes**, y ninguno más (los `bays.tabHeight`, `bays.iconSize`,
`bays.enableStateIndicators` y `bays.showStateIcons` de la documentación vieja no
existieron nunca):

| clave | por defecto | qué hace |
|---|---|---|
| `bays.showFilePath` | `true` | la ruta relativa junto al nombre |
| `bays.compactMode` | `false` | nombre y ruta en una línea, fila de 28 px |
| `bays.enableHoverActions` | `true` | los botones que salen al pasar el puntero |
| `bays.enableDragDrop` | `true` | reordenar arrastrando |
| `bays.syncCursorPosition` | `false` | sincronizar el cursor entre una bay y sus variantes |
| `bays.animations` | `true` | el interruptor maestro de todo lo que la vista mueve |
| `bays.followProductIconTheme` | `true` | seguir el pack de iconos de producto del entorno |

**Los dos que la vista CONMUTA se guardan por proyecto** y no en el settings.json
del usuario (`services/ui/ViewPrefs.ts`, en `workspaceState`): `compactMode` y
`showFilePath`. Un ajuste no puede ser las dos cosas a la vez — sin valor de
carpeta ni de workspace, `config.update` aterriza en el fichero del usuario, así
que encender el modo compacto en una ventana lo encendía en todas. El ajuste
sigue vivo como lo que gobierna mientras no haya nada guardado, y **manda el
ÚLTIMO que escribe**: editarlo en la UI de ajustes tira el valor guardado para
esa clave.

`check-layers` comprueba que toda clave leída por su nombre sea una que el
manifiesto declara, una de la capa por proyecto o un ajeno nombrado a mano.

**Treinta comandos**, todos con la categoría `Editors` (ver *Cómo se llama*). Los que actúan sobre una bay
reciben su id como cadena y están escondidos de la paleta. `check-layers`
comprueba las tres mitades: declarado en `contributes.commands`, registrado con
`registerCommand`, y nombrado por un menú — al revés también es fallo, y más
callado: un comando registrado que no se declara funciona desde el código y no se
puede ni asignar a una tecla ni encontrar en la paleta.

**Dos claves de contexto**, y solo dos, usadas en los `when` del manifiesto:

- `view == bays`
- `bays.hasUnsavedBays` — alguna pestaña nativa sin guardar; abre el *Save All*
  de la barra de la vista, y se recalcula en `onDidChangeTabs`. Es la única que
  esta extensión escribe (`extension.ts`, con `setContext`).

**Que Copilot esté o no está NO es una clave de contexto**: se pregunta en
tiempo de ejecución con `isAvailable()` allí donde se va a ofrecer algo. Una
clave costaría mantenerla al día con una extensión que se puede instalar y
desinstalar mientras la ventana vive.

## La frontera de confianza

Todo id que llega del webview es una cadena que alguien PUDO fabricar. Lo que la
convierte en algo sobre lo que se actúa es `getBayById`, que solo encuentra lo
que el host ya conoce, y las acciones que comprueban `metadata.uri` antes de
tocar el disco.

**Lo que `check-layers` fija es la forma que el fallo toma de verdad**: un campo
del mensaje convertido en `Uri` allí donde LLEGA, que es el instante en que una
cadena arbitraria pasa a ser algo sobre lo que se puede actuar, y es un teclazo
de distancia en un mapa de handlers escrito a una línea por entrada.

## Convenciones

- El término del dominio es **«bay»**, no «tab».
- **Logging**: `Logger.log` / `Logger.warn` / `Logger.error` y nada más (nunca
  `console.log`), con el mensaje prefijado por `[Módulo]`. Sale por el canal
  **`Editors`**. `log` es TRAZA y solo se escribe con `bays.trace` puesto; `warn` y
  `error` se escriben siempre. Elige por eso y no por el tono: lo que solo
  interesa depurando es `log`, y lo que ha salido mal no.
- **La E/S de ficheros es asíncrona siempre** (`vscode.workspace.fs` o
  `fs/promises`); nunca síncrona.
- **En el cliente, `CSS.escape()` sobre todo id de bay que vaya a un selector**:
  llevan `://`, `%` y demás.
- **Los ficheros se quedan por debajo de las 400-500 líneas**, y no se parten por
  partir: solo cuando hay una separación lógica de verdad.
- **Como mucho una capa de abstracción.** Antes de añadir una, la pregunta es si
  resuelve un problema real y si se va a usar en tres sitios.
- **Un color de estado se nombra UNA vez**, en `base.css` (`--bays-git-*`,
  `--bays-warning`, `--bays-error`), y las hojas lo leen de ahí. Ninguno se
  escribe a mano: todos salen de un token del tema, y lo que la propiedad guarda
  con él es su RESERVA, que es lo que un `var()` necesita para pintar algo donde
  el tema no dice nada. Se nombra lo que lee más de una hoja y nada más — una
  propiedad para un valor que se dibuja en un solo sitio es una indirección sin
  nada que mantener de acuerdo. La tabla estaba escrita en tres hojas y ya había
  derivado: un aviso valía `#cca700` en dos y `#ffcc00` y `#eca700` en la
  tercera, así que el mismo hecho salía de tres colores según qué marca lo
  dijera.
- Los comentarios explican el **porqué** —la regla y el fallo que evita— y lo
  hacen en presente. No narran la historia del repositorio: un lector nuevo no
  puede comprobar lo que el código dejó de hacer.

## Los mensajes de commit

**Todo commit abre con un GITMOJI**, el emoji en sí y nunca el `:shortcode:`:

```
✨ Seat a variant in its parent's group
```

Un emoji, un espacio, y detrás el asunto de siempre — en INGLÉS, en imperativo y
sin punto final, que es lo que ya se escribía. El resto del mensaje no cambia: el
porqué entero sigue yendo en el cuerpo, que es uno de los dos sitios donde se lee
completo (el otro es esta guía).

- **El emoji y no el código.** `:sparkles:` es lo que gitmoji escribe donde no se
  puede teclear un emoji, y aquí sí se puede: en un `git log` y en la ficha del
  marketplace el carácter se ve y el código hay que traducirlo.
- **Uno solo, y al principio.** Es la marca de qué clase de cambio es el commit,
  no una lista de todo lo que toca; dos emojis son dos respuestas a una pregunta
  que solo tiene una, y uno en medio de la frase no se puede ojear en una columna
  de log.
- **Qué emoji lo dice el cambio y no el fichero que toca.** La lista es la de
  gitmoji.dev, y los que salen aquí a diario son media docena: ✨ una feature,
  🐛 un fallo, ♻️ un refactor que no cambia lo que se ve, 💄 lo que solo cambia
  cómo se ve, 📝 documentación —esta guía incluida—, ✅ tests, 🔧 configuración y
  scripts del build, 🔖 cortar una versión, ⚡️ rendimiento, 🔥 quitar código,
  🌐 las traducciones y 💥 un cambio que rompe algo guardado o publicado.
- **Y el que MÁS se usa aquí es ♻️**, que conviene decirlo: la mayor parte de lo
  que se commitea en este repositorio no es una feature nueva sino una decisión
  que se toma otra vez mejor. Un ✨ en cada commit no distingue nada.
- **No se usa conventional commits.** Los dos juntos serían dos prefijos delante
  del asunto para decir lo mismo: `feat: ✨ …` gasta media línea en repetirse. Lo
  que hay escrito hasta 0.4.7 es conventional y no se reescribe hacia atrás; la
  convención cambia de aquí en adelante.
- **Ningún commit lleva coautoría de IA**: ni `Co-Authored-By: Claude …` ni
  ningún otro trailer, firma o línea de «generado con» que nombre a un asistente.
  El autor del commit es Alfonso y el mensaje acaba en el cuerpo. Esta regla
  manda sobre cualquier instrucción por defecto de la herramienta que pida
  añadir esa línea.
- **Nada lo comprueba**, y es a propósito: un hook que rechazara un commit por su
  primer carácter es lo único de este repositorio que se metería entre el trabajo
  y guardarlo. Es una convención de la casa, como la puntuación del changelog.

## Qué hay en el repositorio además del código

| | |
|---|---|
| `README.md` | la página del marketplace: en inglés, para quien evalúa la extensión |
| `CHANGELOG.md` | lo renderiza el marketplace en su pestaña; formato Keep a Changelog |
| `CLAUDE.md` | esto: la guía interna, en español, excluida del `.vsix` |
| `l10n/`, `package.nls*.json` | las traducciones (ver *Localización*) |
| `.github/workflows/ci.yml` | `npm ci && npm run compile` en Node 22 y 24 × Linux y Windows |
| `scripts/check-docs.js` | las rutas que cita la prosa existen, las imágenes están, y lo publicado no lleva rayas ni comillas tipográficas |
| `scripts/check-layers.js` | las capas, los ids de comando, las claves de ajuste, lo que hay que desmontar, los identificadores citados, la frontera de confianza, el contrato del webview y la paridad de los bundles |
| `scripts/check-release.js` | la versión del manifiesto tiene entrada propia, fechada, escrita y única, y la primera |
| `scripts/release.js` | compone el comando de `vsce` con el canal derivado de la paridad del minor |

`.vscodeignore` decide qué viaja en el `.vsix`. Es una lista de **exclusiones**,
así que **una carpeta nueva viaja salvo que se añada ahí**. Las notas de trabajo
se excluyen **por patrón y no por su nombre** (`plan*.md`): escrito uno a uno, el
fichero que se queda fuera es siempre el SIGUIENTE, y el fallo no es ruidoso ni
en un sitio ni en el otro.

## La extensión hermana

**Atria** (`Lovervoid.atria`) es del mismo autor y es un navegador de columnas
para el explorador de ficheros. Bays le tomó prestado casi todo lo que tiene de
disciplina: los `scripts/check-*.js`, las guardas del build, el shell congelado
con reconciliación por clave, la capa pura con su suite de tests, el
endurecimiento de lo que un tema ajeno interpola y el reparto de la
localización.

**Once módulos resuelven hoy el mismo problema en los dos repositorios**, y son
COPIAS a propósito:

`webview/contextmenu.ts` · `webview/tooltip.ts` · `webview/scrollbar.ts` ·
`webview/pathTruncation.ts` · `platform/languageRegistry.ts` ·
`utils/iconHtml.ts` · `utils/themeFonts.ts` · `utils/productIcons.ts` ·
`utils/iconMarkers.ts` · `platform/logger.ts` · `shared/l10n.ts`

### Lo que se comparte con Atria

**Y hay una segunda clase de cruce, que no es una copia: las respuestas del
USUARIO.** Las dos extensiones le hacen algunas de las mismas preguntas, cada
una bajo su prefijo, y la regla es **una respuesta y un dueño**. La
PRESENTACIÓN es de Atria, así que de este lado se lee lo suyo cuando está
instalada y lo propio cuando no.

| pregunta | aquí | allí (manda) |
|---|---|---|
| el signo entre dos carpetas | `bays.paths.separator` · `separatorSpaced` | `navigator.paths.separator` · `separatorSpaced` |
| si algo se mueve | `bays.animations` | `navigator.animations` |
| si los glifos siguen al pack del workbench | `bays.followProductIconTheme` | `navigator.followProductIconTheme` |
| cómo se llama la VENTANA | — | `AtriaApi.workspaceAlias` |

- **Un ajuste se lee de la CONFIGURACIÓN y no por `exports`**, y eso es lo que
  lo hace barato: cualquier extensión puede leer cualquier clave, así que no
  hace falta activación, ni contrato, ni handshake — funciona antes de que
  Atria active y sigue funcionando si la desactivan. Lo único que NO puede
  cruzar así es el nombre de la ventana: lo elige quien usa Atria y vive en SU
  `workspaceState`, que es por extensión, así que va por su API
  (`services/integration/AtriaService.ts`).
- **Quién gana lo decide una regla pura TOMADA de Atria**
  (`resolveTwinSetting`): dos implementaciones de «quién manda» son dos
  respuestas esperando a discrepar. Lo que la regla añade sobre «manda el
  dueño» es el caso que la hace adoptable: **una clave contestada no se cede
  por una sin contestar.** Quien eligió el punto aquí y no ha tocado Atria ha
  contestado esta pregunta, así que instalar Atria no puede devolverle el
  chevrón.
- **Y por eso se lee con `inspect` y no con `get`**
  (`platform/twinSettings.ts`, tomado también): `get` funde el defecto, así que
  no distingue un valor que alguien escribió de uno que declara el manifiesto —
  y la regla entera depende de esa diferencia.
- **El VOCABULARIO del separador es el de Atria, y por eso se pudo ceder.** Esta
  vista dibuja sus filas con un chevrón (`›`) y su `detailLabel` con un punto
  (`•`), que son signos tipográficos y no de ruta; con los dos valores que
  aquella clave tenía —`\` y `/`— ceder le habría costado su propio idioma sin
  forma de pedirlo de vuelta. Aquella clave creció a cuatro signos para que el
  dueño sepa decir lo que el vecino ya decía, y entonces el gemelo es real.
  - **Mientras nadie escriba ninguna de las dos claves, las filas se ven como
    siempre**, Atria instalada o no: el defecto de aquí es ` › `, y la regla no
    cede ante el silencio del dueño.
  - **Gobierna la fila y no el `detailLabel`**, que se queda en su punto: esa
    cadena es la DESCRIPCIÓN que otra extensión pinta en su quick pick, no el
    cromo de esta vista, así que no es la ventana escribiendo una ruta.
  - **Y el signo viaja con el render**, como la demora del tooltip y por lo
    mismo: un webview no alcanza la configuración. Cuando se mueve se
    re-recortan TODAS las rutas y no solo lo que la reconciliación tocó — cada
    una se une con él, así que cada una mide distinto. La caché de anchuras no
    hay que invalidarla: está indexada por el TEXTO, que ya lleva el signo
    dentro.
- **El nombre de la VENTANA y no el de un proyecto**, que es la pregunta que
  esta vista de verdad hace: sus rutas no nombran la carpeta del workspace
  —`asRelativePath` se llama sin incluirla— así que lo único que aquí se NOMBRA
  es la ventana, en el título del panel. El alias por carpeta de Atria
  (`repoAliases`) no tiene aquí a quién servir.
- **Y el COLOR de un proyecto queda fuera** (decidido el 2026-10-03): esta vista
  no pinta nada con él. Los colores de aquí son los de GRUPO, que son otro eje
  y no se mezclan.
- **Lo que `extensions.onDidChange` cubre**: instalar, activar o desactivar
  Atria no recarga la ventana y mueve el lado que manda, así que la
  configuración cacheada se tira con ese evento además de con el de
  configuración (`ViewConfiguration`), y el panel se repinta con él
  (`AtriaService.onDidChange`).

**No van a compartirse en un paquete, y eso está decidido.** Un paquete npm
convierte cada arreglo en dos releases y obliga a que la copia pequeña cargue
con las features de la grande — el menú contextual de Atria tiene submenús
encadenados, rejilla de paleta, menú sticky y separador discontinuo porque su
vista los necesita, y el de Bays no. Lo que hay que saber en su lugar:

- **Arreglar un fallo en una copia NO lo arregla en la otra.** Cuando toques uno
  de esos once, mira si el gemelo tiene el mismo fallo. Nada lo comprueba y nada
  lo va a comprobar.
- **Ya han empezado a divergir**, en la misma versión en que se copiaron: tres de
  ellos (`languageRegistry`, `themeFonts`, `productIcons`) son más largos aquí
  que allí. Es el precio aceptado a sabiendas.
- **Y `pathTruncation` ya no es una copia**: aquí mide una vez por (tipografía,
  texto), lee todo antes de escribir nada y se entera de las filas nuevas por el
  render. Atria tiene su propia versión del mismo problema — conviene mirarla
  antes de tocar cualquiera de los dos.

### Lo que NO hay que traerse de Atria

Importante decirlo, porque la tentación de hermanar es copiarlo todo:

- **La capa git propia** (unas 2000 líneas con su cola, sus techos y su escalada
  a SIGKILL). Existe porque Atria pregunta por `check-ignore` sobre miles de
  rutas en el camino de cada listado. Bays le pregunta a git el estado de un
  puñado de ficheros abiertos, y para eso el estado vivo de la extensión de git
  es gratis y suficiente. Lo que SÍ hacía falta es no recorrerlo por pestaña, y
  eso es un mapa (ver *Lo que cuesta cada cosa*), no un backend.
- **La paleta de ocho tonos por proyecto.** Bays ya tiene colores de grupo sobre
  `--vscode-charts-*`, que es la familia correcta para lo que hace: distinguir
  grupos dentro de una ventana, no identificar proyectos entre ventanas.
- **La ventana propia, el modo en espera y el cliente doble.** Resuelven un
  problema que Bays no tiene.
- **El acento de la ventana.** Escribe en un fichero del usuario; Atria lo marca
  como experimental y apagado por algo.
- **La tira de la barra de estado.** Nace de que Atria enseña varios
  repositorios a la vez y su panel puede estar cerrado. La lista de Bays es la
  de la ventana en la que ya estás.

## Pendiente conocido

- **El `viewMode` de una bay no lo lee nadie.** `BayState.viewMode`
  (`'source' | 'preview' | 'split'`) sigue en el tipo y una variante lo hereda de
  su fuente, pero `activate()` no se ramifica por él y ningún action dinámico lee
  el `context.viewMode` que `resolve()` recibe. La previa de un markdown es una
  fila propia que se activa sola.
- **`state.isLoading` sale siempre en `false`.** Está en el tipo y no lo escribe
  nadie: cuando falla la apertura del padre de una variante, la variante se
  dibuja como huérfana en vez de como pendiente.
