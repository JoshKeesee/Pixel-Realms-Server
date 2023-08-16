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

app.use(express.urlencoded({
	extended: true,
}));
app.use(express.json());
app.use(cors());
app.use("/profiles", express.static(__dirname + "/profiles"));
new Login(app);
require("./assets/discordBot")(io, db);

io.on("connection", socket => {
	const banned = db.get("banned") || [];
	if (banned.includes(socket.handshake.address)) return socket.emit("ban");
	let user = {};

	socket.on("login", data => {
		if (!data) return;
		user = data;
		const p = defaultPlayer(socket.id);
		p.name = data.name;
		p.profile = data.profile;
		p.id = socket.id;
		p.user = user;
		user.room = p.room;
		socket.emit("user", p);
		socket.broadcast.to(user.room).emit("update player", p);
	});

	socket.on("logout", () => {
		const rooms = db.get("rooms") || {};
		if (!user.id) return;
		user = {};
		rooms[user.room].players[socket.id] = defaultPlayer(socket.id);
		socket.emit("user", defaultPlayer(socket.id));
		socket.broadcast.emit("update player", defaultPlayer(socket.id));
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
		const rooms = db.get("rooms") || {};
		if (!user.room) return;
		rooms[user.room].daylight = time;
		db.set({ rooms });
		socket.broadcast.to(user.room).emit("update daylight", rooms[user.room].daylight);
	});

	socket.on("update map", d => {
		const rooms = db.get("rooms") || {};
		if (!d || !user.room) return;
		rooms[user.room].map[d[1]] = d[0];
		db.set({ rooms });
		socket.broadcast.to(user.room).emit("update map", d);
	});

	socket.on("update break", d => {
		const rooms = db.get("rooms") || {};
		if (!d || !user.room) return;
		if (d[0] < 0) delete rooms[user.room].map[d[1]].break[d[2]];
		else rooms[user.room].map[d[1]].break[d[2]] = d[0];
		db.set({ rooms });
		socket.broadcast.to(user.room).emit("update break", d);
	});

	socket.on("delete map", s => {
		if (s < 0 || !user.room) return;
		map.splice(s, 1);
		socket.broadcast.to(user.room).emit("delete map", s);
	});

	socket.on("update entity", data => {
		const rooms = db.get("rooms") || {};
		if (!user.room || !data) return;
		const p = rooms[user.room].players[socket.id];
		rooms[user.room].map[p.scene].entities[data[1]] = data[0];
		db.set({ rooms });
		socket.broadcast.emit("update entity", [...data, p.scene]);
	});

	socket.on("remove entity", data => {
		const rooms = db.get("rooms") || {};
		if (!user.room || !data) return;
		const p = rooms[user.room].players[socket.id];
		rooms[user.room].map[p.scene].entities.splice(data, 1);
		db.set({ rooms });
		socket.broadcast.emit("remove entity", [...data, p.scene]);
	});

	socket.on("update player", changes => {
		const rooms = db.get("rooms") || {};
		if (!changes || !user.room) return;
		const p = rooms[user.room].players[socket.id];
		Object.keys(changes).forEach(k => p[k] = changes[k]);
		db.set({ rooms });
		socket.broadcast.emit("update player", { ...changes, id: socket.id });
	});

	socket.on("disconnect", () => {
		const rooms = db.get("rooms") || {};
		if (!user.room) return;
		const p = rooms[user.room].players[socket.id];
		if (user) playerRef.child(user.id).set(p);
		delete rooms[user.room].players[socket.id];
		db.set({ rooms });
		io.to(user.room).emit("remove player", socket.id);
	});

	socket.on("chat message", m => {
		const rooms = db.get("rooms") || {};
		if (!m || !user.room) return;
		const p = rooms[user.room].players[socket.id];
		io.to(user.room).emit("chat message", {
			message: m.replace(new RegExp("\\b" + badWords.join("|") + "\\b", "gi"), "****"),
			name: p.name,
		});
	});

	socket.on("ping", cb => cb());

	socket.on("join room", id => {
		const rooms = db.get("rooms") || {};
		if (!rooms[id] || user.room == id) return;
		if (user.room) socket.leave(user.room);
		user.room = id;
		p = defaultPlayer(socket.id);
		if (user.id) {
			p.name = user.name;
			p.profile = user.profile;
			p.user = user;
		}
		rooms[user.room].players[socket.id] = p;
		db.set({ rooms });
		socket.join(user.room);
		
		socket.emit("update daylight", rooms[user.room].daylight);
		socket.emit("init map", rooms[user.room].map);
		socket.emit("init players", rooms[user.room].players);
		socket.broadcast.to(user.room).emit("update player", p);
	});

	socket.on("leave room", () => {
		if (!user.room) return;
		socket.leave(user.room);
		user.room = null;
	});

	socket.on("create room", (name, public = true) => {
		if (!user.id) return;
		const rooms = db.get("rooms") || {};
		const p = defaultPlayer(socket.id);
		p.user = user;
		p.name = user.name;
		p.profile = user.profile;
		const roomId = createId(7);
		rooms[roomId] = {
			name,
			public,
			creator: user.name,
			map: newMap(),
			players: { [socket.id]: p },
			daylight: 0,
		};
		db.set({ rooms });
		socket.leave(user.room);
		user.room = roomId;
		socket.join(user.room);
		socket.emit("user", p);
		socket.broadcast.to(user.room).emit("update player", p);
	});

	socket.on("get rooms", cb => cb(db.get("rooms") || {}));
});

const gameLoop = () => {
	setTimeout(gameLoop, 24 * 60000 / 24);
	let sleeping = 0;
	// players.forEach(p => (p.id != "offline" && p.bed) ? sleeping++ : "");
	// daylight++;
	// if (daylight >= 24 || (sleeping >= Math.ceil(players.size / 2) && sleeping > 0)) daylight = 0;
	// map.forEach(m => {
	// 	if (m.entities.length == 0) return;
	// 	m.entities.forEach(e => {
	// 		let moving = false;
	// 		players.forEach(p => (p.minecart == m.entities.indexOf(e)) ? moving = true : "");
	// 		if (!moving && e.id != 2) {
	// 			e.x = e.dx;
	// 			e.y = e.dy;
	// 			e.moving = false;
	// 			io.emit("update entity", [e, m.entities.indexOf(e), map.indexOf(m)]);
	// 		}
	// 		if (e.type == "arrow" && !players.get(e.from) || (!e.x || !e.y)) {
	// 			io.emit("remove entity", [m.entities.indexOf(e), map.indexOf(m)]);
	// 			m.entities.splice(m.entities.indexOf(e), 1);
	// 		}
	// 	});
	// });
	// io.emit("update daylight", daylight);
};

gameLoop();

server.listen(port, () => console.log(`Server listening on port ${port}`));