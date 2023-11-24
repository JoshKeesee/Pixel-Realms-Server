const express = require("express");
const app = express();
const cors = require("cors");
const server = require("http").createServer(app);
const port = process.env.PORT || 3000;
const io = require("socket.io")(server, { cors: { origin: "*" } });
const badWords = require("badwords-list").regex;
const defaults = require("./assets/defaults");
const Login = require("@jkeesee/login");
const db = require("@jkeesee/json-db");
db.condense();
const createId = require("./assets/createId");
const checkMap = require("./assets/checkMap");
const compressMap = require("./assets/compressMap");
const decompressMap = require("./assets/decompressMap");
const getSize = require("./assets/getSize");
const enemies = require("./assets/enemies");
const animals = require("./assets/animals");
const { performance } = require("perf_hooks");
const dotenv = require("dotenv");
dotenv.config();
const devs = { "JoshKeesee": true, "Phanghost": true };
const FPS = 60;
let startFrames = performance.now();
Object.freeze(devs);
const r = db.get("rooms") || {};
const players = {};
const entities = {};
const leaderboard = {};
Object.keys(r).forEach(k => {
	players[k] = {};
	entities[k] = [];
	leaderboard[k] = {};
	Object.keys(r[k].map).forEach((s, i) => entities[k][i] = []);
	Object.values(r[k].saves).forEach(s => leaderboard[k][s.user.id] = { xp: s.xp || 0, id: s.id, name: s.name });
});
const maps = {};
Object.keys(r).forEach(k => maps[k] = checkMap(decompressMap(r[k].map)));
const fs = require("fs");
const dir = "./profiles";
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

const VERSION = "1.0.2";

app.use(cors());
app.use("/profiles", express.static(__dirname + "/profiles"));
new Login(app);

