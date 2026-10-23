import jwt from "jsonwebtoken";
import pool from "../data/db.js";

// Cadena de seguridad de la Fase 10. Cada pedido protegido pasa por:
//
//   verificarToken  ->  QUIEN sos (el token es valido y no vencio)
//   soloEmpresa / soloSuperadmin  ->  A QUE LADO del sistema podes entrar,
//                     con los datos frescos de la base
//   permitirRoles   ->  QUE podes hacer dentro de ese lado
//
// Se montan a nivel router en index.js, asi ninguna ruta nueva queda sin
// proteccion por olvido. Las restricciones por REGISTRO del rol empleado (solo
// sus tareas) no van aca: van en el WHERE de cada controller.

export const MENSAJES_ACCESO = {
  sinPermiso: "No tenes permiso para esta accion",
  soloEmpresa: "Esta seccion es solo para usuarios de una empresa",
  suspendida: "La empresa esta suspendida. Contacta al administrador del sistema"
};

// El 403 de empresa suspendida lleva un codigo ademas del mensaje: es el unico
// 403 que obliga al front a cerrar la sesion, y el front decide por codigos,
// nunca comparando el texto.
export const responderSuspendida = (res) =>
  res.status(403).json({
    mensaje: MENSAJES_ACCESO.suspendida,
    codigo: "empresa_suspendida"
  });

// El portero de las rutas protegidas: se ejecuta antes del controlador.
export const verificarToken = (req, res, next) => {
  // 1. Leer el header: "Bearer eyJhbGci..."
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ mensaje: "Token no proporcionado" });
  }

  // 2. Quedarse solo con el token
  const token = authHeader.split(" ")[1];

  try {
    // 3. Verificar firma y vencimiento
    const datos = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Guardar el payload para los siguientes pasos
    req.usuario = datos;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ mensaje: "El token expiro" });
    }
    return res.status(401).json({ mensaje: "Token invalido" });
  }
};

// Lee el usuario del token desde la base, con el estado de su empresa.
//
// Por que no alcanza con el token: el token se firmo al loguearse y dura
// horas. Si en ese tiempo el admin le cambia el rol a alguien, lo desactiva o
// el superadmin suspende la empresa, el token sigue diciendo lo de antes.
// Leyendo la base en cada pedido, el cambio corre desde el pedido siguiente.
export const cargarUsuario = async (idUsuario) => {
  const resultado = await pool.query(
    `SELECT u.id_usuario, u.email, u.rol, u.id_empresa, u.id_empleado, u.activo,
            e.activo AS empresa_activa
     FROM usuarios u
     LEFT JOIN empresas e ON e.id_empresa = u.id_empresa
     WHERE u.id_usuario = $1`,
    [idUsuario]
  );

  return resultado.rows[0] ?? null;
};

// Arma un middleware que carga el usuario y decide con una funcion propia.
// Los errores de la base terminan en el 500 generico, como en los controllers.
const conUsuario = (decidir) => async (req, res, next) => {
  try {
    const usuario = await cargarUsuario(req.usuario.id);

    // Usuario borrado o desactivado: su token ya no sirve. 401 para que el
    // front cierre la sesion, igual que con un token vencido.
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ mensaje: "Token invalido" });
    }

    decidir(usuario, req, res, next);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

// Va en TODAS las rutas de empresa (clientes, eventos, tareas...).
//
// 1. El superadmin no entra: no tiene id_empresa y no ve datos operativos.
// 2. Si la empresa esta suspendida, ningun usuario suyo entra, aunque tenga un
//    token valido de antes de la suspension.
// 3. req.usuario se reemplaza con los datos de la base: rol, id_empresa e
//    id_empleado frescos. Los controllers filtran con esto.
export const soloEmpresa = conUsuario((usuario, req, res, next) => {
  if (usuario.rol === "superadmin") {
    return res.status(403).json({ mensaje: MENSAJES_ACCESO.soloEmpresa });
  }

  if (!usuario.empresa_activa) {
    return responderSuspendida(res);
  }

  req.usuario = {
    id: usuario.id_usuario,
    email: usuario.email,
    rol: usuario.rol,
    id_empresa: usuario.id_empresa,
    id_empleado: usuario.id_empleado
  };
  next();
});

// Va en las rutas /superadmin/*. Cualquier otro rol recibe el 403 de siempre.
export const soloSuperadmin = conUsuario((usuario, req, res, next) => {
  if (usuario.rol !== "superadmin") {
    return res.status(403).json({ mensaje: MENSAJES_ACCESO.sinPermiso });
  }

  req.usuario = { id: usuario.id_usuario, email: usuario.email, rol: usuario.rol };
  next();
});

// Aplica la tabla "Permisos por ruta" de docs/API.md. Va DESPUES de
// soloEmpresa, que es quien deja en req.usuario.rol el rol actual de la base.
export const permitirRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: MENSAJES_ACCESO.sinPermiso });
    }
    next();
  };
};
