import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { ButtonAction } from "./group-button";

@action({ UUID: "com.oraiopoulos.json-group.refresh" })
export class RefreshAction extends SingletonAction {
    actionButton: ButtonAction;

    constructor(btn: ButtonAction) {
        super();
        this.actionButton = btn;
    }

    override async onKeyDown(ev: KeyDownEvent) {
        ev.action.showOk();
        this.actionButton.UpdateAllButtonDetails(ev);
    }
}