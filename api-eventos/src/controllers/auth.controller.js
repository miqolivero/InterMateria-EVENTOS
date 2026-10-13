import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { usuarios } from "../data/usuarios.js";

let siguienteId = 1;

// POST /api/auth/register
export const registrar = async (req, res) => {
  const { nombre, email, password } = req.body;

  // 1. Validar que lleguen los datos
  if (!nombre || !email || !password) {
    return res.status(400).json({ mensaje: "Faltan datos" });
  }

  // 2. Verificar que el email no exista
  const existe = usuarios.find((u) => u.email === email);
  if (existe) {
    return res.status(409).json({ mensaje: "El email ya esta registrado" });
  }

  // 3. Hashear la contrasena: nunca se guarda en texto plano
  const passwordHash = await bcrypt.hash(password, 10);

  // 4. Guardar el usuario
  const nuevoUsuario = {
    id: siguienteId++,
    nombre,
    email,
    password: passwordHash,
    rol: "usuario"
  };
  usuarios.push(nuevoUsuario);

  // 5. Responder SIN la contrasena
  res.status(201).json({ id: nuevoUsuario.id, nombre, email });
};

// POST /api/auth/login
export const login = async (req, res) => {
  const { email, password } = req.body;

  // 1. Buscar el usuario por email
  const usuario = usuarios.find((u) => u.email === email);
  if (!usuario) {
    // Mismo mensaje que si falla la contrasena: no revelamos que emails existen
    return res.status(401).json({ mensaje: "Credenciales invalidas" });
  }

  // 2. Comparar la contrasena con el hash guardado
  const passwordValida = await bcrypt.compare(password, usuario.password);
  if (!passwordValida) {
    return res.status(401).json({ mensaje: "Credenciales invalidas" });
  }

  // 3. Firmar el token
  const token = jwt.sign(
    { id: usuario.id, email: usuario.email, rol: usuario.rol }, // payload
    process.env.JWT_SECRET,                                     // clave
    { expiresIn: process.env.JWT_EXPIRES_IN }                   // opciones
  );

  // 4. Devolver el token y los datos publicos
  res.json({
    token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol
    }
  });
};

// GET /api/auth/perfil  (protegida)
// El id sale del token, no de la URL: nadie puede pedir el perfil de otro.
export const perfil = (req, res) => {
  const usuario = usuarios.find((u) => u.id === req.usuario.id);

  if (!usuario) {
    return res.status(404).json({ mensaje: "Usuario no encontrado" });
  }

  res.json({
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol
  });
};
