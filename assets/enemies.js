const colliding = require("./colliding");
const { itemStats } = require("./stats");
const tsize = 80;
const dontCollide = [-1, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 54, 55, 56, 178, 179, 180, 78, 79, 80, 81, 82, 83, 102, 103, 104, 105, 106, 107, 136, 137, 138, 139, 140, 141, 172, 173, 174, 175, 176, 177, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 205, 209, 213];

const enemies = {
	update(e, map, players, entities) {
		if (!e) return enemies.indexOf(e);
		if (!e.follow) e.follow = enemies.findNearestPlayer(e, 8 * tsize, players);
		else e.follow = enemies.inRange(e, e.follow, 8 * tsize, players);
		if (e.x == e.dx && e.y == e.dy && (Math.floor(Math.random() * (50 - 1) + 1) == 1 || e.follow)) {
			let moveX = e.dx, moveY = e.dy;
			const random = Math.round(Math.random()) == 0 ? tsize : -tsize;
			
			if (Math.round(Math.random()) == 0) moveX += random;
			else moveY += random;
			if (moveX < 0) moveX += -random * 2;
			if (moveY < 0) moveY += -random * 2;
			if (moveX >= map[e.scene].cols) moveX -= -random * 2;
			if (moveY >= map[e.scene].rows) moveY -= -random * 2;
			const { dx, dy } = players[e.follow] ? players[e.follow] : { dx: moveX, dy: moveY };
			findPath(e, dx, dy, map);
		}
		e.x += 2 * Math.sign(e.dx - e.x);
		e.y += 2 * Math.sign(e.dy - e.y);
		Object.values(players).filter(v => v.scene == e.scene).forEach(v => {
			const openSpots = [];
			openSpots.push({ x: Math.floor(e.dx / tsize) + 1, y: Math.floor(e.dy / tsize), dir: 2 });
			openSpots.push({ x: Math.floor(e.dx / tsize) - 1, y: Math.floor(e.dy / tsize), dir: 3 });
			openSpots.push({ x: Math.floor(e.dx / tsize), y: Math.floor(e.dy / tsize) + 1, dir: 1 });
			openSpots.push({ x: Math.floor(e.dx / tsize), y: Math.floor(e.dy / tsize) - 1, dir: 0 });
			openSpots.push({ x: Math.floor(e.dx / tsize), y: Math.floor(e.dy / tsize), dir: v.dir });
			openSpots.every(c => {
				if (
					colliding({
						x: v.x,
						y: v.y,
						w: tsize,
						h: tsize,
					}, {
						x: e.x,
						y: e.y,
						w: tsize,
						h: tsize,
					}) &&
					v.rotate != 0 && (
						itemStats[v.i[v.holding]].type == "sword" ||
						itemStats[v.i[v.holding]].type == "axe"
					) &&
					!v.editor &&
					v.dir == c.dir &&
					e.cooldown == 0
				) {
					const h = !e.helmet ? 1 : itemStats[v.i[v.holding]].power >= 2 ? 2 : 1;
					e.health -= Math.floor(itemStats[v.i[v.holding]].power / h);
					e.cooldown = 4;
					const dx = e.dx, dy = e.dy;
					if (c.dir == 0) e.dy = e.y = (c.y + 2) * tsize;
					else if (c.dir == 1) e.dy = e.y = (c.y - 2) * tsize;
					else if (c.dir == 2) e.dx = e.x = (c.x - 2) * tsize;
					else if (c.dir == 3) e.dx = e.x = (c.x + 2) * tsize;
					else if (v.dir == 0) e.dy = e.y = (Math.floor(v.dy / tsize) - 1) * tsize;
					else if (v.dir == 1) e.dy = e.y = (Math.floor(v.dy / tsize) + 1) * tsize;
					else if (v.dir == 2) e.dx = e.x = (Math.floor(v.dx / tsize) + 1) * tsize;
					else if (v.dir == 3) e.dx = e.x = (Math.floor(v.dx / tsize) - 1) * tsize;
					if (
						enemies.walls(e.scene, map)[getIndex(e.scene, Math.floor(e.dx / tsize), Math.floor(e.dy / tsize), map)] == 1 ||
						e.dx < 0 ||
						e.dy < 0 ||
						e.dx > map[e.scene].cols - 1 ||
						e.dy > map[e.scene].rows - 1
					) {
						e.dx = e.x = dx;
						e.dy = e.y = dy;
					}
					e.dx = Math.floor(e.dx / tsize) * tsize;
					e.dy = Math.floor(e.dy / tsize) * tsize;
					return true;
				} else return false;
			});
		});
		let kill = false;
		Object.values(entities).filter(t => !t.enemy && !t.animal).every(t => {
			if (!t || t.id != 2) return false;
			if (colliding({
				x: t.x,
				y: t.y,
				w: 0,
				h: 0,
			}, {
				x: e.x,
				y: e.y,
				w: tsize,
				h: tsize,
			})) {
				const h = !e.helmet ? 1 : 2;
        e.health -= Math.floor(t.speed / h);
				kill = entities.indexOf(t);
				return true;
			}
		});
		if (typeof kill == "number") return kill;
		if (e.health <= 0) {
			e.health = 0;
			return entities.indexOf(e);
		}
		if (!e.follow) return false;
		const p = players[e.follow];
		if (colliding({
			x: p.x,
			y: p.y,
			w: tsize,
			h: tsize,
		}, {
			x: e.x,
			y: e.y,
			w: tsize,
			h: tsize,
		})) e.zKey = true;
		else e.zKey = false;
		if (e.zKey) e.rotate++;
		else e.rotate = 0;
		return false;
	},
	frames(e, map) {
		if (!e) return;
		e.cooldown--;
		if (e.cooldown < 0) e.cooldown = 0;
		if (e.x != e.dx || e.y != e.dy) e.frame++;
		else e.frame = 0;
		if (e.frame > 3) e.frame = 0;
		let c, r;
		c = Math.floor(e.dx / tsize);
		r = Math.floor(e.dy / tsize);
		if (enemies.walls(e.scene, map)[getIndex(e.scene, c, r, map)] == 1) {
			e.health -= 0.5;
			if (
				enemies.walls(e.scene, map)[getIndex(e.scene, c + 1, r, map)] == 1 &&
				enemies.walls(e.scene, map)[getIndex(e.scene, c - 1, r, map)] == 1 &&
				enemies.walls(e.scene, map)[getIndex(e.scene, c, r + 1, map)] == 1 &&
				enemies.walls(e.scene, map)[getIndex(e.scene, c, r - 1, map)] == 1
			) e.health -= 0.5;
		}
	},
	spawn(e = {}, map, entities) {
		if (typeof e != "object" || !map || !entities) return;
		if (typeof e.scene != "number") e.scene = players[myId].scene;
		const openSpot = enemies.getOpenSpot(e.scene, map);
		if (typeof e.x != "number" || typeof e.y != "number" || e.x < 0 || e.y < 0) { e.x = openSpot.x; e.y = openSpot.y }
		if (!e.type) e.type = "dark knight";
		if (e.type == "dark knight") e.helmet = Math.floor(Math.random() * (3 - 1) + 1) == 1;
		e.dx = e.x;
		e.dy = e.y;
		e.frame = 0;
		e.dir = 0;
		e.enemy = true;
		e.follow = null;
		e.zKey = false;
		e.health = 100;
		e.rotate = 0;
		e.i = [74];
		e.holding = 0;
		e.cooldown = 0;
		entities.push(e);
	},
	despawn(map, entities) {
		map.forEach((m, i) => entities[i] = entities[i]?.map(e => !e.enemy));
	},
	getOpenSpot(s, map) {
		let openSpot = Math.floor(Math.random() * enemies.walls(s, map).length);
		while (enemies.walls(s, map)[openSpot] != 0) openSpot = Math.floor(Math.random() * enemies.walls(s, map).length);
		const x = openSpot % map[s].cols;
		const y = (openSpot - x) / map[s].cols;
		return { x: x * tsize, y: y * tsize };
	},
	inRange(e, id, rad, players) {
		const p = players[id];

		if (!p) return null;

		const dx = p.dx - e.dx;
		const dy = p.dy - e.dy;

		if (dx * dx + dy * dy < rad * rad && p.scene == e.scene && !p.editor && p.health > 0) return id;
		return null;
	},
	findNearestPlayer(e, rad, players) {
		let id = null;
		Object.values(players).every(c => {
			const dx = c.dx - e.dx;
   		const dy = c.dy - e.dy;

  		if (dx * dx + dy * dy < rad * rad && c.scene == e.scene && !c.editor && c.health > 0) return id = c.id;
			return false;
		});
		return id;
	},
	walls(s, map) {
		const walls = [];
		for (let i = 0; i < map[s].cols * map[s].rows; i++) {
			walls[i] = 0;
			if (map[s].structure[i] && !dontCollide.includes(map[s].structure[i])) walls[i] = 1;
			if (!dontCollide.includes(map[s].layers.scenery[i])) walls[i] = 1;
			if (map[s].layers.ground[i] == 40) walls[i] = 1;
		}
		return walls;
	},
};

