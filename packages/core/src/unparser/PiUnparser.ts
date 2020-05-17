import { PiElement } from "../language";

// Part of the ProjectIt Framework.
// tag::unparser-interface[]
export interface PiUnparser {
    // returns the type of 'modelelement' according to the type rules in the Typer Definition
    unparse(modelelement: PiElement): string;
}
// end::unparser-interface[]
