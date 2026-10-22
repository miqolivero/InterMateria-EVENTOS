# Sistema de gestión de eventos

Aplicación para organizadoras de eventos: clientes, catálogos, solicitudes,
presupuestos con versiones, eventos, proveedores, tareas y seguimiento.
Cada usuario pertenece a una empresa y la API filtra sus datos por esa empresa.

## Empezar

```bash
git clone --branch main https://github.com/miqolivero/InterMateria-EVENTOS.git
cd InterMateria-EVENTOS
```

El clon incluye el código, los ejemplos de configuración y los scripts SQL.
Cada computadora necesita su propia configuración y su base de datos.

Seguir la **[guía de instalación](docs/INSTALACION.md)**: explica los requisitos,
los `.env`, una base nueva con datos de demo y la actualización de una base
existente conservando datos. No ejecutar `schema.sql` sobre una base con datos
que se quieran conservar: borra las tablas antes de recrearlas.

Con la instalación completada, abrir dos terminales desde la raíz:

| Terminal | Carpeta | Comando | Dirección |
| --- | --- | --- | --- |
| Backend | `api-eventos` | `npm run dev` | `http://localhost:3000/api` |
| Frontend | `front-eventos` | `npm run dev` | `http://localhost:5173` |

Solo login y registro son públicos en la interfaz. La API valida el token y
los permisos en cada operación protegida. La lista pública de empresas permite
seleccionar una empresa activa durante el registro.

## Documentación

- [Instalación, configuración y solución de problemas](docs/INSTALACION.md).
- [Arquitectura y funcionamiento](DOCUMENTACION.md).
- [API: ejecución, endpoints y cuentas de demo](api-eventos/README.md).
- [Frontend: pantallas, pruebas y vista ficticia](front-eventos/README.md).
- [Contrato de la API](docs/API.md) y [decisiones de diseño](docs/DECISIONES.md).
- [Roadmap](ROADMAP.md), [estado de integración](front-eventos/INTEGRACION-BACKEND.md)
  y [recorrido de demostración](front-eventos/DEMO.md).

## Verificación

Desde `front-eventos`:

```bash
npm run lint
npm test
npm run build
```

Las pruebas automáticas no escriben en la base real. El circuito completo de
integración se comprueba con la API y una base de prueba; ver la guía de demo.

## Archivos locales

No se versionan los `.env`, `node_modules`, `dist`, `Intermaterias/` ni
`laboratorio-bd/` (incluidos los respaldos). Los `.env.example` contienen solo
plantillas; completar sus valores localmente. No hay configuración Docker.