io.on("connection", socket => {
	let user = {};

	socket.on("version", cb => cb(VERSION));

	socket.on("login", data => {
		if (!data) return;
		user = { ...data, room: user.room };
		if (!user.room) return;
		const rooms = db.get("rooms") || {};
		const p = rooms[user.room].saves[user.id] ? rooms[user.room].saves[user.id] : (rooms[user.room].defaultMap) ? defaults.player(socket.id, 160, 80, 7) : defaults.player(socket.id);
		p.name = data.name.replace(badWords, t => {
			let r = "";
			t.split("").forEach(() => r += "*");
			return r;
		});
		p.profile = data.profile;
		p.id = socket.id;
		p.user = user;
		const k = rooms[user.room].teams;
		if (rooms[user.room].teamMap) p.team = k[Math.floor(Math.random() * k.length)];
		players[user.room][socket.id] = p;
		db.set({ rooms });
		socket.broadcast.to(user.room).emit("update player", players[user.room][socket.id]);
		socket.emit("user", p);
	});

	socket.on("logout", () => {
		if (typeof user.id != "number" || !user.room) return;
		const rooms = db.get("rooms") || {};
		rooms[user.room].saves[user.id] = players[user.room][socket.id];
		players[user.room][socket.id] = rooms[user.room].defaultMap ? defaults.player(socket.id, 160, 80, 7) : defaults.player(socket.id);
		const k = rooms[user.room].teams;
		if (rooms[user.room].teamMap) p.team = k[Math.floor(Math.random() * k.length)];
		db.set({ rooms });
		socket.broadcast.to(user.room).emit("update player", players[user.room][socket.id]);
		socket.emit("user", players[user.room][socket.id]);
		user = { room: user.room };
	});

	socket.on("give item", ([id, item, amount]) => id && players[user.room][user.id] && (devs[players[user.room][user.id].user?.name] || db.get("rooms")[user.room].admins[players[user.room][user.id].user?.id]) ? socket.to(id).emit("give item", [item, amount]) : "");
	socket.on("tp", ([id, x, y, scene]) => id && players[user.room][user.id] && (devs[players[user.room][user.id].user?.name] || db.get("rooms")[user.room].admins[players[user.room][user.id].user?.id]) ? socket.to(id).emit("tp", [x, y, scene]) : "");
	socket.on("clear inventory", id => id && players[user.room][user.id] && (devs[players[user.room][user.id].user?.name] || db.get("rooms")[user.room].admins[players[user.room][user.id].user?.id]) ? socket.to(id).emit("clear inventory") : "");
	socket.on("clear backpack", id => id && players[user.room][user.id] && (devs[players[user.room][user.id].user?.name] || db.get("rooms")[user.room].admins[players[user.room][user.id].user?.id]) ? socket.to(id).emit("clear backpack") : "");
	socket.on("kill", id => id && players[user.room][user.id] && (devs[players[user.room][user.id].user?.name] || db.get("rooms")[user.room].admins[players[user.room][user.id].user?.id]) ? socket.to(id).emit("kill") : "");
	socket.on("kick", id => id && players[user.room][user.id] && (devs[players[user.room][user.id].user?.name] || db.get("rooms")[user.room].admins[players[user.room][user.id].user?.id]) ? socket.to(id).emit("kick") : "");
	socket.on("ban", id => {
		if (typeof user.id != "number" || !user.room || !id) return;
		const rooms = db.get("rooms") || {};
		if (!rooms[user.room].admins[user.id] && !devs[user.name]) return;
		if (rooms[user.room].admins[id] || devs[players[user.room][id].user?.name]) return;
		const ban = players[user.room][id].user?.id;
		if (ban) rooms[user.room].banned.push(ban);
		if (ban) db.set({ rooms });
		socket.to(id).emit("kick");
	});
	socket.on("op", id => {
		if (!user.room || typeof user.id != "number") return;
		const rooms = db.get("rooms") || {};
		if (!rooms[user.room].admins[user.id] && !devs[user.name] && user.name != rooms[user.room].creator) return;
		const p = players[user.room][id];
		if (!p?.user) return;
		if (rooms[user.room].admins[p.user.id]) return;
		rooms[user.room].admins[p.user.id] = true;
		db.set({ rooms });
		io.to(user.room).emit("update admins", rooms[user.room].admins);
	});
	socket.on("unop", id => {
		if (!user.room || typeof user.id != "number" || id == socket.id) return;
		const rooms = db.get("rooms") || {};
		if (!rooms[user.room].admins[user.id] && !devs[user.name]) return;
		const p = players[user.room][id];
		if (!p?.user) return;
		if (!rooms[user.room].admins[p.user.id] || p.user.name == rooms[user.room].creator) return;
		rooms[user.room].admins[p.user.id] = false;
		db.set({ rooms });
		io.to(user.room).emit("update admins", rooms[user.room].admins);
	});
	socket.on("update daylight", time => {
		if (!user.room || !devs[players[user.room][socket.id].user?.name]) return;
		const rooms = db.get("rooms") || {};
		rooms[user.room].daylight = time;
		db.set({ rooms });
		socket.broadcast.to(user.room).emit("update daylight", time);
	});
	socket.on("update map", d => {
		if (!d || !user.room) return;
		if (players[user.room][socket.id].editor && !devs[players[user.room][socket.id].user?.name]) return;
		maps[user.room][d[1]] = d[0];
		socket.broadcast.to(user.room).emit("update map", d);
	});
	socket.on("update break", d => {
		if (!d || !user.room) return;
		socket.broadcast.to(user.room).emit("update break", d);
	});
	socket.on("update chest", d => {
		if (!d || !user.room) return;
		maps[user.room][d[1]].chest[d[2]] = d[0];
		socket.broadcast.to(user.room).emit("update chest", d);
	});
	socket.on("update furnace", d => {
		if (!d || !user.room) return;
		maps[user.room][d[1]].furnace[d[2]] = d[0];
		socket.broadcast.to(user.room).emit("update furnace", d);
	});
	socket.on("delete map", s => {
		if (s < 0 || !user.room) return;
		if (players[user.room][socket.id].editor && !devs[players[user.room][socket.id].user?.name]) return;
		maps[user.room].splice(s, 1);
		entities[user.room].splice(s, 1);
		socket.broadcast.to(user.room).emit("delete map", s);
	});
	socket.on("update entity", data => {
		if (!user.room || !data) return;
		if (players[user.room][socket.id].editor && !devs[players[user.room][socket.id].user?.name]) return;
		const p = players[user.room][socket.id];
		entities[user.room][p.scene][data[1]] = data[0];
		socket.broadcast.to(user.room).emit("update entity", [...data, p.scene]);
	});
	socket.on("remove entity", data => {
		if (!user.room || !data) return;
		const p = players[user.room][socket.id];
		entities[user.room][p.scene].splice(data, 1);
		socket.broadcast.to(user.room).emit("remove entity", [data, p.scene]);
	});
	socket.on("update player", changes => {
		if (!changes || !user.room) return;
		const p = players[user.room][socket.id];
		Object.keys(changes).forEach(k => {
			p[k] = changes[k];
			if (k == "xp" && p.user) {
				leaderboard[user.room][p.user.id] = { name: p.name, xp: p.xp, id: p.user.id, team: p.team };
				io.to(user.room).emit("update leaderboard", leaderboard[user.room][p.user.id]);
			}
		});
		socket.broadcast.to(user.room).emit("update player", { ...changes, id: socket.id });
	});
	socket.on("disconnect", () => {
		if (!user.room) return;
		const rooms = db.get("rooms") || {};
		if (typeof user.id == "number") rooms[user.room].saves[user.id] = players[user.room][socket.id];
		delete players[user.room][socket.id];
		db.set({ rooms });
		socket.leave(user.room);
		io.to(user.room).emit("remove player", socket.id);
		user.room = null;
	});
	socket.on("chat message", m => {
		if (!m || !user.room) return;
		const p = players[user.room][socket.id];
		io.to(user.room).emit("chat message", {
			message: m.replace(badWords, t => {
				let r = "";
				t.split("").forEach(() => r += "*");
				return r;
			}),
			name: p.name,
		});
	});
	socket.on("ping", cb => cb());
	socket.on("check ban", (id, cb) => {
		const rooms = db.get("rooms") || {};
		if (!rooms[id]) return;
		const ban = user ? user.id : "";
		cb(rooms[id].banned.includes(ban));
	});
	socket.on("join room", id => {
		const rooms = db.get("rooms") || {};
		if (!rooms[id] || user.room == id) return;
		const ban = user ? user.id : "";
		if (rooms[id].banned.includes(ban)) return;
		if (user.room) socket.leave(user.room);
		user.room = id;
		p = rooms[user.room].saves[user.id] ? rooms[user.room].saves[user.id] : rooms[user.room].defaultMap ? defaults.player(socket.id, 160, 80, 7) : defaults.player(socket.id);
		if (typeof user.id == "number") {
			p.name = user.name;
			p.profile = user.profile;
			p.user = user;
			if (!p.xp) p.xp = 0;
		}
		if (!rooms[user.room].teams) rooms[user.room].teams = [];
		const k = rooms[user.room].teams;
		if (rooms[user.room].teamMap) p.team = k[Math.floor(Math.random() * k.length)];
		players[user.room][socket.id] = p;
		db.set({ rooms });
		socket.join(user.room);

		socket.emit("update admins", rooms[user.room].admins);
		socket.broadcast.to(user.room).emit("update player", p);
		socket.emit("update daylight", rooms[user.room].daylight);
		socket.emit("init map", maps[user.room]);
		socket.emit("init players", players[user.room]);
		socket.emit("init entities", entities[user.room]);
		socket.emit("init leaderboard", leaderboard[user.room]);
	});
	socket.on("delete room", (roomId, cb) => {
		const rooms = db.get("rooms") || {};
		if (!rooms[roomId] || (rooms[roomId].creator != user.name && !devs[user.name])) return;
		const ban = user ? user.id : "";
		if (rooms[roomId].banned.includes(ban)) return;
		delete rooms[roomId];
		db.set({ rooms });
		io.to(roomId).emit("kick");
		cb();	
	});
	socket.on("leave room", () => {
		if (!user.room) return;
		const rooms = db.get("rooms") || {};
		if (typeof user.id == "number") rooms[user.room].saves[user.id] = players[user.room][socket.id];
		delete players[user.room][socket.id];
		db.set({ rooms });
		socket.leave(user.room);
		user.room = null;
		io.to(user.room).emit("remove player", socket.id);
	});
	socket.on("create room", ({ name, public = true, defaultMap = true, teamMap = false, numTeams = 0 }) => {
		if (typeof user.id != "number") return;
		const rooms = db.get("rooms") || {};
		const myRooms = [];
		Object.keys(rooms).forEach(k => (rooms[k].creator == user.name) ? myRooms.push(k) : "");
		if (myRooms.length >= 3) return;
		if (Object.values(rooms).some(r => r.name == name)) return;
		const p = defaultMap ? defaults.player(socket.id, 160, 80, 7) : defaults.player(socket.id);
		p.user = user;
		p.name = user.name;
		p.profile = user.profile;
		const roomId = createId(7);
		rooms[roomId] = {
			name: name.replace(badWords, t => {
				let r = "";
				t.split("").forEach(() => r += "*");
				return r;
			}),
			public,
			id: roomId,
			creator: user.name,
			map: defaultMap ? defaults.map() : defaults.newMap(),
			admins: { [user.id]: true },
			leaderboard: { [user.id]: { xp: 0, id: user.id, name: user.name, team: p.team } },
			teams: [],
			saves: {},
			banned: [],
			daylight: 0,
			defaultMap,
			teamMap,
			numTeams,
		};
		const teamColors = ["red", "blue", "yellow", "green"];
		if (teamMap) {
			for (let i = 0; i < numTeams; i++) rooms[roomId].teams[i] = teamColors[i];
		}
		db.set({ rooms });
		if (user.room) socket.leave(user.room);
		user.room = roomId;
		players[user.room] = { [socket.id]: p };
		entities[user.room] = [[]];
		leaderboard[user.room] = rooms[user.room].leaderboard;
		maps[user.room] = decompressMap(rooms[roomId].map);
		socket.join(user.room);
		socket.emit("update admins", rooms[user.room].admins);
		socket.broadcast.to(user.room).emit("update player", p);
		socket.emit("update daylight", rooms[user.room].daylight);
		socket.emit("init map", maps[user.room]);
		socket.emit("init players", players[user.room]);
		socket.emit("init entities", entities[user.room]);
		socket.emit("init leaderboard", leaderboard[user.room]);
		socket.emit("user", p);
	});
	socket.on("get rooms", cb => {
		const rooms = db.get("rooms") || {};
		const r = {};
		Object.keys(rooms).forEach(k => {
			const { id, public, creator, banned, teamMap } = rooms[k];
			const name = rooms[k].name.replace(badWords, t => {
				let r = "";
				t.split("").forEach(() => r += "*");
				return r;
			});
			if (devs[user.name] || public) r[k] = { name, id, public, creator, online: Object.keys(players[k]).length, banned, teamMap, size: getSize(rooms[k]) };
		});
		cb(r);
	});
});

