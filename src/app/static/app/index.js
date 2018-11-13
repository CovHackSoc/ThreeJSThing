/* eslint
  no-undef: 0, no-console: 0, function-paren-newline: 0, no-param-reassign:0 */

/* Local state */
const config = {
  appRunning: false, /* Used so we can obtain a state before running */
  lastUpdate: 0, /* When we last sent our state to the server */
  updateFrequency: 100, /* Minimum number of miliseconds between updates */
  keyboard: {}, /* Describes the keyboards state */
  effects: {
    bloom: { /* Parameters for the bloom effect */
      exposure: 0.5,
      strength: 2,
      threshold: 0.5,
      radius: 0.1,
    },
  },
  colors: {
    ambient: '#1f0c1f', /* Color of the ambient light */
    point: '#7f7f1f', /* COlor of the point light */
  },
  userDisplay: {}, /* Local Display objects */
  view: { /* Offset of the camera from the users position */
    x: 0,
    y: 15,
    z: 25,
  },
  default: {
    scale: { /* Default scalling for 3D models */
      x: 0.1,
      y: 0.1,
      z: 0.1,
    },
  },
};

/* Global state, synced from the server */
let state = {};
const models = {};

let scene;
let camera;
let renderer;
let composer;
let directionalLight;
let ambientLight;

/* Keyboard event listeners */

const keyDownListener = (event) => { config.keyboard[event.which] = true; };
const keyUpListener = (event) => { config.keyboard[event.which] = false; };

const setupInput = () => {
  document.addEventListener('keydown', keyDownListener, false);
  document.addEventListener('keyup', keyUpListener, false);
};

/* Creates the Scene */
const setupScene = () => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#aaa');
  scene.fog = new THREE.Fog(scene.background, 1, 5000);
  camera = new THREE.PerspectiveCamera(
    75, window.innerWidth / window.innerHeight, 0.1, 1000);
};

/* Defines our light */
const setupLight = () => {
  /* Ambient */
  ambientLight = new THREE.AmbientLight(config.colors.ambient);
  scene.add(ambientLight);
  /* Directional */
  directionalLight = new THREE.DirectionalLight(config.colors.point);
  directionalLight.position.set(-40, 60, -10);
  directionalLight.castShadow = true;
  directionalLight.shadowCameraNear = 2;
  directionalLight.shadowCameraFar = 200;
  directionalLight.shadowCameraLeft = -50;
  directionalLight.shadowCameraRight = 50;
  directionalLight.shadowCameraTop = 50;
  directionalLight.shadowCameraBottom = -50;
  directionalLight.distance = 0;
  directionalLight.intensity = 0.5;
  directionalLight.shadowMapHeight = 1024;
  directionalLight.shadowMapWidth = 1024;
  scene.add(directionalLight);
};

/* Creates a renderer and appends it to the DOM */
const setupRenderer = () => {
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
};

/* Apply effects over the scene */
const setupEffects = () => {
  const renderScene = new THREE.RenderPass(scene, camera);
  const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
  bloomPass.renderToScreen = true;
  bloomPass.threshold = config.effects.bloom.threshold;
  bloomPass.strength = config.effects.bloom.strength;
  bloomPass.radius = config.effects.bloom.radius;
  composer = new THREE.EffectComposer(renderer);
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);
};

/* Correct the camera position */
const setCamera = () => {
  const ourUserPosition = config.userDisplay[state.userId].position;
  camera.position.x = ourUserPosition.x + config.view.x;
  camera.position.z = ourUserPosition.z + config.view.z;
  camera.position.y = config.view.y;
  camera.lookAt(ourUserPosition);
};

/* Setups the initial objects in the scene */
const setupObjects = () => {
  const geometry = new THREE.BoxGeometry(50, 1, 50);
  const material = new THREE.MeshLambertMaterial();
  material.color = new THREE.Color().setHSL(0.6, 0, 1);
  const obj = new THREE.Mesh(geometry, material);
  obj.position.y = -1;
  scene.add(obj);
};

