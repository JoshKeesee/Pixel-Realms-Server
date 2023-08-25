module.exports = object => {
	const bytes = new TextEncoder().encode(JSON.stringify(object)).length;
	return formatBytes(bytes);
};

const formatBytes = (a, b = 2) => {
	if (!+a) return "0 Bytes";
	const c = 0 > b ? 0 : b, d = Math.floor(Math.log(a) / Math.log(1024));
	return `${parseFloat((a / Math.pow(1024, d)).toFixed(c))} ${["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"][d]}`;
}