const updateEntities = () => {
	const t = performance.now();
	const frames = t - startFrames >= 150;
	const rooms = db.get("rooms") || {};
	Object.keys(rooms).forEach(k => {
		if (Object.keys(players[k]).length == 0) return;
		const map = checkMap(Array.from(maps[k]));
		entities[k].forEach((sc, s) => {
			if (!sc) entities[k][s] = [];
			if (sc.length == 0 || !Object.values(players[k]).some(p => p.scene == s)) return;
			Object.values(entities[k][s]).filter(e => e?.enemy).forEach((e, i) => {
				const changes = JSON.stringify(e), eChanges = {};
				if (frames) enemies.frames(e, map);
				const kill = enemies.update(e, map, players[k], entities[k][s], io);
				if (typeof kill == "number") {
					entities[k][s].splice(kill, 1);
					io.to(k).emit("remove entity", [kill, s]);
				}
				Object.keys(e).forEach(k => (JSON.parse(changes)[k] != e[k] && k != "i" && k != "frame") ? eChanges[k] = e[k] : "");
				if ((kill != i || kill === false) && Object.keys(eChanges).length != 0) io.to(k).emit("update entity", [eChanges, i, s]);
			});
			Object.values(entities[k][s]).filter(e => e?.animal).forEach((e, i) => {
				const changes = JSON.stringify(e), eChanges = {};
				if (frames) animals.frames(e, map);
				const kill = animals.update(e, map, players[k], entities[k][s], io);
				if (typeof kill == "number") {
					entities[k][s].splice(kill, 1);
					io.to(k).emit("remove entity", [kill, s]);
				}
				Object.keys(e).forEach(k => (JSON.parse(changes)[k] != e[k] && k != "i" && k != "frame") ? eChanges[k] = e[k] : "");
				if ((kill != i || kill === false) && Object.keys(eChanges).length != 0) io.to(k).emit("update entity", [eChanges, i, s]);
			});
		});
	});
	if (frames) startFrames = t;
}