const loadModels = (description, success, error) => {
  let textureLoader;
  let texture;
  let object;

  const loadModel = () => {
    object.traverse((child) => {
      if (child.isMesh) {
        child.material.map = texture;
      }
    });
    object.scale.set(
      description.scale.x || config.default.scale.x,
      description.scale.y || config.default.scale.y,
      description.scale.z || config.default.scale.z,
    );
  };

  const manager = new THREE.LoadingManager(loadModel);
  if (description.texture) {
    textureLoader = new THREE.TextureLoader(manager);
    texture = textureLoader.load(description.texture);
  }

  const loader = new THREE.OBJLoader(manager);
  loader.load(description.model, (obj) => {
    object = obj;
    models[description.name] = object;
    success();
  }, () => {}, error);
};

/* Create object to display this user. */
const createUserDisplay = (userId) => {
  /* const geometry = new THREE.DodecahedronGeometry(
    1,
    1,
  );
  const material = new THREE.MeshLambertMaterial();
  config.userDisplay[userId] = new THREE.Mesh(geometry, material); */

  config.userDisplay[userId] = models.dinosaur.clone();
  config.userDisplay[userId].scale.set(0.01, 0.01, 0.01);
  scene.add(config.userDisplay[userId]);
};

/* Move the local players position */
const updatePosition = (dx, dz, time) => {
  state.users[state.userId].position.x += dx;
  state.users[state.userId].position.z += dz;
  state.users[state.userId].lastModified = time;
};

/* Decide what to do on each frame */
const updateFrame = (time) => {
  /* Handle Keyboard Input */
  if (config.keyboard[37]) updatePosition(-0.1, 0, time);
  if (config.keyboard[39]) updatePosition(0.1, 0, time);
  if (config.keyboard[38]) updatePosition(0, -0.1, time);
  if (config.keyboard[40]) updatePosition(0, 0.1, time);

  /* Control how often we send updates to the server */
  if ((config.lastUpdate + config.updateFrequency) < time) {
    /* Check if changed since our last update */
    if (state.users[state.userId].lastModified <= time) {
      /* Alert the server of our current state */
      socket.emit('modify-user', state.users[state.userId]);
      config.lastUpdate = time;
    }
  }

  /* Update all the display objects position */
  const active = Object.keys(state.users);
  for (let i = 0; i < active.length; i += 1) {
    /* Check if this user already has a display object.
     * If not, create it. */
    if (!config.userDisplay[active[i]]) {
      createUserDisplay(active[i]);
    }
    const user = config.userDisplay[active[i]];
    user.position.x = state.users[active[i]].position.x;
    user.position.y = state.users[active[i]].position.y;
    user.position.z = state.users[active[i]].position.z;
  }
};

/* This is the main game loop. Ran every frame */
const animate = (time) => {
  requestAnimationFrame(animate);
  updateFrame(time);
  setCamera();
  composer.render(scene, camera);
};

/* Handles window resizes */
const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

/* Run all the required components */
const initApp = () => {
  loadModels({
    name: 'dinosaur',
    model: '/static/assets/models/trex.obj',
    texture: '/static/assets/textures/trex.jpg',
    scale: {
      x: 1,
      y: 1,
      z: 1,
    },
  }, () => {
    setupScene();
    setupLight();
    setupRenderer();
    setupEffects();
    setupInput();
    setupObjects();
    window.addEventListener('resize', onWindowResize, false);
    /* Run the app */
    animate();
  });
};

/* Modify a users state depending on what the server sent. */
const modifyUser = (data) => {
  Object.assign(state.users, data);
};

/* Refresh the state to match that of the server */
const setState = (data) => {
  state = Object.assign(state, data);
  if (!config.appRunning) {
    config.appRunning = true;
    initApp();
  }
};

/* Remove the user from our scene and state */
const disconnectedUser = (data) => {
  if (config.userDisplay[data.userId]) {
    scene.remove(config.userDisplay[data.userId]);
  }
  delete state.users[data.userId];
};

/* Add the callbacks for each of the socket events we care about */
const setupNetwork = () => {
  socket = io();
  socket.on('state', setState);
  socket.on('disconnected-user', disconnectedUser);
  socket.on('modify-user', modifyUser);
};

/* Connect to the Socket.IO server first.
 * Once we have received a state, this will call initGame */
setupNetwork();
