import streamDeck from "@elgato/streamdeck";
import { spawn } from "child_process";
import { OscCommand } from "./type";


export async function executePowershellScript(scriptPath: string, args: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const pwsh = spawn('pwsh', [scriptPath, ...args]);

        let stdout = '';
        let stderr = '';

        pwsh.stdout.on('data', (data) => {
            stdout += data;
        });

        pwsh.stderr.on('data', (data) => {
            stderr += data;
        });

        pwsh.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`PowerShell script exited with code ${code}: ${stderr}`));
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

export async function executePowershellScriptFromString(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const pwsh = spawn('pwsh', ['-Command', script]);

        let stdout = '';
        let stderr = '';

        pwsh.stdout.on('data', (data) => {
            stdout += data;
        });

        pwsh.stderr.on('data', (data) => {
            stderr += data;
        });

        pwsh.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`PowerShell script exited with code ${code}: ${stderr}`));
            } else {
                resolve(stdout.trim());
            }
        });
    });
}


export function createOSCCommand(oscAddress: string, oscValues: (string | number)[], oscPort: number) {
    return `
Import-Module SendOscModule
Send-OscMessage -IPAddress "127.0.0.1" -Port 8000 -AddressPattern ${oscAddress} -Arguments @(${oscValues.join(",")})
`;
}

export function createOSCCommands(command: OscCommand[]): string[] {
    const commands = [];
    for (const cmd of command) {
        commands.push(createOSCCommand(cmd.osc_path, cmd.osc_value, cmd.osc_port));
    }
    return commands;
}


export function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runSequenceOfCommands(commands: string[], delays: number[]) {
    for (let i = 0; i < commands.length; i++) {
        try {
            await executePowershellScriptFromString(commands[i]);
            if (i > 0) {
                await delay(delays[i - 1]);
            }
        } catch (error) {
            streamDeck.logger.error(error);
        }
    }
}