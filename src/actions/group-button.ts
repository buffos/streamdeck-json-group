import streamDeck, { action, DialAction, KeyAction, KeyDownEvent, KeyUpEvent, PropertyInspectorDidDisappearEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import * as fs from 'fs/promises';
import * as path from 'path';
import { setTimeout } from "timers/promises";
import { createOSCCommands, runSequenceOfCommands } from "./execute-ps-script";
import { ButtonSettings } from "./type";


/**
 * An example action class that displays a count that increments by one each time the button is pressed.
 */
@action({ UUID: "com.oraiopoulos.json-group.execute" })
export class ButtonAction extends SingletonAction<ButtonSettings> {
	private readonly keyPresses: Map<string, number> = new Map();

	constructor() {
		super();
	}

	private fastButtonUpdate(action: KeyAction<ButtonSettings> | DialAction<ButtonSettings>, settings: ButtonSettings) {
		if (settings.pressed) {
			action.setTitle(settings.title + " *");
			action.setImage(settings.imageUrlPressed);
		} else {
			action.setTitle(settings.title ?? `button ${settings.index + 1}`);
			action.setImage(settings.imageUrl);
		}
	}

	/**
	 * The {@link SingletonAction.onWillAppear} event is useful for setting the visual representation of an action when it becomes visible. This could be due to the Stream Deck first
	 * starting up, or the user navigating between pages / folders etc.. There is also an inverse of this event in the form of {@link streamDeck.client.onWillDisappear}. In this example,
	 * we're setting the title to the "count" that is incremented in {@link IncrementCounter.onKeyDown}.
	 */
	override async onWillAppear(ev: WillAppearEvent<ButtonSettings>): Promise<void> {
		const settings = await ev.action.getSettings();
		if (settings.imageUrl !== "") { // we have calculated the image string
			this.fastButtonUpdate(ev.action, settings);
			return;
		}

		this.updateButtonDetails(ev.action);
	}



	/**
	 * When the user changes the settings for an action, the {@link SingletonAction.onDidReceiveSettings} event is emitted.
	 * @param ev
	 * @returns 
	 */
	override async onPropertyInspectorDidDisappear(ev: PropertyInspectorDidDisappearEvent<ButtonSettings>): Promise<void> {// get the current settings
		return this.updateButtonDetails(ev.action);
	}


	/**
	  * A generator which narrows down all visible actions to only ones that are present on a specific Stream Deck device
	  * @param deviceId 
	*/
	* deviceItems(deviceId: string): IterableIterator<KeyAction<ButtonSettings>> {
		for (const action of this.actions) {
			if (action.device.id === deviceId && action.isKey() && action.coordinates !== undefined) {
				yield action;
			}
		}
	}


	/**
	 * An async generator which narrows down all visible actions to only ones that are present on a specific Stream Deck device
	 * and have the same json file as the source of truth.
	 * @param deviceId 
	 * @param jsonFile 
	 */
	async * sameGroupItems(deviceId: string, jsonFile: string): AsyncIterableIterator<KeyAction<ButtonSettings>> {
		for (const action of this.actions) {
			if (action.device.id === deviceId && action.isKey() && action.coordinates !== undefined) {
				const settings = await action.getSettings();
				if (settings.json === jsonFile) {
					yield action;
				}
			}
		}
	}

	/**
	 * Creates the file path from the json file, excluding the file name
	 * @param jsonFile 
	 * @returns 
	 */
	private getFilePath(jsonFile: string): string {
		// return everything except the file name
		const path = jsonFile.split("/");
		path.pop();
		return path.join("/");
	}

	/**
	 * Creates a data url from an image file
	 * @param imageRelativePath 
	 * @param jsonFilePath 
	 * @returns 
	 */
	private async createImageString(imageRelativePath: string, jsonFilePath: string): Promise<string> {
		if (imageRelativePath === "") return "";
		const filePath = this.getFilePath(jsonFilePath);
		// create the absolute image path from the image relative path and the image file name
		const imagePath = path.resolve(filePath, imageRelativePath);
		try {
			await fs.access(imagePath);
			const data = await fs.readFile(imagePath);
			// return the image as a data url
			return `data:image/png;base64,${data.toString("base64")}`;
		} catch (error) {
			streamDeck.logger.error(error);
			return "";
		}
	}

	/**
	 * For all buttons in the same device, update their details
	 * @see {@link ButtonAction.onWillAppear}
	 * @param ev 
	 */
	async UpdateAllButtonDetails(ev: any) {
		for (const action of this.deviceItems(ev.action.device.id)) {
			await this.updateButtonDetails(action);
			await setTimeout(200);
		}
	}

	/**
	 * This function sets all the buttons controlled by the same json file to the default image
	 * So if one of them was pressed, it will be turned off.
	 * Next step is to set the image to the light image (the pressed button's image)
	 * @param ev 
	 * @returns 
	 */
	async UpdateAllGroupButtonToNotPressed(ev: any) {
		let counter = 0;
		for await (const action of this.sameGroupItems(ev.action.device.id, ev.payload.settings.json)) {
			if (!action) return;
			const settings = await action?.getSettings();
			if (!settings) return;
			settings.pressed = false;
			counter++;
			await action.setSettings(settings);
			this.fastButtonUpdate(action, settings);
		}
	}

	/**
	 * This functions is called when the data for the button change or when it is first loaded
	 * We need to calculate the image string's and after that we just use them.
	 * @see {@link ButtonAction.onWillAppear}
	 * @param action 
	 * @returns 
	 */
	private async updateButtonDetails(action: KeyAction<ButtonSettings> | DialAction<ButtonSettings>) {
		if (!action) return;
		const settings = await action?.getSettings();
		if (!settings) return;
		const file = settings.json ?? "";
		const index = +settings.index;
		let json: any;
		// check if the file exists
		try {
			await fs.access(file);
			// read the file
			const data = await fs.readFile(file, "utf8");
			// parse the json
			json = JSON.parse(data).files;
			// set the title to the count
			const title = json[index]?.title ?? `button ${index + 1}`;
			const imageString = await this.createImageString(json[index]?.image ?? "", file);
			const script = json[index]?.script ?? [];
			const scriptCmd = json[index]?.scriptCmd ?? [];
			const imageStringPressed = await this.createImageString(json[index]?.image_pressed ?? "", file);
			const oscCommands = json[index]?.osc_commands ?? [];
			const delays = json[index]?.delays ?? [];
			enforceLengthConformity(script, delays, 500);
			enforceLengthConformity(scriptCmd, delays, 500);
			enforceLengthConformity(oscCommands, delays, 500);
			settings.title = title;
			settings.imageUrl = imageString;
			settings.scripts = script;
			settings.scriptCmds = scriptCmd;
			settings.imageUrlPressed = imageStringPressed;
			settings.osc_commands = oscCommands;
			settings.delays = delays;
			action.setSettings(settings);
			this.fastButtonUpdate(action, settings);
			if (action.isKey()) {
				action.showOk();
			}
		} catch (error) {
			// if the file doesn't exist, set the title to "0"
			action.setTitle(`button ${index}`);
			action.setImage("");
			settings.title = `button ${index + 1}`;
			settings.imageUrl = "";
			settings.scripts = [];
			settings.scriptCmds = [];
			settings.imageUrlPressed = "";
			settings.osc_commands = [];
			settings.delays = [];
			action.setSettings(settings);
		}
	}

	override async onKeyDown(ev: KeyDownEvent<ButtonSettings>): Promise<void> {
		const settings = await ev.action.getSettings();
		if (settings.json === "" || settings.index === "") return;
		const buttonCode = `${settings.json}-${settings.index}`;
		this.keyPresses.set(buttonCode, Date.now()); // time when the button was pressed
	}

	/**
	 * Listens for the {@link SingletonAction.onKeyDown} event which is emitted by Stream Deck when an action is pressed. Stream Deck provides various events for tracking interaction
	 * with devices including key down/up, dial rotations, and device connectivity, etc. When triggered, {@link ev} object contains information about the event including any payloads
	 * and action information where applicable. In this example, our action will display a counter that increments by one each press. We track the current count on the action's persisted
	 * settings using `setSettings` and `getSettings`.
	 */
	override async onKeyUp(ev: KeyUpEvent<ButtonSettings>): Promise<void> {
		await this.UpdateAllGroupButtonToNotPressed(ev); // set all buttons to not pressed
		const { settings } = ev.payload;
		settings.pressed = true;
		await ev.action.setSettings(settings);
		if (settings.json === "" || settings.index === "") return;
		const previousTimeStamp = this.keyPresses.get(`${settings.json}-${settings.index}`) ?? 0;
		this.keyPresses.delete(`${settings.json}-${settings.index}`); // we do not need this anymore
		if (Date.now() - previousTimeStamp > 2 * 1000) { // second passed - triggering refresh
			await this.UpdateAllButtonDetails(ev);
			return;
		}
		// normal button press
		this.fastButtonUpdate(ev.action, settings);
		if (settings.osc_commands.length > 0) {
			const commands = createOSCCommands(settings.osc_commands);
			await runSequenceOfCommands(commands, settings.delays);
		}
	}
}




// ev.payload.settings is the setting from the property inspector

// if we provide 5 scripts, we need 4 delays for gaps between them
function checkLengthConformity(scriptArray: any[], delaysArray: any[]): boolean {
	if (scriptArray.length > 1 && scriptArray.length !== delaysArray.length + 1) return false;
	return true;
}

function enforceLengthConformity(scriptArray: any[], delaysArray: any[], defaultDelay: number): void {
	if (!checkLengthConformity(scriptArray, delaysArray)) {
		const itemsToAdd = scriptArray.length - 1 - delaysArray.length;
		for (let i = 0; i < itemsToAdd; i++) {
			delaysArray.push(defaultDelay);
		}
	}
}