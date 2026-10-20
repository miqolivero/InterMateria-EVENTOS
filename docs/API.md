# Contrato de la API

Este documento es el acuerdo entre el backend y el frontend. **Lo mantiene el
backend**: se escribe la sección de cada fase **antes** de implementarla, y
después no se cambia sin avisar.

- Base URL: `http://localhost:3000/api`
- Formato: JSON. Las fechas van como `YYYY-MM-DD` y los montos como número.
- Rutas protegidas: header `Authorization: Bearer <token>`.
- Errores: siempre `{ "mensaje": "..." }`.

| Código | Significado |
| --- | --- |
| 400 | Faltan datos, datos inválidos o duplicados |
| 401 | Sin token, token inválido o vencido |
| 403 | El rol no alcanza |
| 404 | No existe o pertenece a otra empresa |
| 409 | La acción no es válida para el estado actual o tiene registros asociados |
| 500 | Error inesperado |

---

## Formato de cada endpoint

Copiar este bloque para cada endpoint nuevo:

````markdown
### POST /recurso

Acceso: con token | solo admin | público

Body:
```json
{ "campo": "valor" }
```

Respuesta 201:
```json
{ "id_recurso": 1, "campo": "valor" }
```

Errores:
- 400 · "El campo es obligatorio"
- 404 · "Recurso no encontrado"
````

---

## Estado actual (antes de la fase 1)

### Autenticación · `/api/auth`

| Método | Ruta | Acceso | Respuesta |
| --- | --- | --- | --- |
| POST | `/register` | Público | 201 / 400 / 409 |
| POST | `/login` | Público | 200 / 401 |
| GET | `/perfil` | Con token | 200 / 401 |

`POST /login` responde:

```json
{
  "token": "eyJhbGci...",
  "usuario": { "id": 1, "nombre": "Ana", "email": "ana@mail.com", "rol": "usuario" }
}
```

### Empresas · `/api/empresas`

| Método | Ruta | Acceso | Respuesta |
| --- | --- | --- | --- |
| GET | `/` | Público | 200 |
| GET | `/:id` | Público | 200 / 404 |
| POST | `/` | Con token | 201 / 400 / 401 |
| PUT | `/:id` | Con token | 200 / 400 / 401 / 404 |
| DELETE | `/:id` | Solo admin | 204 / 401 / 403 / 404 |

Empresa:

```json
{
  "id_empresa": 1,
  "nombre": "Eventos del Centro",
  "cuit": "30-71234567-8",
  "email": "contacto@eventosdelcentro.com",
  "telefono": "351-4001122",
  "direccion": "Av. Colón 1200, Córdoba",
  "activo": true,
  "fecha_creacion": "2026-10-01T12:00:00.000Z"
}
```

---

<!-- Las secciones de cada fase se agregan debajo: "## Fase 1 · ...", "## Fase 2 · ..." -->
