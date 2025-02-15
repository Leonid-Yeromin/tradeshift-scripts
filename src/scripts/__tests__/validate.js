import cases from 'jest-in-case';

// this removes the quotes around strings...
expect.addSnapshotSerializer({
	print: val => val,
	test: val => typeof val === 'string'
});

cases(
	'validate',
	({ setup = () => () => {} }) => {
		// beforeEach
		const { sync: crossSpawnSyncMock } = require('cross-spawn');
		const originalExit = process.exit;
		process.exit = jest.fn();
		process.env.SCRIPTS_PRECOMMIT = 'false';
		const teardown = setup();

		try {
			// tests
			crossSpawnSyncMock.mockClear();
			require('../validate');
			expect(crossSpawnSyncMock).toHaveBeenCalledTimes(1);
			const [firstCall] = crossSpawnSyncMock.mock.calls;
			const [script, calledArgs] = firstCall;
			expect([script, ...calledArgs].join(' ')).toMatchSnapshot();
		} finally {
			teardown();
		}

		// afterEach
		process.exit = originalExit;
		jest.resetModules();
	},
	{
		'calls concurrently with all scripts': {
			setup: withDefaultSetup(setupWithScripts())
		},
		'does not include "lint" if it doesn\'t have that script': {
			setup: withDefaultSetup(setupWithScripts(['test', 'build', 'flow']))
		},
		'does not include "test" if it doesn\'t have that script': {
			setup: withDefaultSetup(setupWithScripts(['lint', 'build', 'flow']))
		},
		'does not include "build" if it doesn\'t have that script': {
			setup: withDefaultSetup(setupWithScripts(['test', 'lint', 'flow']))
		},
		'does not include "flow" if it doesn\'t have that script': {
			setup: withDefaultSetup(setupWithScripts(['test', 'build', 'lint']))
		},
		'allows you to specify your own npm scripts': {
			setup: setupWithArgs(['specialbuild,specialtest,speciallint'])
		},
		"doesn't use test or lint if it's in precommit": {
			setup: withDefaultSetup(() => {
				const previousVal = process.env.SCRIPTS_PRECOMMIT;
				process.env.SCRIPTS_PRECOMMIT = 'true';
				return function teardown() {
					process.env.SCRIPTS_PRECOMMIT = previousVal;
				};
			})
		}
	}
);

function setupWithScripts(scripts = ['test', 'lint', 'build', 'flow']) {
	return function setup() {
		const utils = require('../../utils');
		const originalIfScript = utils.ifScript;
		utils.ifScript = (script, t, f) => (scripts.includes(script) ? t : f);
		return function teardown() {
			utils.ifScript = originalIfScript;
		};
	};
}

function setupWithArgs(args = []) {
	return function setup() {
		const originalArgv = process.argv;
		process.argv = ['node', '../format', ...args];
		return function teardown() {
			process.argv = originalArgv;
		};
	};
}

function withDefaultSetup(setupFn) {
	return function defaultSetup() {
		const utils = require('../../utils');
		utils.resolveBin = (modName, { executable = modName } = {}) => executable;
		const argsTeardown = setupWithArgs()();
		const teardownScripts = setupWithScripts()();
		const teardownFn = setupFn();
		return function defaultTeardown() {
			argsTeardown();
			teardownFn();
			teardownScripts();
		};
	};
}
