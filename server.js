const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Permite conexões de qualquer origem
  },
});

app.use(cors());
app.use(express.json());

app.post('/data', (req, res) => {
  const data = req.body;
  io.emit('new-data', data); // Emite o evento 'new-data' com os dados recebidos
  res.status(200).send('Data received and broadcasted');
});

io.on('connection', (socket) => {
  console.log('A user connected');
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});