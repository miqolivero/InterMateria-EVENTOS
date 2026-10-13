# Inter-Materias · Sistema de Eventos

Proyecto de Programación II. Una API REST en Node + Express sobre PostgreSQL y
un frontend en React que la consume, con autenticación por JWT.

La base es **multitenant**: un mismo sistema usado por varias empresas, cada una
con sus propios datos. Por eso la primera tabla es `empresas`.

```
Inter-Materias/
├── api-eventos/     Express + PostgreSQL · puerto 3000
└── front-eventos/   React + Vite · puerto 5173
```

Cada carpeta tiene su propio README con el detalle.

## Levantar todo

Hacen falta dos terminales, una por proyecto.

```bash
# Terminal 1 · API
cd api-eventos
npm install
npm run dev

# Terminal 2 · Front
cd front-eventos
npm install
npm run dev
```

Antes de la primera corrida hay que crear la base y copiar los `.env` a partir
de los `.env.example`. Está explicado en `api-eventos/README.md`.

## Requisitos

- Node.js 18 o superior
- PostgreSQL
