const express = require("express");
const app = express();
const server = require("http").createServer(app);
const port = process.env.PORT || 3000;

const io = require("socket.io")(server, { cors: { origin: "*" } });
const badWords = require("badwords-list").array;
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const { getDatabase } = require("firebase-admin/database");

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: "https://pixelwood-default-rtdb.firebaseio.com"
});

const db = getDatabase();
const mapRef = db.ref("map");
const playerRef = db.ref("players");
const defaultPlayer = require("./assets/defaultPlayer");

const players = new Map();
let map = [
	{
		type: "woods",
		cols: 30,
		rows: 30,
		layers: {
			ground: [],
			scenery: [],
		},
		break: {},
		structure: {},
		text: {},
		chest: {},
		teleport: {},
		entities: [],
	}
];
let daylight = 24;

require("./assets/discordBot")(io, players);

mapRef.on("value", snapshot => {
	if (snapshot.val() != null) map = snapshot.val();
	else resetMap();
	map = Object.values(map);
	map.forEach((m, i) => {
		if (!m.break) m.break = {};
		if (!m.structure) m.structure = {};
		if (!m.text) m.text = {};
		if (!m.chest) m.chest = {};
		if (!m.teleport) m.teleport = {};
		if (!m.entities) m.entities = [];
		io.emit("update map", [m, i])
	});
	mapRef.off();
});
setInterval(() => map.forEach((m, i) => mapRef.child(i).set(m)), 60000);

io.on("connection", socket => {
	players.set(socket.id, defaultPlayer(socket.id));

	socket.emit("update daylight", daylight);
	map.forEach((m, i) => socket.emit("update map", [m, i]));
	socket.emit("init players", Object.fromEntries(players));
	socket.broadcast.emit("update player", players.get(socket.id));

	socket.on("google user", data => {
		if (!data) return;
		socket.user = data;
		playerRef.child(socket.user.id).on("value", snapshot => {
			const p = snapshot.val() || players.get(socket.id);
			p.name = socket.user.name;
			p.profile = socket.user.profile;
			p.id = socket.id;
			players.set(socket.id, p);
			socket.emit("user", p);
			socket.broadcast.emit("update player", players.get(socket.id));
			playerRef.child(socket.user.id).off();
		});
	});

	socket.on("google logout", () => {
		if (!socket.user) return;
		playerRef.child(socket.user.id).set(players.get(socket.id));
		delete socket.user;
		players.set(socket.id, defaultPlayer(socket.id));
		socket.emit("user", defaultPlayer(socket.id));
		socket.broadcast.emit("update player", players.get(socket.id));
	});

	socket.on("give item", ([id, item, amount]) => socket.to(id).emit("give item", [item, amount]));
	socket.on("tp", ([id, x, y, scene]) => socket.to(id).emit("tp", [x, y, scene]));
	socket.on("clear inventory", id => socket.to(id).emit("clear inventory"));
	socket.on("clear backpack", id => socket.to(id).emit("clear backpack"));
	socket.on("update daylight", time => {
		daylight = time;
		socket.broadcast.emit("update daylight", daylight);
	});

	socket.on("update map", d => {
		if (!d) return;
		map[d[1]] = d[0];
		socket.broadcast.emit("update map", d);
	});

	socket.on("update break", d => {
		if (!d) return;
		if (d[0] < 0) delete map[d[1]].break[d[2]];
		else map[d[1]].break[d[2]] = d[0];
		socket.broadcast.emit("update break", d);
	});

	socket.on("delete map", s => {
		if (s < 0) return;
		map.splice(s, 1);
		socket.broadcast.emit("delete map", s);
	});

	socket.on("update entity", data => {
		map[players.get(socket.id).scene].entities[data[1]] = data[0];
		socket.broadcast.emit("update entity", [...data, players.get(socket.id).scene]);
	});

	socket.on("remove entity", data => {
		map[players.get(socket.id).scene].entities.splice(data, 1);
		socket.broadcast.emit("remove entity", [data, players.get(socket.id).scene]);
	});

	socket.on("update player", changes => {
		if (!changes) return;
		const p = players.get(socket.id);
		Object.keys(changes).forEach(k => p[k] = changes[k]);
		players.set(socket.id, p);
		socket.broadcast.emit("update player", { ...changes, id: socket.id });
	});

	socket.on("disconnect", () => {
		if (socket.user) playerRef.child(socket.user.id).set(players.get(socket.id));
		players.delete(socket.id);
		io.emit("remove player", socket.id);
	});

	socket.on("chat message", m => {
		if (!m) return;
		io.emit("chat message", {
			message: m.replace(new RegExp("\\b" + badWords.join("|") + "\\b", "gi"), "****"),
			name: players.get(socket.id).name,
		});
	});
});

const resetMap = (x = 0) => {
	map[x] = { type: "woods", cols: 30, rows: 30, layers: { ground: [], scenery: [] } };
	map[x].break = {};
	map[x].structure = {};
	map[x].text = {};
	map[x].chest = {};
	map[x].teleport = {};
	map[x].entities = [];
	for (let i = 0; i < map[x].cols * map[x].rows; i++) {
		map[x].layers.ground[i] = 0;
		map[x].layers.scenery[i] = -1;
	}

	for (let i = 0; i < map[x].cols; i++) {
		map[x].layers.scenery[i] = 53;
		map[x].layers.scenery[map[x].layers.scenery.length - 1 - i] = 53;
	}

	for (let i = 1; i < map[x].rows; i++) {
		map[x].layers.scenery[i * map[x].cols] = 53;
		map[x].layers.scenery[(i * map[x].cols) - 1] = 53;
	}
};

const gameLoop = () => {
	setTimeout(gameLoop, 24 * 60000 / 24);
	let sleeping = 0;
	players.forEach(p => (p.id != "offline" && p.bed) ? sleeping++ : "");
	daylight++;
	if (daylight >= 24 || (sleeping >= Math.ceil(players.size / 2) && sleeping > 0)) daylight = 0;
	map.forEach(m => {
		if (m.entities.length == 0) return;
		m.entities.forEach(e => {
			let moving = false;
			players.forEach(p => (p.minecart == m.entities.indexOf(e)) ? moving = true : "");
			if (!moving && e.id != 2) {
				e.x = e.dx;
				e.y = e.dy;
				e.moving = false;
				io.emit("update entity", [e, m.entities.indexOf(e), map.indexOf(m)]);
			}
			if (e.type == "arrow" && !players.get(e.from) || (!e.x || !e.y)) {
				io.emit("remove entity", [m.entities.indexOf(e), map.indexOf(m)]);
				m.entities.splice(m.entities.indexOf(e), 1);
			}
		});
	});
	io.emit("update daylight", daylight);
};

gameLoop();

server.listen(port, () => console.log(`Server listening on port ${port}`));