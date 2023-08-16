module.exports = () => {
	let newMap = [];
	newMap[0] = { type: "woods", cols: 30, rows: 30, layers: { ground: [], scenery: [] } };
	newMap[0].break = {};
	newMap[0].structure = {};
	newMap[0].text = {};
	newMap[0].chest = {};
	newMap[0].teleport = {};
	newMap[0].entities = [];
	for (let i = 0; i < newMap[0].cols * newMap[0].rows; i++) {
		newMap[0].layers.ground[i] = 0;
		newMap[0].layers.scenery[i] = -1;
	}

	for (let i = 0; i < newMap[0].cols; i++) {
		newMap[0].layers.scenery[i] = 53;
		newMap[0].layers.scenery[newMap[0].layers.scenery.length - 1 - i] = 53;
	}

	for (let i = 1; i < newMap[0].rows; i++) {
		newMap[0].layers.scenery[i * newMap[0].cols] = 53;
		newMap[0].layers.scenery[(i * newMap[0].cols) - 1] = 53;
	}

	return newMap;
};