import { Names } from "../../../utils/Names";
import { PiLanguageUnit } from "../../metalanguage/PiLanguage";

export class WorkerInterfaceTemplate {
    constructor() {
    }

    generateWorkerInterface(language: PiLanguageUnit): string {
        
        // the template starts here
        return `
        import { ${this.createImports(language, )} } from "../../language"; 

        export interface ${Names.workerInterface(language)} {

        ${language.classes.map(concept => 
            `execBefore${concept.name}(modelelement: ${concept.name});
            execAfter${concept.name}(modelelement: ${concept.name});`
        ).join("\n\n") }

        ${language.enumerations.map(concept => 
            `execBefore${concept.name}(modelelement: ${concept.name});
            execAfter${concept.name}(modelelement: ${concept.name});`
        ).join("\n\n") }
        
        }`;
    }

    private createImports(language: PiLanguageUnit) : string {
        // sort all names alphabetically
        let tmp : string[] = [];
        language.classes.map(c => 
            tmp.push(Names.concept(c))
        );
        language.enumerations.map(c =>
            tmp.push(Names.enumeration(c))
        );
        language.unions.map(c =>
            tmp.push(Names.type(c))
        );
        tmp = tmp.sort();
    
        // the template starts here
        return `
            ${tmp.map(c => 
                `${c}`
            ).join(", ")}`;
    }
}
