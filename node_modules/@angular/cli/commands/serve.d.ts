import { CommandScope, Option } from '../models/command';
import { ArchitectCommand } from '../models/architect-command';
export interface Options {
    project?: string;
    configuration?: string;
    prod: boolean;
}
export default class ServeCommand extends ArchitectCommand {
    readonly name: string;
    readonly target: string;
    readonly description: string;
    static aliases: string[];
    readonly scope: CommandScope;
    readonly options: Option[];
    validate(_options: Options): boolean;
    run(options: Options): Promise<number>;
}
