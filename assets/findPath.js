const { dontCollide, tsize } = require("./stats");

const findPath = (e, dx, dy, map) => {
	let c, r, s = e.scene;
	c = Math.floor(e.dx / tsize);
	r = Math.floor((e.dy - tsize) / tsize);
	if (
		Math.abs(dy - e.dy) >= Math.abs(dx - e.dx) &&
		dy - e.dy < 0 &&
		e.x == e.dx &&
		e.y == e.dy &&
		walls(s, map)[getIndex(s, c, r, map)] == 0
	) { e.dy -= tsize; e.dir = 1 }
	c = Math.floor(e.dx / tsize);
	r = Math.floor((e.dy + tsize) / tsize);
	if (
		Math.abs(dy - e.dy) >= Math.abs(dx - e.dx) &&
		dy - e.dy > 0 &&
		e.x == e.dx &&
		e.y == e.dy &&
		walls(s, map)[getIndex(s, c, r, map)] == 0
	) { e.dy += tsize; e.dir = 0 }
	c = Math.floor((e.dx - tsize) / tsize);
	r = Math.floor(e.dy / tsize);
	if (
		Math.abs(dx - e.dx) >= Math.abs(dy - e.dy) &&
		dx - e.dx < 0 &&
		e.x == e.dx &&
		e.y == e.dy &&
		walls(s, map)[getIndex(s, c, r, map)] == 0
	) { e.dx -= tsize; e.dir = 2 }
	c = Math.floor((e.dx + tsize) / tsize);
	r = Math.floor(e.dy / tsize);
	if (
		Math.abs(dx - e.dx) >= Math.abs(dy - e.dy) &&
		dx - e.dx > 0 &&
		e.x == e.dx &&
		e.y == e.dy &&
		walls(s, map)[getIndex(s, c, r, map)] == 0
	) { e.dx += tsize; e.dir = 3 }
	if (e.dx < 0) e.dx = 0;
	if (e.dy < 0) e.dy = 0;
	if (e.dx > (map[s].cols - 1) * tsize) e.dx = (map[s].cols - 1) * tsize;
	if (e.dy > (map[s].rows - 1) * tsize) e.dy = (map[s].rows - 1) * tsize;
	c = Math.floor(e.dx / tsize);
	r = Math.floor(e.dy / tsize);
	if (walls(s, map)[getIndex(s, c, r, map)] == 1) { e.dx = e.x; e.dy = e.y }
};

const getTile = (s, l, c, r, map) => {
	if (map[s].layers[l]) return map[s].layers[l][getIndex(s, c, r, map)];
	return map[s][l][getIndex(s, c, r, map)] || -1;
};

const getAllTiles = (s, c, r, map) => {
	const tiles = [];
	Object.keys(map[s].layers).forEach(l => tiles.push(map[s].layers[l].indexOf(getIndex(s, c, r, map))));
	return tiles;
};

const getIndex = (s, c, r, map) => {
	return r * map[s].cols + c;
};

const walls = (s, map) => {
	const w = [];
	for (let i = 0; i < map[s].cols * map[s].rows; i++) {
		w[i] = 0;
		if (map[s].structure[i] && !dontCollide.includes(map[s].structure[i])) w[i] = 1;
		if (!dontCollide.includes(map[s].layers.scenery[i])) w[i] = 1;
		if (map[s].layers.ground[i] == 40) w[i] = 1;
	}
	return w;
};

module.exports = {
	findPath,
	getTile,
	getAllTiles,
	getIndex,
	walls,
};