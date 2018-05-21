import { CommandScope, Option } from '../models/command';
import { ArchitectCommand } from '../models/architect-command';
export interface Options {
    project?: string;
    configuration?: string;
}
export default class Xi18nCommand extends ArchitectCommand {
    readonly name: string;
    readonly target: string;
    readonly description: string;
    readonly scope: CommandScope;
    readonly multiTarget: true;
    readonly options: Option[];
    run(options: Options): Promise<number>;
}
