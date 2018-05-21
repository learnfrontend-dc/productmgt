import { ArchitectCommand } from '../models/architect-command';
import { Option, CommandScope } from '../models/command';
export interface Options {
    project?: string;
    configuration?: string;
    prod: boolean;
}
export default class BuildCommand extends ArchitectCommand {
    readonly name: string;
    readonly target: string;
    readonly description: string;
    static aliases: string[];
    scope: CommandScope;
    options: Option[];
    validate(options: Options): boolean;
    run(options: Options): Promise<number>;
}
