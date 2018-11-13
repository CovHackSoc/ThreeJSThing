/* eslint no-console: 0 */
const express = require('express');
const uuid = require('uuid/v4');

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const utils = require('./utils');

/* Global game state */
const state = require('./state');
/* Configuration */
const config = require('./config');

// io.pingTimeout = 50;

/* Serve our static files */
app.use('/static', express.static('app/static'));

app.get('/', (req, res) => {
  res.sendFile(`${__dirname}/static/index.html`);
});

/* Expose our websocket state syncing */
io.on('connection', (socket) => {
  /* Give a unique ID to this user */
  const userId = uuid();
  console.log(`${userId} : connected`);

  /* Share the current state with the new user */
  const userSpecificState = JSON.parse(JSON.stringify(state));
  userSpecificState.userId = userId;
  userSpecificState.users[userId] = {
    lastModified: 0,
    position: utils.generatePosition(),
  };
  socket.emit('state', userSpecificState);
  const forAll = { [userId]: userSpecificState.users[userId] };
  socket.broadcast.emit('modify-user', forAll);

  /* Alert the other users that this user has disconnected */
  socket.on('disconnect', () => {
    console.log(`${userId} : disconnected`);
    delete state.users[userId];
    io.emit('disconnected-user', { userId });
  });

  /* Only allow the user to modify their own state */
  socket.on('modify-user', (event) => {
    state.users[userId] = event;
    socket.broadcast.emit('modify-user', { [userId]: event });
  });
});

/* Expose our service */
http.listen(config.port, config.host, () => {
  console.log(`Listenning on ${config.host}:${config.port}`);
});
