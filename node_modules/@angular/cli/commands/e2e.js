"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const command_1 = require("../models/command");
const architect_command_1 = require("../models/architect-command");
class E2eCommand extends architect_command_1.ArchitectCommand {
    constructor() {
        super(...arguments);
        this.name = 'e2e';
        this.target = 'e2e';
        this.description = 'Run e2e tests in existing project.';
        this.scope = command_1.CommandScope.inProject;
        this.multiTarget = true;
        this.options = [
            this.prodOption,
            this.configurationOption
        ];
    }
    run(options) {
        let configuration = options.configuration;
        if (!configuration && options.prod) {
            configuration = 'production';
        }
        const overrides = Object.assign({}, options);
        delete overrides.project;
        delete overrides.prod;
        return this.runArchitectTarget({
            project: options.project,
            target: this.target,
            configuration,
            overrides
        }, options);
    }
}
E2eCommand.aliases = ['e'];
exports.default = E2eCommand;
//# sourceMappingURL=/Users/hansl/Sources/hansl/angular-cli/commands/e2e.js.map