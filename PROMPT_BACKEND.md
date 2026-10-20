# Prompts para el backend (Miqueas)

Son prompts para pegar en Claude Code, **abierto dentro de `api-eventos/`**. Se
usan los mismos en todas las fases: solo hay que cambiar el número de fase.

Cada fase lleva **dos sesiones**:

1. **Contrato.** Claude escribe la sección de la fase en `docs/API.md`. Se revisa
   y se mergea enseguida, para que el front pueda empezar.
2. **Implementación.** Claude implementa exactamente lo que dice el contrato.

## Antes de cada sesión

- Abrir la terminal en `api-eventos/` y crear la rama:
  `git checkout -b back/fase-N-contrato` o `back/fase-N`.
- Arrancar con una sesión limpia (`/clear`).
- Activar el **modo plan** (Shift+Tab) para que proponga el plan antes de tocar
  archivos.
- La base tiene que estar levantada y el `.env` completo.

---

## Prompt 1 · Contrato de la fase

```text
Vamos a trabajar el CONTRATO de la Fase [N] del backend.

Leé, en este orden:
1. ../CLAUDE.md (proyecto, modelo de datos, reglas de negocio)
2. ./CLAUDE.md (convenciones del backend)
3. ../ROADMAP.md, solo la sección "Fase [N]" → "Backend · Miqueas"
4. ../docs/API.md (contrato actual y formato)
5. Los controllers y routes que ya existen, para respetar nombres y estilo.

Tarea: agregar a ../docs/API.md la sección "## Fase [N] · <nombre>" con TODOS
los endpoints de esa fase, usando el formato del documento. Para cada endpoint:
- método, ruta y acceso (público / con token / solo admin);
- body de ejemplo con todos los campos, marcando los obligatorios;
- respuesta de ejemplo con JSON realista y los nombres EXACTOS de los campos,
  incluidos los calculados (por ejemplo vencida o margen) y los que vienen
  de JOINs (por ejemplo nombre_cliente);
- query params de filtro, si los hay;
- cada error posible, con su código y su mensaje exacto.

Reglas:
- Respetá los nombres de columnas de CLAUDE.md. Si un campo calculado o de un
  JOIN necesita un nombre nuevo, usá snake_case en español.
- Pensá qué datos va a necesitar el front para dibujar cada pantalla de la fase
  (está en la parte "Frontend · Compañero" de la misma fase), así no tiene que
  hacer pedidos extra.
- No escribas código en esta sesión. Solo docs/API.md.
- Si algo del ROADMAP es ambiguo o choca con las reglas de negocio, preguntame
  antes de decidir.

Primero mostrame la lista de endpoints que vas a documentar, con una línea por
endpoint, y esperá mi OK. Después escribí la sección completa.
```

---

## Prompt 2 · Implementación de la fase

```text
Vamos a IMPLEMENTAR la Fase [N] del backend.

Leé, en este orden:
1. ../CLAUDE.md
2. ./CLAUDE.md
3. ../ROADMAP.md, sección "Fase [N]" → "Backend · Miqueas" (incluye el "Listo cuando")
4. ../docs/API.md, sección "Fase [N]": es el contrato. Hay que implementarlo
   EXACTAMENTE igual: mismas rutas, mismos campos, mismos códigos y mensajes.
5. El código actual de src/ y database/.

Forma de trabajo:
1. PLAN. Mostrame:
   - archivos a crear, modificar o borrar, con una línea de qué hace cada uno;
   - consultas SQL principales y cuáles van en transacción;
   - cómo vas a garantizar el filtro por empresa en cada endpoint;
   - cualquier punto donde el contrato o el ROADMAP no alcancen para decidir.
   Esperá mi OK antes de escribir código.
2. IMPLEMENTACIÓN, siguiendo las convenciones de ./CLAUDE.md. Si al implementar
   aparece la necesidad de cambiar el contrato, frená y preguntame: lo usa el
   frontend.
3. VERIFICACIÓN:
   - si la fase toca la base: recreá la base de cero con schema.sql y seed.sql;
   - levantá la API y probá cada endpoint con curl usando el token de un
     usuario del seed: un caso exitoso, uno de 400, uno con un id de otra
     empresa (tiene que dar 404) y, si aplica, uno de 409;
   - compará cada respuesta con docs/API.md;
   - chequeá uno por uno los ítems del "Listo cuando" de la fase.
   Mostrame los comandos y lo que respondió cada uno.
4. README: actualizá api-eventos/README.md (endpoints y estructura).
5. EXPLICACIÓN, en español:
   - qué hiciste y en qué archivos;
   - por qué elegiste cada solución (sobre todo transacciones, validaciones y
     filtros por empresa), para que lo pueda defender ante el profesor;
   - decisiones que tomaste sin que estuvieran definidas;
   - qué debería probar yo a mano antes del PR.

No toques nada fuera de api-eventos/ (salvo leer los docs). No hagas commits.
```

---

## Prompts cortos de apoyo

**Si algo falla o quedó distinto al contrato:**

```text
El endpoint [MÉTODO /ruta] responde [lo que pasa] y según docs/API.md debería
responder [lo esperado]. Encontrá la causa, explicámela y corregila sin
cambiar el contrato. Después volvé a probarlo con curl.
```

**Si tu compañero pide un cambio en el contrato:**

```text
El frontend necesita este cambio en el contrato de la Fase [N]: [descripción].
Evaluá el impacto en el código ya implementado. Proponeme cómo actualizar
docs/API.md y el código, y esperá mi OK. Después aplicalo, probalo y resumime
qué cambió para avisarle.
```

**Para estudiar lo que se hizo (antes de la defensa):**

```text
Explicame la Fase [N] del backend como si me fueran a evaluar: el recorrido de
un request desde la ruta hasta la base, por qué cada transacción es necesaria y
qué pasaría sin ella, y 5 preguntas que me podría hacer el profesor, con sus
respuestas.
```
