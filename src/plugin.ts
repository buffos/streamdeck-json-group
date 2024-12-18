import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { ButtonAction } from "./actions/group-button";
import { RefreshAction } from "./actions/group-refresh";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel(LogLevel.INFO);

const btn = new ButtonAction();

// Register the increment action.
streamDeck.actions.registerAction(btn);
streamDeck.actions.registerAction(new RefreshAction(btn));

// Finally, connect to the Stream Deck.
streamDeck.connect();
