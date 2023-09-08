const express = require("express");
const app = express();
const cors = require("cors");
const server = require("http").createServer(app);
const port = process.env.PORT || 3000;
const io = require("socket.io")(server, { cors: { origin: "*" } });
const badWords = require("badwords-list").regexp;
const defaultPlayer = require("./assets/defaultPlayer");
const Login = require("@jkeesee/login");
const db = require("@jkeesee/json-db");
const createId = require("./assets/createId.js");
const newMap = require("./assets/newMap.js");
const checkMap = require("./assets/checkMap.js");
const compressMap = require("./assets/compressMap.js");
const decompressMap = require("./assets/decompressMap.js");
const getSize = require("./assets/getSize.js");
const devs = { 0: true, 1: true };
Object.freeze(devs);
const r = db.get("rooms");
const players = {};
Object.keys(r).forEach(k => players[k] = {});
const entities = {};
Object.keys(r).forEach(k => {
	entities[k] = [];
	Object.keys(r[k].map).forEach((s, i) => entities[k][i] = []);
});
const maps = {};
Object.keys(r).forEach(k => maps[k] = checkMap(decompressMap(r[k].map)));

app.use(cors());
app.use("/profiles", express.static(__dirname + "/profiles"));
new Login(app);
require("./assets/discordBot")(io, players, db);

