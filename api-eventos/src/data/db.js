import pg from "pg";

// Como pg devuelve los tipos de PostgreSQL, y por que lo cambiamos.
// Lo pide docs/API.md: el front espera las fechas como "YYYY-MM-DD" y los
// montos como numero.
//
// 1082 = DATE. Por defecto pg lo convierte a un objeto Date de JavaScript, que
// al pasar a JSON se interpreta en UTC: una fecha guardada como 2026-11-14
// puede llegar al front como "2026-11-13T03:00:00.000Z" y mostrarse un dia
// antes. Devolviendola tal cual la da la base, el problema desaparece.
pg.types.setTypeParser(1082, (valor) => valor);

// 1700 = NUMERIC/DECIMAL. pg lo devuelve como string para no perder precision.
// El contrato dice que los montos van como numero, asi que lo convertimos.
// Los importes de este sistema estan muy lejos del limite de precision de un
// number de JavaScript, asi que es seguro.
pg.types.setTypeParser(1700, parseFloat);

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

export default pool;