const findPath = (e, dx, dy, map) => {
	let c, r, s = e.scene;
	c = Math.floor(e.dx / tsize);
	r = Math.floor((e.dy - tsize) / tsize);
	if (
		Math.abs(dy - e.dy) >= Math.abs(dx - e.dx) &&
		dy - e.dy < 0 &&
		e.x == e.dx &&
		e.y == e.dy &&
		enemies.walls(s, map)[getIndex(s, c, r, map)] == 0
	) { e.dy -= tsize; e.dir = 1 }
	c = Math.floor(e.dx / tsize);
	r = Math.floor((e.dy + tsize) / tsize);
	if (
		Math.abs(dy - e.dy) >= Math.abs(dx - e.dx) &&
		dy - e.dy > 0 &&
		e.x == e.dx &&
		e.y == e.dy &&
		enemies.walls(s, map)[getIndex(s, c, r, map)] == 0
	) { e.dy += tsize; e.dir = 0 }
	c = Math.floor((e.dx - tsize) / tsize);
	r = Math.floor(e.dy / tsize);
	if (
		Math.abs(dx - e.dx) >= Math.abs(dy - e.dy) &&
		dx - e.dx < 0 &&
		e.x == e.dx &&
		e.y == e.dy &&
		enemies.walls(s, map)[getIndex(s, c, r, map)] == 0
	) { e.dx -= tsize; e.dir = 2 }
	c = Math.floor((e.dx + tsize) / tsize);
	r = Math.floor(e.dy / tsize);
	if (
		Math.abs(dx - e.dx) >= Math.abs(dy - e.dy) &&
		dx - e.dx > 0 &&
		e.x == e.dx &&
		e.y == e.dy &&
		enemies.walls(s, map)[getIndex(s, c, r, map)] == 0
	) { e.dx += tsize; e.dir = 3 }
	if (e.dx < 0) e.dx = 0;
	if (e.dy < 0) e.dy = 0;
	if (e.dx > (map[s].cols - 1) * tsize) e.dx = (map[s].cols - 1) * tsize;
	if (e.dy > (map[s].rows - 1) * tsize) e.dy = (map[s].rows - 1) * tsize;
	c = Math.floor(e.dx / tsize);
	r = Math.floor(e.dy / tsize);
	if (enemies.walls(s, map)[getIndex(s, c, r, map)] == 1) { e.dx = e.x; e.dy = e.y }
}

const getTile = (s, l, c, r, map) => {
	if (map[s].layers[l]) return map[s].layers[l][getIndex(s, c, r)];
	return map[s][l][getIndex(s, c, r, map)] || -1;
}

const getAllTiles = (s, c, r, map) => {
	const tiles = [];
	Object.keys(map[s].layers).forEach(l => tiles.push(map[s].layers[l].indexOf(getIndex(s, c, r, map))));
	return tiles;
}

const getIndex = (s, c, r, map) => {
	return r * map[s].cols + c;
}

module.exports = enemies;