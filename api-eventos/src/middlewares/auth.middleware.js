import jwt from "jsonwebtoken";

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

// verificarToken dice QUIEN sos. verificarRol decide si PODES hacer la accion.
// Siempre va despues de verificarToken, porque usa req.usuario.
export const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res
        .status(403)
        .json({ mensaje: "No tenes permiso para esta accion" });
    }
    next();
  };
};
