/**
 * Settings for {@link ButtonAction}.
 */
export type ButtonSettings = {
    pressed: boolean;
    json: string;
    index: string;
    title?: string;
    imageUrl?: string;
    imageUrlPressed?: string;
    scripts: string[];
    scriptCmds?: string[];
    osc_commands: OscCommand[];
    delays: number[];

};

export type OscCommand = {
    osc_path: string;
    osc_value: (string | number)[];
    osc_port: number;
}