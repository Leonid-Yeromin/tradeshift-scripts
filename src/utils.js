const fs = require('fs');
const path = require('path');
const arrify = require('arrify');
const has = require('lodash.has');
const readPkgUp = require('read-pkg-up');
const which = require('which');

const { packageJson: pkg, path: pkgPath } = readPkgUp.sync({
	cwd: fs.realpathSync(process.cwd())
});
const appDirectory = path.dirname(pkgPath);

function resolveKcdScripts() {
	if (pkg.name === 'tradeshift-scripts') {
		return require.resolve('./').replace(process.cwd(), '.');
	}
	return resolveBin('tradeshift-scripts');
}

// eslint-disable-next-line complexity
function resolveBin(modName, { executable = modName, cwd = process.cwd() } = {}) {
	let pathFromWhich;
	try {
		pathFromWhich = fs.realpathSync(which.sync(executable));
	} catch (_error) {
		// ignore _error
	}
	try {
		const modPkgPath = require.resolve(`${modName}/package.json`);
		const modPkgDir = path.dirname(modPkgPath);
		const { bin } = require(modPkgPath);
		const binPath = typeof bin === 'string' ? bin : bin[executable];
		const fullPathToBin = path.join(modPkgDir, binPath);
		if (fullPathToBin === pathFromWhich) {
			return executable;
		}
		return fullPathToBin.replace(cwd, '.');
	} catch (error) {
		if (pathFromWhich) {
			return executable;
		}
		throw error;
	}
}

const fromRoot = (...p) => path.join(appDirectory, ...p);
const hasFile = (...p) => fs.existsSync(fromRoot(...p));
const ifFile = (files, t, f) => (arrify(files).some(file => hasFile(file)) ? t : f);

const hasPkgProp = props => arrify(props).some(prop => has(pkg, prop));

const hasPkgSubProp = pkgProp => props => hasPkgProp(arrify(props).map(p => `${pkgProp}.${p}`));

const ifPkgSubProp = pkgProp => (props, t, f) => (hasPkgSubProp(pkgProp)(props) ? t : f);

const hasScript = hasPkgSubProp('scripts');
const hasPeerDep = hasPkgSubProp('peerDependencies');
const hasDep = hasPkgSubProp('dependencies');
const hasDevDep = hasPkgSubProp('devDependencies');
const hasAnyDep = (...args) => [hasDep, hasDevDep, hasPeerDep].some(fn => fn(...args));

const ifPeerDep = ifPkgSubProp('peerDependencies');
const ifDep = ifPkgSubProp('dependencies');
const ifDevDep = ifPkgSubProp('devDependencies');
const ifAnyDep = (deps, t, f) => (hasAnyDep(deps) ? t : f);
const ifScript = ifPkgSubProp('scripts');

function parseEnv(name, def) {
	if (
		Object.prototype.hasOwnProperty.call(process.env, name) &&
		process.env[name] &&
		process.env[name] !== 'undefined'
	) {
		return JSON.parse(process.env[name]);
	}
	return def;
}

function getConcurrentlyArgs(scripts, { killOthers = true } = {}) {
	const colors = [
		'bgBlue',
		'bgGreen',
		'bgMagenta',
		'bgCyan',
		'bgWhite',
		'bgRed',
		'bgBlack',
		'bgYellow'
	];
	scripts = Object.entries(scripts).reduce((all, [name, script]) => {
		if (script) {
			all[name] = script;
		}
		return all;
	}, {});
	const prefixColors = Object.keys(scripts)
		.reduce((pColors, _s, i) => pColors.concat([`${colors[i % colors.length]}.bold.reset`]), [])
		.join(',');

	// prettier-ignore
	return [
    killOthers ? '--kill-others-on-fail' : null,
    '--prefix', '[{name}]',
    '--names', Object.keys(scripts).join(','),
    '--prefix-colors', prefixColors,
    ...Object.values(scripts).map(s => JSON.stringify(s)), // stringify escapes quotes ✨
  ].filter(Boolean)
}

module.exports = {
	ifDevDep,
	ifPeerDep,
	ifScript,
	ifDep,
	ifAnyDep,
	hasPkgProp,
	appDirectory,
	fromRoot,
	hasScript,
	resolveBin,
	resolveKcdScripts,
	parseEnv,
	pkg,
	hasFile,
	ifFile,
	getConcurrentlyArgs
};
