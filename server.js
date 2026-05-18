const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const routes = require("./api/routes");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.set("io", io);

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API Rede Social funcionando 🚀");
});

app.get("/status", (req, res) => {
  res.json({
    status: "online",
    mensagem: "API rodando normalmente 🚀"
  });
});

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API Rede Social",
      version: "1.0.0",
      description: "API de login, cadastro e chat",
    },
    servers: [
      { url: "https://ultrabuscax-1.onrender.com" },
      { url: "http://localhost:3000" }
    ],
  },
  apis: [path.join(__dirname, "api", "*.js")],
};

const swaggerSpec = swaggerJsdoc(options);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api", routes);

io.on("connection", (socket) => {
  console.log("Usuário conectado:", socket.id);

  socket.on("entrar_conversa", (conversationId) => {
    socket.join(String(conversationId));
  });

  socket.on("disconnect", () => {
    console.log("Usuário saiu:", socket.id);
  });
});

app.use((req, res) => {
  res.status(404).json({ erro: "Rota não encontrada" });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});