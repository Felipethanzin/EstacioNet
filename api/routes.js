const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();
const users = require("./users");

const SECRET = process.env.JWT_SECRET || "segredo_super";

/**
 * 🔐 Middleware de autenticação
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      status: 401,
      message: "Token não fornecido"
    });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : authHeader;

  try {
    const decoded = jwt.verify(token.trim(), SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      status: 401,
      message: "Token inválido"
    });
  }
}

/**
 * @swagger
 * /api/register:
 *   post:
 *     summary: Criar usuário
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuário criado
 */
router.post("/register", async (req, res) => {
  try {
    let { nome, email, password } = req.body;

    nome = nome?.trim();
    email = email?.trim().toLowerCase();

    if (!nome || !email || !password) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Preencha todos os campos"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Senha deve ter no mínimo 6 caracteres"
      });
    }

    const userExists = users.find(u => u.email === email);
    if (userExists) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Email já cadastrado"
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = {
      id: users.length + 1,
      nome,
      email,
      password: hash,
    };

    users.push(user);

    return res.status(201).json({
      success: true,
      status: 201,
      message: "Usuário criado com sucesso"
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Erro interno no servidor"
    });
  }
});

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Login do usuário
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login realizado
 */
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    email = email?.trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Preencha todos os campos"
      });
    }

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Usuário não encontrado"
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Senha inválida"
      });
    }

    const token = jwt.sign(
      { id: user.id },
      SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Login realizado com sucesso",
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email
      }
    });

  } catch {
    return res.status(500).json({
      success: false,
      status: 500,
      message: "Erro interno no servidor"
    });
  }
});

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Perfil do usuário
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário
 */
router.get("/profile", authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      status: 404,
      message: "Usuário não encontrado"
    });
  }

  return res.status(200).json({
    success: true,
    status: 200,
    data: {
      id: user.id,
      nome: user.nome,
      email: user.email
    }
  });
});

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Listar usuários
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Lista de usuários
 */
router.get("/users", (req, res) => {
  const lista = users.map(user => ({
    id: user.id,
    nome: user.nome,
    email: user.email
  }));

  return res.status(200).json({
    success: true,
    status: 200,
    data: lista
  });
});

module.exports = router;
