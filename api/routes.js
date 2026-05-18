const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();
const users = require("./users");

const SECRET = process.env.JWT_SECRET || "segredo_super";

const conversas = [];
const mensagens = [];

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
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
      message: "Token inválido"
    });
  }
}

router.post("/register", async (req, res) => {
  try {
    let { nome, email, password } = req.body;

    nome = nome?.trim();
    email = email?.trim().toLowerCase();

    if (!nome || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Preencha todos os campos"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Senha deve ter no mínimo 6 caracteres"
      });
    }

    const userExists = users.find(u => u.email === email);

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "Email já cadastrado"
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = {
      id: users.length + 1,
      nome,
      email,
      password: hash,
      foto: `https://i.pravatar.cc/150?img=${users.length + 10}`
    };

    users.push(user);

    return res.status(201).json({
      success: true,
      message: "Usuário criado com sucesso",
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        foto: user.foto
      }
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Erro interno no servidor"
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    email = email?.trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Preencha todos os campos"
      });
    }

    const user = users.find(u => u.email === email);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Usuário não encontrado"
      });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "Senha inválida"
      });
    }

    const token = jwt.sign(
      { id: user.id },
      SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      message: "Login realizado com sucesso",
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        foto: user.foto
      }
    });

  } catch {
    return res.status(500).json({
      success: false,
      message: "Erro interno no servidor"
    });
  }
});

router.get("/profile", authMiddleware, (req, res) => {
  const user = users.find(u => Number(u.id) === Number(req.userId));

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Usuário não encontrado"
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      foto: user.foto
    }
  });
});

router.get("/users", (req, res) => {
  const lista = users.map(user => ({
    id: user.id,
    nome: user.nome,
    email: user.email,
    foto: user.foto || `https://i.pravatar.cc/150?img=${user.id}`
  }));

  return res.status(200).json({
    success: true,
    status: 200,
    data: lista
  });
});

router.get("/usuarios", (req, res) => {
  const lista = users.map(user => ({
    id: user.id,
    nome: user.nome,
    email: user.email,
    foto: user.foto || `https://i.pravatar.cc/150?img=${user.id}`
  }));

  return res.status(200).json(lista);
});

router.post("/chat/conversas", authMiddleware, (req, res) => {
  const meuId = Number(req.userId);
  const outroId = Number(req.body.usuarioId);

  if (!outroId) {
    return res.status(400).json({
      success: false,
      message: "usuarioId é obrigatório"
    });
  }

  if (meuId === outroId) {
    return res.status(400).json({
      success: false,
      message: "Você não pode conversar com você mesmo"
    });
  }

  const outroUsuario = users.find(u => Number(u.id) === outroId);

  if (!outroUsuario) {
    return res.status(404).json({
      success: false,
      message: "Usuário não encontrado"
    });
  }

  let conversa = conversas.find(c =>
    c.participantes.includes(meuId) &&
    c.participantes.includes(outroId)
  );

  if (!conversa) {
    conversa = {
      id: conversas.length + 1,
      participantes: [meuId, outroId],
      criadaEm: new Date()
    };

    conversas.push(conversa);
  }

  return res.status(200).json({
    success: true,
    conversa
  });
});

router.get("/chat/conversas", authMiddleware, (req, res) => {
  const meuId = Number(req.userId);

  const minhasConversas = conversas
    .filter(c => c.participantes.includes(meuId))
    .map(c => {
      const outroId = c.participantes.find(id => id !== meuId);
      const usuario = users.find(u => Number(u.id) === Number(outroId));

      const msgs = mensagens.filter(m => Number(m.conversaId) === Number(c.id));
      const ultima = msgs[msgs.length - 1];

      return {
        id: c.id,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          foto: usuario.foto || `https://i.pravatar.cc/100?img=${usuario.id}`
        },
        ultimaMensagem: ultima ? ultima.texto : "Nova conversa",
        horario: ultima ? ultima.hora : ""
      };
    });

  return res.status(200).json(minhasConversas);
});

router.get("/chat/mensagens/:conversaId", authMiddleware, (req, res) => {
  const meuId = Number(req.userId);
  const conversaId = Number(req.params.conversaId);

  const conversa = conversas.find(c => Number(c.id) === conversaId);

  if (!conversa) {
    return res.status(200).json([]);
  }

  if (!conversa.participantes.includes(meuId)) {
    return res.status(403).json({
      success: false,
      message: "Você não participa dessa conversa"
    });
  }

  const lista = mensagens.filter(m => Number(m.conversaId) === conversaId);

  return res.status(200).json(lista);
});

router.post("/chat/mensagens", authMiddleware, (req, res) => {
  const io = req.app.get("io");

  const meuId = Number(req.userId);
  const conversaId = Number(req.body.conversaId);
  const texto = req.body.texto?.trim();

  if (!conversaId || !texto) {
    return res.status(400).json({
      success: false,
      message: "conversaId e texto são obrigatórios"
    });
  }

  const conversa = conversas.find(c => Number(c.id) === conversaId);

  if (!conversa) {
    return res.status(404).json({
      success: false,
      message: "Conversa não encontrada"
    });
  }

  if (!conversa.participantes.includes(meuId)) {
    return res.status(403).json({
      success: false,
      message: "Você não participa dessa conversa"
    });
  }

  const mensagem = {
    id: mensagens.length + 1,
    conversaId,
    autorId: meuId,
    texto,
    hora: new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    }),
    criadaEm: new Date()
  };

  mensagens.push(mensagem);

  if (io) {
    io.to(String(conversaId)).emit("nova_mensagem", mensagem);
  }

  return res.status(201).json(mensagem);
});

module.exports = router;