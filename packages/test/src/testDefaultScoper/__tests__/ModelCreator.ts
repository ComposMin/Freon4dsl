import { DSmodel, DSpart, DSprivate, DSref, DSunit } from "../language/gen";
import { GenericModelSerializer } from "@projectit/core";

export class ModelCreator {
    nameNumber: number = 0;
    allNames: string[] = [];
    serial: GenericModelSerializer = new GenericModelSerializer();

    createName(parent: string, type: string): string {
        this.nameNumber += 1;
        // console.log("createName called: " + type + this.nameNumber + "_OF_" + parent);
        this.allNames.push(type + this.nameNumber + "_OF_" + parent);
        return type + this.nameNumber + "_OF_" + parent;
    }

    /**
     * creates a model with 'nrOfunits' units, where all child nodes are a tree of depth 'depth'
     * without taking into account modelunit interfaces
     * @param nrOfUnits     must be larger than 0
     * @param depth         must be larger than 0
     */
    public createModel(nrOfUnits: number, depth: number): DSmodel {
        let modelUnits: DSunit[] = [];
        for (let i = 0; i < nrOfUnits; i++) {
            modelUnits.push(this.createUnit("model", depth));
        }
        return DSmodel.create({name: "modelOfDepth" + depth, units: modelUnits});
    }

    /**
     * creates a model with 'nrOfunits' units, where all child nodes are a tree of depth 'depth'
     * without taking into account modelunit interfaces
     * @param nrOfUnits     must be larger than 0
     * @param depth         must be larger than 0
     * @param primary       the index of the unit that has the focus, all other units are represented by their interfaces
     *                      note that the following must be true: primary < nrOfUnits
     */
    public createModelWithInterfaces(nrOfUnits: number, depth: number, primary: number): DSmodel {
        if (primary >= nrOfUnits) return null;
        let modelUnits: DSunit[] = [];
        for (let i = 0; i < nrOfUnits; i++) {
            let completeUnit = this.createUnit("model", depth);
            if (i === primary) {
                modelUnits.push(completeUnit);
            } else {
                let serialized = this.serial.convertToJSON(completeUnit, true);
                let unitInterface = this.serial.toTypeScriptInstance(serialized);
                modelUnits.push(unitInterface);
            }
        }
        return DSmodel.create({name: "modelOfDepth" + depth, units: modelUnits});
    }

    createUnit(parent: string, depth: number): DSunit {
        const unitName = this.createName(parent, "unit");
        let dsParts: DSpart[] = [];
        for (let i = 0; i < 2; i++) {
            dsParts.push(this.createPart(unitName, depth));
        }
        let dsPrivates: DSprivate[] = [];
        for (let i = 0; i < 2; i++) {
            dsPrivates.push(this.createPrivate(unitName, depth));
        }
        // TODO include references
        return DSunit.create({name: unitName, dsParts: dsParts, dsPrivates: dsPrivates});
    }

    createPart(parent: string, depth: number): DSpart {
        const partName = this.createName(parent, "part");
        let dsParts: DSpart[] = [];
        let dsPrivates: DSprivate[] = [];
        if (depth > 0) {
            for (let i = 0; i < 2; i++) {
                dsParts.push(this.createPart(partName, depth - 1));
            }
            for (let i = 0; i < 2; i++) {
                dsPrivates.push(this.createPrivate(partName, depth - 1));
            }
        }
        return DSpart.create({name: partName, conceptParts: dsParts, conceptPrivates: dsPrivates});
    }

    createRef(parent: string, depth: number): DSref {
        return DSref.create({name: this.createName(parent, "ref")});
    }

    createPrivate(parent: string, depth: number): DSprivate {
        const privateName = this.createName(parent, "private");
        let dsParts: DSpart[] = [];
        let dsPrivates: DSprivate[] = [];
        if (depth > 0) {
            for (let i = 0; i < 2; i++) {
                dsParts.push(this.createPart(privateName, depth - 1));
            }
            for (let i = 0; i < 2; i++) {
                dsPrivates.push(this.createPrivate(privateName, depth - 1));
            }
        }
        return DSprivate.create({name: privateName, conceptParts: dsParts, conceptPrivates: dsPrivates});
    }
}
