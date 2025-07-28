import meowHelp from 'cli-meow-help';
import meow from 'meow';

const flags = {
	clear: {
		type: `boolean`,
		default: false,
		shortFlag: `c`,
		desc: `Clear the console`
	},
	debug: {
		type: `boolean`,
		default: false,
		shortFlag: `d`,
		desc: `Print debug info`
	},
	port: {
		type: `number`,
		default: 3000,
		desc: `Port to bind the server`
	},
	host: {
		type: `string`,
		default: '0.0.0.0',
		desc: `Host address to bind`
	}
};

const commands = {
	help: { desc: `Print help info` }
};

const helpText = meowHelp({
	name: `livepdf-server`,
	flags,
	commands
});

const options = {
	importMeta: import.meta,
	inferType: true,
	description: false,
	hardRejection: false,
	flags
};

export default meow(helpText, options);
