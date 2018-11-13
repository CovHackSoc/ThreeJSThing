const generatePosition = () => {
  const x = (Math.random() * 50) - 25;
  const y = 0; // (Math.random() * 50) - 25;
  const z = (Math.random() * 50) - 25;
  return { x, y, z };
};

module.exports = {
  generatePosition,
};
