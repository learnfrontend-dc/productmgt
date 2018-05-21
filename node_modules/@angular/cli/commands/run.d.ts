import { CommandScope, Option } from '../models/command';
import { ArchitectCommand } from '../models/architect-command';
export interface RunOptions {
    target: string;
}
export default class RunCommand extends ArchitectCommand {
    readonly name: string;
    readonly description: string;
    readonly scope: CommandScope;
    readonly arguments: string[];
    readonly options: Option[];
    run(options: RunOptions): Promise<number>;
}