io.on("connection", socket => {
	let user = {};

	socket.on("login", data => {
		if (!data) return;
		user = { ...data, room: user.room };
		if (!user.room) return;
		const rooms = db.get("rooms") || {};
		const p = rooms[user.room].saves[user.id] || defaultPlayer(socket.id);
		p.name = data.name;
		p.profile = data.profile;
		p.id = socket.id;
		p.user = user;
		players[user.room][socket.id] = p;
		db.set({ rooms });
		socket.broadcast.to(user.room).emit("update player", players[user.room][socket.id]);
		socket.emit("user", p);
	});

	socket.on("logout", () => {
		if (typeof user.id != "number" || !user.room) return;
		const rooms = db.get("rooms") || {};
		rooms[user.room].saves[user.id] = players[user.room][socket.id];
		players[user.room][socket.id] = defaultPlayer(socket.id);
		db.set({ rooms });
		socket.broadcast.to(user.room).emit("update player", players[user.room][socket.id]);
		socket.emit("user", players[user.room][socket.id]);
		user = { room: user.room };
	});

	socket.on("give item", ([id, item, amount]) => (devs[players[user.room][id].user?.id] || db.get("rooms")[user.room].admins[players[user.room][id].user?.id]) ? socket.to(id).emit("give item", [item, amount]) : "");
	socket.on("tp", ([id, x, y, scene]) => (devs[players[user.room][id].user?.id] || db.get("rooms")[user.room].admins[players[user.room][id].user?.id]) ? socket.to(id).emit("tp", [x, y, scene]) : "");
	socket.on("clear inventory", id => (devs[players[user.room][id].user?.id] || db.get("rooms")[user.room].admins[players[user.room][id].user?.id]) ? socket.to(id).emit("clear inventory") : "");
	socket.on("clear backpack", id => (devs[players[user.room][id].user?.id] || db.get("rooms")[user.room].admins[players[user.room][id].user?.id]) ? socket.to(id).emit("clear backpack") : "");
	socket.on("kill", id => (devs[players[user.room][id].user?.id] || db.get("rooms")[user.room].admins[players[user.room][id].user?.id]) ? socket.to(id).emit("kill") : "");
	socket.on("kick", id => (devs[players[user.room][id].user?.id] || db.get("rooms")[user.room].admins[players[user.room][id].user?.id]) ? socket.to(id).emit("kick") : "");
	socket.on("ban", id => {
		if (typeof user.id != "number" || !user.room || !id) return;
		const rooms = db.get("rooms") || {};
		if (!rooms[user.room].admins[user.id] && !devs[user.id]) return;
		if (rooms[user.room].admins[id] || devs[id]) return;
		const ban = players[user.room][id].user?.id;
		if (ban) rooms[user.room].banned.push(ban);
		if (ban) db.set({ rooms });
		socket.to(id).emit("kick");
	});
	socket.on("op", id => {
		if (!user.room || typeof user.id != "number") return;
		const rooms = db.get("rooms") || {};
		if (!rooms[user.room].admins[user.id] && !devs[user.id] && user.name != rooms[user.room].creator) return;
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
		if (!rooms[user.room].admins[user.id] && !devs[user.id]) return;
		const p = players[user.room][id];
		if (!p?.user) return;
		if (!rooms[user.room].admins[p.user.id] || p.user.name == rooms[user.room].creator) return;
		rooms[user.room].admins[p.user.id] = false;
		db.set({ rooms });
		io.to(user.room).emit("update admins", rooms[user.room].admins);
	});
	socket.on("update daylight", time => {
		if (!user.room || !devs[players[user.room][id].user?.id]) return;
		const rooms = db.get("rooms") || {};
		rooms[user.room].daylight = time;
		db.set({ rooms });
		socket.broadcast.to(user.room).emit("update daylight", time);
	});
	socket.on("update map", d => {
		if (!d || !user.room) return;
		maps[user.room][d[1]] = d[0];
		socket.broadcast.to(user.room).emit("update map", d);
	});
	socket.on("update break", d => {
		if (!d || !user.room) return;
		socket.broadcast.to(user.room).emit("update break", d);
	});
	socket.on("delete map", s => {
		if (s < 0 || !user.room) return;
		maps[user.room].splice(s, 1);
		socket.broadcast.to(user.room).emit("delete map", s);
	});
	socket.on("update entity", data => {
		if (!user.room || !data) return;
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
		Object.keys(changes).forEach(k => p[k] = changes[k]);
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
			message: m.replace(badWords, "****"),
			name: p.name,
		});
	});
	socket.on("ping", cb => {
		if (!user.room) return;
		const rooms = db.get("rooms") || {};
		cb(rooms[user.room].admins);
	});
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
		p = defaultPlayer(socket.id);
		if (typeof user.id == "number") {
			p.name = user.name;
			p.profile = user.profile;
			p.user = user;
		}
		players[user.room][socket.id] = p;
		db.set({ rooms });
		socket.join(user.room);

		socket.emit("update admins", rooms[user.room].admins);
		socket.broadcast.to(user.room).emit("update player", p);
		socket.emit("update daylight", rooms[user.room].daylight);
		socket.emit("init map", maps[user.room]);
		socket.emit("init players", players[user.room]);
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
	socket.on("create room", (name, public = true) => {
		if (typeof user.id != "number") return;
		const rooms = db.get("rooms") || {};
		const myRooms = [];
		Object.keys(rooms).forEach(k => (rooms[k].creator == user.name) ? myRooms.push(k) : "");
		if (myRooms.length >= 3) return;
		const p = defaultPlayer(socket.id);
		p.user = user;
		p.name = user.name;
		p.profile = user.profile;
		const roomId = createId(7);
		rooms[roomId] = {
			name,
			public,
			id: roomId,
			creator: user.name,
			map: compressMap(newMap()),
			admins: { [user.id]: true },
			saves: {},
			banned: [],
			daylight: 0,
		};
		db.set({ rooms });
		if (user.room) socket.leave(user.room);
		user.room = roomId;
		players[user.room] = { [socket.id]: p };
		entities[user.room] = [[]];
		maps[user.room] = newMap();
		socket.join(user.room);
		socket.emit("update admins", rooms[user.room].admins);
		socket.broadcast.to(user.room).emit("update player", p);
		socket.emit("update daylight", rooms[user.room].daylight);
		socket.emit("init map", maps[user.room]);
		socket.emit("init players", players[user.room]);
		socket.emit("user", p);
	});
	socket.on("get rooms", cb => {
		const rooms = db.get("rooms") || {};
		const r = {};
		Object.keys(rooms).forEach(k => {
			const { name, id, public, creator, banned } = rooms[k];
			if (devs[user.id] || public) r[k] = { name, id, public, creator, online: Object.keys(players[k]).length, banned, size: getSize(rooms[k]) };
		});
		cb(r);
	});
});

const gameLoop = () => {
	setTimeout(gameLoop, 24 * 60000 / 24);
	let sleeping = 0;
	const rooms = db.get("rooms") || {};
	Object.keys(rooms).forEach(k => {
		const r = rooms[k];
		r.map = checkMap(Array.from(maps[k]));
		Object.keys(entities[k]).forEach((e, i) => r.map[i].entities = entities[k][i]);
		Object.values(players[k]).forEach(p => (p.id != "offline" && p.bed) ? sleeping++ : "");
		r.daylight++;
		if (r.daylight >= 24 || (sleeping >= Math.ceil(Object.keys(players[k]).length / 2) && sleeping > 0)) r.daylight = 0;
		r.map.forEach(m => {
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

gameLoop();

server.listen(port, () => console.log(`Server listening on port ${port}`));