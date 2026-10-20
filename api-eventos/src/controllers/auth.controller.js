import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../data/db.js";

// Los usuarios ya no viven en memoria: estan en la tabla usuarios. El cambio
// era necesario porque el sistema es multitenant y cada usuario tiene que
// pertenecer a una empresa; ese id_empresa es el que despues filtra TODOS los
// datos del sistema.

// POST /api/auth/register
export const registrar = async (req, res) => {
  const { nombre, email, password, id_empresa } = req.body;

  // 1. Validar que lleguen los datos
  if (!nombre || !email || !password || !id_empresa) {
    return res
      .status(400)
      .json({ mensaje: "Faltan datos: nombre, email, password e id_empresa" });
  }

  try {
    // 2. La empresa tiene que existir y estar activa. Si no, el usuario
    //    quedaria atado a una empresa que no puede usar el sistema.
    const empresa = await pool.query(
      "SELECT id_empresa FROM empresas WHERE id_empresa = $1 AND activo = TRUE",
      [id_empresa]
    );

    if (empresa.rows.length === 0) {
      return res
        .status(400)
        .json({ mensaje: "La empresa no existe o esta inactiva" });
    }

    // 3. Hashear la contrasena: nunca se guarda en texto plano
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Guardar el usuario. El rol siempre es 'usuario': a admin lo asciende
    //    otro admin, no se elige en el registro.
    const resultado = await pool.query(
      `INSERT INTO usuarios (nombre, email, password, rol, id_empresa)
       VALUES ($1, $2, $3, 'usuario', $4)
       RETURNING id_usuario, nombre, email, rol, id_empresa`,
      [nombre, email, passwordHash, id_empresa]
    );

    // 5. Responder SIN la contrasena
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    // 23505 = violacion de UNIQUE (el email ya esta registrado)
    if (error.code === "23505") {
      return res.status(400).json({ mensaje: "El email ya esta registrado" });
    }
    res.status(500).json({ mensaje: "Error al registrar el usuario" });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ mensaje: "Faltan el email y la contrasena" });
  }

  try {
    // 1. Buscar el usuario por email, con el nombre de la empresa para mostrarlo
    const resultado = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.email, u.password, u.rol,
              u.id_empresa, u.id_empleado, u.activo,
              e.nombre AS nombre_empresa
       FROM usuarios u
       JOIN empresas e ON e.id_empresa = u.id_empresa
       WHERE u.email = $1`,
      [email]
    );

    const usuario = resultado.rows[0];

    // Mismo mensaje que si falla la contrasena: no revelamos que emails existen
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ mensaje: "Credenciales invalidas" });
    }

    // 2. Comparar la contrasena con el hash guardado
    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) {
      return res.status(401).json({ mensaje: "Credenciales invalidas" });
    }

    // 3. Firmar el token. id_empresa va en el payload porque de ahi lo toman
    //    todos los controladores para filtrar: nunca del body ni de la URL.
    const token = jwt.sign(
      {
        id: usuario.id_usuario,
        email: usuario.email,
        rol: usuario.rol,
        id_empresa: usuario.id_empresa
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // 4. Devolver el token y los datos publicos
    res.json({
      token,
      usuario: {
        id: usuario.id_usuario,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        id_empresa: usuario.id_empresa,
        nombre_empresa: usuario.nombre_empresa,
        id_empleado: usuario.id_empleado
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al iniciar sesion" });
  }
};

// GET /api/auth/perfil  (protegida)
// El id sale del token, no de la URL: nadie puede pedir el perfil de otro.
export const perfil = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.email, u.rol,
              u.id_empresa, u.id_empleado,
              e.nombre AS nombre_empresa
       FROM usuarios u
       JOIN empresas e ON e.id_empresa = u.id_empresa
       WHERE u.id_usuario = $1 AND u.activo = TRUE`,
      [req.usuario.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener el perfil" });
  }
};
