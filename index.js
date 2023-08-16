const express = require("express");
const app = express();
const cors = require("cors");
const server = require("http").createServer(app);
const port = process.env.PORT || 3000;
const io = require("socket.io")(server, { cors: { origin: "*" } });
const badWords = require("badwords-list").array;
const defaultPlayer = require("./assets/defaultPlayer");
const Login = require("@jkeesee/login");
const db = require("@jkeesee/json-db");
const createId = require("./assets/createId.js");
const newMap = require("./assets/newMap.js");
const rooms = db.get("rooms") || {};
Object.keys(rooms).forEach(k => rooms[k].players = {});

setInterval(() => db.set({ rooms }), 10000);

app.use(express.urlencoded({
	extended: true,
}));
app.use(express.json());
app.use(cors());
app.use("/profiles", express.static(__dirname + "/profiles"));
new Login(app);
require("./assets/discordBot")(io, rooms, db);

io.on("connection", socket => {
	const banned = db.get("banned") || [];
	if (banned.includes(socket.handshake.address)) return socket.emit("ban");
	let user = {};

	socket.on("login", data => {
		if (!data) return;
		user = { ...data, room: user.room };
		if (!user.room) return;
		const p = rooms[user.room].save[user.id] || defaultPlayer(socket.id);
		p.name = data.name;
		p.profile = data.profile;
		p.id = socket.id;
		p.user = user;
		rooms[user.room].players[socket.id] = p;
		socket.broadcast.to(user.room).emit("update player", rooms[user.room].players[socket.id]);
		socket.emit("user", p);
	});

	socket.on("logout", () => {
		if (typeof user.id != "number" || !user.room) return;
		rooms[user.room].save[user.id] = rooms[user.room].players[socket.id];
		rooms[user.room].players[socket.id] = defaultPlayer(socket.id);
		socket.broadcast.to(user.room).emit("update player", rooms[user.room].players[socket.id]);
		socket.emit("user", rooms[user.room].players[socket.id]);
		user = { room: user.room };
	});

	socket.on("give item", ([id, item, amount]) => socket.to(id).emit("give item", [item, amount]));
	socket.on("tp", ([id, x, y, scene]) => socket.to(id).emit("tp", [x, y, scene]));
	socket.on("clear inventory", id => socket.to(id).emit("clear inventory"));
	socket.on("clear backpack", id => socket.to(id).emit("clear backpack"));
	socket.on("kick", id => socket.to(id).emit("kick"));
	socket.on("ban", id => {
		const ip = io.sockets.sockets.get(id).handshake.address;
		const banned = db.get("banned") || [];
		banned.push(ip);
		db.set({ banned });
		socket.to(id).emit("kick");
	});
	socket.on("update daylight", time => {
		if (!user.room) return;
		rooms[user.room].daylight = time;
		socket.broadcast.to(user.room).emit("update daylight", rooms[user.room].daylight);
	});

	socket.on("update map", d => {
		if (!d || !user.room) return;
		rooms[user.room].map[d[1]] = d[0];
		socket.broadcast.to(user.room).emit("update map", d);
	});

	socket.on("update break", d => {
		if (!d || !user.room) return;
		if (d[0] < 0) delete rooms[user.room].map[d[1]].break[d[2]];
		else rooms[user.room].map[d[1]].break[d[2]] = d[0];
		socket.broadcast.to(user.room).emit("update break", d);
	});

	socket.on("delete map", s => {
		if (s < 0 || !user.room) return;
		map.splice(s, 1);
		socket.broadcast.to(user.room).emit("delete map", s);
	});

	socket.on("update entity", data => {
		if (!user.room || !data) return;
		const p = rooms[user.room].players[socket.id];
		rooms[user.room].map[p.scene].entities[data[1]] = data[0];
		socket.broadcast.to(user.room).emit("update entity", [...data, p.scene]);
	});

	socket.on("remove entity", data => {
		if (!user.room || !data) return;
		const p = rooms[user.room].players[socket.id];
		rooms[user.room].map[p.scene].entities.splice(data, 1);
		socket.broadcast.to(user.room).emit("remove entity", [...data, p.scene]);
	});

	socket.on("update player", changes => {
		if (!changes || !user.room) return;
		const p = rooms[user.room].players[socket.id];
		Object.keys(changes).forEach(k => p[k] = changes[k]);
		socket.broadcast.to(user.room).emit("update player", { ...changes, id: socket.id });
	});

	socket.on("disconnect", () => {
		if (!user.room) return;
		delete rooms[user.room].players[socket.id];
		io.to(user.room).emit("remove player", socket.id);
	});

	socket.on("chat message", m => {
		if (!m || !user.room) return;
		const p = rooms[user.room].players[socket.id];
		io.to(user.room).emit("chat message", {
			message: m.replace(new RegExp("\\b" + badWords.join("|") + "\\b", "gi"), "****"),
			name: p.name,
		});
	});

	socket.on("ping", cb => cb());

	socket.on("join room", id => {
		if (!rooms[id] || user.room == id) return;
		if (user.room) socket.leave(user.room);
		user.room = id;
		p = defaultPlayer(socket.id);
		if (typeof user.id == "number") {
			p.name = user.name;
			p.profile = user.profile;
			p.user = user;
		}
		rooms[user.room].players[socket.id] = p;
		socket.join(user.room);

		socket.broadcast.to(user.room).emit("update player", p);
		socket.emit("update daylight", rooms[user.room].daylight);
		socket.emit("init map", rooms[user.room].map);
		socket.emit("init players", rooms[user.room].players);
	});

	socket.on("leave room", () => {
		if (!user.room) return;
		if (typeof user.id == "number") rooms[user.room].save[user.id] = rooms[user.room].players[socket.id];
		delete rooms[user.room].players[socket.id];
		socket.leave(user.room);
		user.room = null;
	});

	socket.on("create room", (name, public = true) => {
		if (typeof user.id != "number") return;
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
			map: newMap(),
			players: { [socket.id]: p },
			save: {},
			daylight: 0,
		};
		if (user.room) socket.leave(user.room);
		user.room = roomId;
		socket.join(user.room);
		socket.broadcast.to(user.room).emit("update player", p);
		socket.emit("update daylight", rooms[user.room].daylight);
		socket.emit("init map", rooms[user.room].map);
		socket.emit("init players", rooms[user.room].players);
		socket.emit("user", p);
	});

	socket.on("get rooms", cb => {
		const r = {};
		Object.keys(rooms).forEach(k => {
			const { name, id, public, creator } = rooms[k];
			r[k] = { name, id, public, creator };
		});
		cb(r);
	});
});

