import { ReferenceShortcut } from "../editor/index";
import { PiElement } from "../language/PiElement";
import { isNullOrUndefined, PiLogger } from "../util";
// TODO move this file to ../language
const LOGGER = new PiLogger("Language");

// TODO see if other types need to be added
export type PropertyType = "primitive" | "part" | "reference";

export type Property = {
    name: string;
    type: string;
    isList: boolean;
    isPublic: boolean;
    propertyType: PropertyType;
};
export type Model = {
    typeName: string;
    properties: Map<string, Property>;
    constructor: () => PiElement;
};
export type ModelUnit = {
    typeName: string;
    fileExtension: string;
    properties: Map<string, Property>;
    constructor: () => PiElement;
};
export type Concept = {
    isAbstract: boolean;
    isPublic: boolean;
    typeName: string;
    baseName: string;
    subConceptNames: string[];
    trigger: string;
    referenceShortcut?: ReferenceShortcut;
    properties: Map<string, Property>;
    constructor: () => PiElement;
};

export type Interface = {
    isPublic: boolean;
    typeName: string;
    subConceptNames: string[];
    properties: Map<string, Property>;
};

export class Language {
    private static theInstance: Language = null;

    static getInstance() {
        if (Language.theInstance === null) {
            Language.theInstance = new Language();
        }
        return Language.theInstance;
    }

    private models: Map<string, Model> = new Map<string, Model>();
    private units: Map<string, ModelUnit> = new Map<string, ModelUnit>();
    private concepts: Map<string, Concept> = new Map<string, Concept>();
    private interfaces: Map<string, Interface> = new Map<string, Interface>();

    private constructor() {
    }

    model(typeName: string): Model {
        return this.models.get(typeName);
    }

    unit(typeName: string): ModelUnit {
        return this.units.get(typeName);
    }

    concept(typeName: string): Concept {
        // console.log("Language find concept " + typeName + " ==> " + this.concepts.get(typeName));
        return this.concepts.get(typeName);
    }

    interface(typeName: string): Interface {
        return this.interfaces.get(typeName);
    }

    classifier(typeName: string): ModelUnit | Concept | Interface {
        let concept1 = this.concepts.get(typeName);
        if (!!concept1) {
            return concept1;
        } else {
            let intf = this.interfaces.get(typeName);
            if (!!intf) {
                return intf;
            } else {
                let unit1 = this.units.get(typeName);
                if (!!unit1) {
                    return unit1;
                }
            }
        }
        return null;
    }

    conceptProperty(typeName: string, propertyName: string): Property {
        // LOGGER.log("copnceptProperty [" + typeName + "."  + propertyName + "]");
        return this.concepts.get(typeName).properties.get(propertyName);
    }

    unitProperty(typeName: string, propertyName: string): Property {
        return this.units.get(typeName).properties.get(propertyName);
    }

    interfaceProperty(typeName: string, propertyName: string): Property {
        return this.interfaces.get(typeName).properties.get(propertyName);
    }

    classifierProperty(typeName: string, propertyName: string): Property {
        LOGGER.log("CLASSIFIERPROPRTY " + typeName + "." + propertyName);
        let concept1 = this.concepts.get(typeName);
        if (!!concept1) {
            return concept1.properties.get(propertyName);
        } else {
            let intf = this.interfaces.get(typeName);
            if (!!intf) {
                return intf.properties.get(propertyName);
            } else {
                let unit1 = this.units.get(typeName);
                if (!!unit1) {
                    return unit1.properties.get(propertyName);
                }
            }
        }
        return null;
    }

    allConceptProperties(typeName: string): IterableIterator<Property> {
        // console.log("Looking up properties for "+ typeName);
        let myType: Concept | ModelUnit = this.concept(typeName);
        if (isNullOrUndefined(myType)) {
            myType = this.unit(typeName);
        }
        return myType?.properties.values();
    }

    createModel(typeName: string): PiElement {
        return this.models.get(typeName).constructor();
    }

    createUnit(typeName: string): PiElement {
        return this.units.get(typeName).constructor();
    }

    /**
     * Create a new instance of the class `typeName`.
     * @param typeName
     */
    createConceptOrUnit(typeName: string): PiElement {
        let myType: Concept | ModelUnit = this.concept(typeName);
        if (isNullOrUndefined(myType)) {
            myType = this.unit(typeName);
        }
        return myType?.constructor();
    }


    addModel(model: Model) {
        this.models.set(model.typeName, model);
    }

    addUnit(unit: ModelUnit) {
        this.units.set(unit.typeName, unit);
    }

    /**
     * Add a concept definition to this language
     * @param concept
     */
    addConcept(concept: Concept) {
        this.concepts.set(concept.typeName, concept);
    }

    addInterface(intface: Interface) {
        this.interfaces.set(intface.typeName, intface);
    }

    subConcepts(typeName: string): string[] {
        const concept = this.concept(typeName);
        if (!!concept) {
            return concept.subConceptNames;
        }
        const intface = this.interface(typeName);
        if (!!intface) {
            return intface.subConceptNames;
        }
        return [];
    }

    referenceCreator: (name: string, type: string) => any;

    addReferenceCreator(creator: (name: string, type: string) => any) {
        this.referenceCreator = creator;
    }
}