const gameLoop = () => {
	let sleeping = 0;
	const rooms = db.get("rooms") || {};
	Object.keys(rooms).forEach(k => {
		if (Object.keys(players[k]).length == 0) return;
		const r = rooms[k];
		r.map = checkMap(Array.from(maps[k]));
		Object.values(players[k]).forEach(p => (p.id != "offline" && p.bed) ? sleeping++ : "");
		r.daylight++;
		if (r.daylight >= 24 || (sleeping >= Math.ceil(Object.keys(players[k]).length / 2) && sleeping > 0)) r.daylight = 0;
		if (r.daylight == 15) animals.despawn(r.map, entities[k]);
		if (r.daylight == 24 || r.daylight == 0) {
			enemies.despawn(r.map, entities[k]);
			io.to(k).emit("init entities", entities[k]);
		}
		r.map.forEach((m, scene) => {
			if (m.type != "house") {
				const maxEntities = Math.floor(Math.random() * 2);
				for (let i = 0; i < maxEntities; i++) {
					if (r.daylight >= 15) enemies.spawn({ scene }, maps[k], entities[k][scene]);
					else if (m.type != "cave") animals.spawn({ scene }, maps[k], entities[k][scene]);
				}
			}
		});
		io.to(k).emit("init entities", entities[k]);
		Object.keys(entities[k]).forEach((e, i) => r.map[i].entities = entities[k][i]);
		if (!r.leaderboard) r.leaderboard = {};
		Object.keys(leaderboard[k]).forEach((e, i) => r.leaderboard[e] = leaderboard[k][e]);
		r.map.forEach(m => {
			if (!m.entities) return;
			if (m.entities.length == 0) return;
			m.entities.forEach(e => {
				let moving = false;
				Object.values(players[k]).forEach(p => (p.minecart == m.entities.indexOf(e)) ? moving = true : "");
				if (!moving && e.id != 2) {
					e.x = e.dx;
					e.y = e.dy;
					e.moving = false;
					io.to(k).emit("update entity", [e, m.entities.indexOf(e), r.map.indexOf(m)]);
				}
				if (e.type == "arrow" && !players[k][e.from] || (!e.x || !e.y)) {
					io.to(k).emit("remove entity", [m.entities.indexOf(e), r.map.indexOf(m)]);
					m.entities.splice(m.entities.indexOf(e), 1);
				}
			});
		});
		r.map = compressMap(JSON.parse(JSON.stringify(r.map)));
		io.to(k).emit("update daylight", r.daylight);
	});
	Object.keys(rooms).forEach(r => {
		Object.values(players[r]).forEach(p => {
			if (!p.user) return;
			if (typeof p.user.id != "number") return;
			rooms[r].saves[p.user.id] = p;
		});
	});
	db.set({ rooms });
};

setInterval(gameLoop, 24 * 60000 / 24);
setInterval(updateEntities, 1000 / FPS);

server.listen(port, () => console.log(`Server listening on port ${port}`));