const gameLoop = () => {
	setTimeout(gameLoop, 24 * 60000 / 24);
	let sleeping = 0;
	Object.keys(rooms).forEach(k => {
		const r = rooms[k];
		Object.values(r.players).forEach(p => (p.id != "offline" && p.bed) ? sleeping++ : "");
		r.daylight++;
		if (r.daylight >= 24 || (sleeping >= Math.ceil(Object.keys(r.players).length / 2) && sleeping > 0)) r.daylight = 0;
		r.map.forEach(m => {
			if (m.entities.length == 0) return;
			m.entities.forEach(e => {
				let moving = false;
				Object.values(r.players).forEach(p => (p.minecart == m.entities.indexOf(e)) ? moving = true : "");
				if (!moving && e.id != 2) {
					e.x = e.dx;
					e.y = e.dy;
					e.moving = false;
					io.to(k).emit("update entity", [e, m.entities.indexOf(e), r.map.indexOf(m)]);
				}
				if (e.type == "arrow" && !r.players[e.from] || (!e.x || !e.y)) {
					io.to(k).emit("remove entity", [m.entities.indexOf(e), r.map.indexOf(m)]);
					m.entities.splice(m.entities.indexOf(e), 1);
				}
			});
		});
		io.to(k).emit("update daylight", r.daylight);
	});
};

gameLoop();

server.listen(port, () => console.log(`Server listening on port ${port}`));