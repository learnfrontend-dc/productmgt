"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const architect_command_1 = require("../models/architect-command");
const command_1 = require("../models/command");
const version_1 = require("../upgrade/version");
class BuildCommand extends architect_command_1.ArchitectCommand {
    constructor() {
        super(...arguments);
        this.name = 'build';
        this.target = 'build';
        this.description = 'Builds your app and places it into the output path (dist/ by default).';
        this.scope = command_1.CommandScope.inProject;
        this.options = [
            this.prodOption,
            this.configurationOption
        ];
    }
    validate(options) {
        // Check Angular and TypeScript versions.
        version_1.Version.assertCompatibleAngularVersion(this.project.root);
        version_1.Version.assertTypescriptVersion(this.project.root);
        return super.validate(options);
    }
    run(options) {
        return __awaiter(this, void 0, void 0, function* () {
            let configuration = options.configuration;
            if (!configuration && options.prod) {
                configuration = 'production';
            }
            const overrides = Object.assign({}, options);
            delete overrides.project;
            delete overrides.configuration;
            delete overrides.prod;
            return this.runArchitectTarget({
                project: options.project,
                target: this.target,
                configuration,
                overrides
            }, options);
        });
    }
}
BuildCommand.aliases = ['b'];
exports.default = BuildCommand;
//# sourceMappingURL=/Users/hansl/Sources/hansl/angular-cli/commands/build.js.map