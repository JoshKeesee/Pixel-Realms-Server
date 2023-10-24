const { findPath, getIndex, walls } = require("./findPath");
const { itemStats, animalTypes, animalGives, dontCollide, tsize, colliding } = require("./stats");

const animals = {
	update(e, map, players, entities, io) {
		if (!e) return;
		if (e.x == e.dx && e.y == e.dy && (Math.floor(Math.random() * (50 - 1) + 1) == 1)) {
			let moveX = e.dx, moveY = e.dy;
			const random = Math.round(Math.random()) == 0 ? tsize : -tsize;

			if (Math.round(Math.random()) == 0) moveX += random;
			else moveY += random;
			if (moveX < 0) moveX += -random * 2;
			if (moveY < 0) moveY += -random * 2;
			if (moveX >= map[e.scene].cols) moveX -= -random * 2;
			if (moveY >= map[e.scene].rows) moveY -= -random * 2;
			const { dx, dy } = { dx: moveX, dy: moveY };
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
					if (e.health <= 0) {
						e.gives.forEach((item, i) => io.to(v.id).emit("give item", [e.gives[i], 1]));
					}
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
						walls(e.scene, map)[getIndex(e.scene, Math.floor(e.dx / tsize), Math.floor(e.dy / tsize), map)] == 1 ||
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
					return false;
				}
				else return true;
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
				kill = entities.indexOf(e);
				if (e.health <= 0) {
					e.gives.forEach((item, i) => io.to(t.from).emit("give item", [e.gives[i], 1]));
				}
				return true;
			}
		});
		if (typeof kill == "number") return kill;
		if (e.health <= 0) {
			e.health = 0;
			return entities.indexOf(e);
		}
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
		if (walls(e.scene, map)[getIndex(e.scene, c, r, map)] == 1) {
			e.health -= 0.5;
			if (
				walls(e.scene, map)[getIndex(e.scene, c + 1, r, map)] == 1 &&
				walls(e.scene, map)[getIndex(e.scene, c - 1, r, map)] == 1 &&
				walls(e.scene, map)[getIndex(e.scene, c, r + 1, map)] == 1 &&
				walls(e.scene, map)[getIndex(e.scene, c, r - 1, map)] == 1
			) e.health -= 0.5;
		}
	},
	spawn(e = {}, map, entities) {
		if (typeof e != "object" || !map || !entities) return;
		if (typeof e.scene != "number") e.scene = players[myId].scene;
		const openSpot = animals.getOpenSpot(e.scene, map);
		if (typeof e.x != "number" || typeof e.y != "number" || e.x < 0 || e.y < 0) { e.x = openSpot.x; e.y = openSpot.y }
		if (!e.type) e.type = Object.keys(animalTypes)[Math.floor(Math.random() * Object.keys(animalTypes).length)].replaceAll("_", " ");
		if (e.type == "dark knight") e.helmet = Math.floor(Math.random() * (3 - 1) + 1) == 1;
		if (!e.gives) e.gives = animalGives[e.type];
		e.dx = e.x;
		e.dy = e.y;
		e.frame = 0;
		e.dir = 0;
		e.health = 100;
		e.animal = true;
		e.id = animalTypes[e.type];
		e.cooldown = 0;
		entities.push(e);
	},
	despawn(map, entities) {
		map.forEach((m, i) => entities[i] = entities[i]?.map(e => !e.animal));
	},
	getOpenSpot(s, map) {
		let openSpot = Math.floor(Math.random() * walls(s, map).length);
		while (walls(s, map)[openSpot] != 0) openSpot = Math.floor(Math.random() * walls(s, map).length);
		const x = openSpot % map[s].cols;
		const y = (openSpot - x) / map[s].cols;
		return { x: x * tsize, y: y * tsize };
	},
};

module.exports = animals;