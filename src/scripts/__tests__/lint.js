import cases from 'jest-in-case';

jest.mock('jest', () => ({ run: jest.fn() }));
jest.mock('../../config/jest.config', () => ({ builtInConfig: true }));

// this removes the quotes around strings...
expect.addSnapshotSerializer({
	print: val => val,
	test: val => typeof val === 'string'
});

cases(
	'format',
	({
		args = [],
		utils = require('../../utils'),
		hasPkgProp = () => false,
		hasFile = () => false,
		setup = () => () => {}
	}) => {
		// beforeEach
		const { sync: crossSpawnSyncMock } = require('cross-spawn');
		const originalArgv = process.argv;
		const originalExit = process.exit;
		Object.assign(utils, {
			hasPkgProp,
			hasFile,
			resolveBin: (modName, { executable = modName } = {}) => executable
		});
		process.exit = jest.fn();
		const teardown = setup();

		process.argv = ['node', '../lint', ...args];
		crossSpawnSyncMock.mockClear();

		try {
			// tests
			require('../lint');
			expect(crossSpawnSyncMock).toHaveBeenCalledTimes(1);
			const [firstCall] = crossSpawnSyncMock.mock.calls;
			const [script, calledArgs] = firstCall;
			expect([script, ...calledArgs].join(' ')).toMatchSnapshot();
		} finally {
			teardown();
			// afterEach
			process.exit = originalExit;
			process.argv = originalArgv;
			jest.resetModules();
		}
	},
	{
		'calls eslint CLI with default args': {},
		'does not use built-in config with --config': {
			args: ['--config', './custom-config.js']
		},
		'does not use built-in config with .eslintrc file': {
			hasFile: filename => filename === '.eslintrc'
		},
		'does not use built-in config with .eslintrc.js file': {
			hasFile: filename => filename === '.eslintrc.js'
		},
		'does not use built-in config with eslintConfig pkg prop': {
			hasPkgProp: prop => prop === 'eslintConfig'
		},
		'does not use built-in ignore with --ignore-path': {
			args: ['--ignore-path', './my-ignore']
		},
		'does not use built-in ignore with .eslintignore file': {
			hasFile: filename => filename === '.eslintignore'
		},
		'does not use built-in ignore with eslintIgnore pkg prop': {
			hasPkgProp: prop => prop === 'eslintIgnore'
		},
		'--no-cache will disable caching': {
			args: ['--no-cache']
		},
		'runs on given files, but only js files': {
			args: ['./src/index.js', './package.json', './src/index.css', './src/component.js']
		}
	}
);
