// Limpia y valida los datos que entran, ANTES de llegar al controlador. Una sola
// regla por tipo de dato, asi un email se valida igual en todas las pantallas.
//
// - Los textos se recortan: "  Catering " es "Catering". Un texto opcional
//   vacio se guarda como null, y un obligatorio vacio cae en el chequeo del
//   controlador ("solo espacios" cuenta como vacio).
// - Un documento se guarda siempre igual, asi "38.123.456" y "38123456" son el
//   mismo dato para los indices unicos de la base.
// - Solo se miran los campos que vinieron: los PATCH y PUT parciales siguen
//   funcionando. Los campos que no estan en las reglas no se tocan.

const MAX_ASISTENTES = 10000;
const MESES_MAXIMOS = 60;

const FORMATO_INVALIDO = "Hay datos con un formato invalido";

const soloDigitos = (valor) => valor.replace(/\D/g, "");
const conGuiones = (d) => `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;

// Cada regla devuelve { valor } con el dato limpio, o { error } con el mensaje
const texto = (valor) => {
  if (typeof valor !== "string") return { error: FORMATO_INVALIDO };
  return { valor: valor.trim() || null };
};

const conFormato = (limpiar) => (valor) => {
  const base = texto(typeof valor === "number" ? String(valor) : valor);
  if (base.error || base.valor === null) return base;
  return limpiar(base.valor);
};

const email = conFormato((valor) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)
    ? { valor: valor.toLowerCase() }
    : { error: "El email no es valido" });

const telefono = conFormato((valor) =>
  /^\+?[\d\s()./-]+$/.test(valor) && soloDigitos(valor).length >= 6
    ? { valor }
    : { error: "El telefono no es valido" });

const cuit = conFormato((valor) => {
  const digitos = soloDigitos(valor);
  return /^[\d\s.-]+$/.test(valor) && digitos.length === 11
    ? { valor: conGuiones(digitos) }
    : { error: "El CUIT tiene que tener 11 digitos" };
});

// DNI (7 u 8 digitos) o CUIT (11)
const documento = conFormato((valor) => {
  const digitos = soloDigitos(valor);
  if (!/^[\d\s.-]+$/.test(valor)) return { error: "El DNI/CUIT tiene que tener 7, 8 u 11 digitos" };
  if (digitos.length === 7 || digitos.length === 8) return { valor: digitos };
  if (digitos.length === 11) return { valor: conGuiones(digitos) };
  return { error: "El DNI/CUIT tiene que tener 7, 8 u 11 digitos" };
});

// Una fecha mal escrita la sigue rechazando el controlador, con su mensaje.
// Aca solo se frena lo absurdo: un evento en el año 9999 es un error de tipeo.
const fechaRazonable = (valor) => {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return { valor };
  const limite = new Date();
  limite.setMonth(limite.getMonth() + MESES_MAXIMOS);
  return valor > limite.toISOString().slice(0, 10)
    ? { error: `La fecha no puede ser mas de ${MESES_MAXIMOS} meses despues de hoy` }
    : { valor };
};

const asistentes = (valor) =>
  Number(valor) > MAX_ASISTENTES
    ? { error: `La cantidad de asistentes no puede superar ${MAX_ASISTENTES}` }
    : { valor };

// Aplica las reglas sobre req.body, o sobre req.body[grupo] si el dato viene
// anidado (el admin del alta de una empresa, el acceso de un empleado)
export const validarDatos = (reglas, grupo = null) => (req, res, next) => {
  const datos = grupo ? req.body?.[grupo] : req.body;
  if (!datos || typeof datos !== "object") return next();

  for (const [campo, regla] of Object.entries(reglas)) {
    if (!Object.hasOwn(datos, campo) || datos[campo] === null || datos[campo] === undefined) continue;
    const resultado = regla(datos[campo]);
    if (resultado.error) return res.status(400).json({ mensaje: resultado.error });
    datos[campo] = resultado.valor;
  }
  next();
};

export const datosCliente = validarDatos({ nombre: texto, apellido: texto, dni_cuit: documento,
  email, telefono, direccion: texto });
export const datosCatalogo = validarDatos({ nombre: texto, descripcion: texto });
export const datosSede = validarDatos({ nombre: texto, direccion: texto });
export const datosProveedor = validarDatos({ razon_social: texto, cuit, email, telefono,
  direccion: texto, observaciones: texto });
export const datosEmpleado = validarDatos({ legajo: texto, nombre: texto, apellido: texto,
  rol: texto, email, telefono, cargo: texto });
export const datosUsuario = validarDatos({ nombre: texto, email });
export const datosAcceso = validarDatos({ email }, "acceso");
export const datosAdminNuevo = validarDatos({ nombre: texto, email }, "admin");
export const datosEmpresaNueva = validarDatos({ nombre: texto, cuit, email, telefono, direccion: texto }, "empresa");
export const datosEmpresa = validarDatos({ nombre: texto, cuit, email, telefono, direccion: texto });
export const datosSolicitud = validarDatos({ fecha_evento_prevista: fechaRazonable,
  cantidad_asistentes: asistentes, preferencias: texto });
export const datosEvento = validarDatos({ fecha_evento_confirmada: fechaRazonable,
  cantidad_asistentes: asistentes, condiciones_acordadas: texto });
export const datosTarea = validarDatos({ descripcion: texto, fecha_prevista: fechaRazonable, observaciones: texto });
export const datosRenglon = validarDatos({ descripcion: texto });
export const datosRevision = validarDatos({ fecha_prevista: fechaRazonable });
