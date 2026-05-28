const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');

const { initDB } = require('./db');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const { setupSocketHandlers } = require('./socket/handlers');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// Serve built React client
const distPath = path.join(__dirname, '../client/dist');
app.use(express.static(distPath));
app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')));

setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;

initDB()
  .then(() => {
    server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
