# Prompts para el backend (Miqueas)

Son prompts para pegar en Claude Code, **abierto dentro de `api-eventos/`**. Se
usan los mismos en todas las fases: solo hay que cambiar el número de fase.

Cada fase lleva **dos sesiones**:

1. **Revisión del contrato.** `docs/API.md` ya está completo. Claude revisa la
   sección de la fase contra el modelo y las reglas, y te avisa si algo no
   cierra. Si hay que cambiar algo, se cambia, se anota en el historial y se le
   avisa al compañero.
2. **Implementación.** Claude implementa exactamente lo que dice el contrato.

## Antes de cada sesión

- Abrir la terminal en `api-eventos/` y crear la rama:
  `git checkout -b back/fase-N`.
- Arrancar con una sesión limpia (`/clear`).
- Activar el **modo plan** (Shift+Tab) para que proponga el plan antes de tocar
  archivos.
- La base tiene que estar levantada y el `.env` completo.

---

## Prompt 1 · Revisión del contrato de la fase

```text
Vamos a REVISAR el contrato de la Fase [N] del backend, antes de implementarla.

Leé, en este orden:
1. ../CLAUDE.md (proyecto, modelo de datos, reglas de negocio)
2. ./CLAUDE.md (convenciones del backend)
3. ../ROADMAP.md, solo la sección "Fase [N]" (Backend y Frontend)
4. ../docs/API.md: "Convenciones generales" y la sección "Fase [N]"
5. El código actual de src/ y database/

Tarea: revisar que el contrato de la Fase [N] se pueda implementar tal cual y
que sea coherente. Chequeá:
- que cada campo exista en el modelo o se pueda calcular (decime con qué JOIN o
  con qué cálculo SQL);
- que las reglas de negocio de CLAUDE.md estén cubiertas por algún error
  (400/409);
- que no falte nada que el front necesite para las pantallas de la fase;
- que no choque con lo que ya está implementado en fases anteriores.

Respondé con:
1. Lo que está OK.
2. Problemas o ambigüedades, con una propuesta de solución para cada uno.
3. Un plan de implementación resumido (archivos y consultas principales).

No escribas código ni modifiques docs/API.md hasta que yo te diga qué
propuestas acepto. Si acepto un cambio en el contrato, actualizá
docs/API.md, agregá una fila en "Historial de cambios" y redactame un mensaje
corto para avisarle a mi compañero qué cambió.
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
