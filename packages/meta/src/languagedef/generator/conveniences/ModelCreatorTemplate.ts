import { Names } from "../../../utils/Names";
import { PiLanguageUnit, PiLangClass } from "../../metalanguage/PiLanguage";

export class ModelCreatorTemplate {
    constructor() {
    }

    generateModelCreator(language: PiLanguageUnit): string {
        // TODO use Names for class name
        
        // the template starts here
        return `
        import { ${this.createImports(language, )} } from "../../language"; 

        export class ${language.name}Creator {

        ${language.classes.map(concept => 
            `${concept.isAbstract? `` : 
            `public create${concept.name}(${this.makeParams(concept)}) : ${concept.name} {
                let _result = new ${concept.name}();
                ${concept.allPrimProperties().map(prop => 
                `_result.${prop.name} = ${prop.name}`
                ).join(";")}
                ${concept.allEnumProperties().map(prop => 
                    `_result.${prop.name} = ${prop.name}`
                    ).join(";")}    
                ${concept.allParts().map(prop => 
                `${prop.isList? `if(${prop.name} !== null) _result.${prop.name}.push(${prop.name});` 
                    : 
                    `_result.${prop.name} = ${prop.name};`}`
                ).join("\n")}
                ${concept.allPReferences().map(prop => 
                `${prop.isList? `if(${prop.name} !== null) _result.${prop.name}.push(${prop.name});` 
                    : 
                    `_result.${prop.name} = ${prop.name};`}`
                ).join("\n")}
                return _result;
            }`
        }`).join("\n") }
        }`;
    }

    private makeParams(concept: PiLangClass) : string {
        return `${concept.allProperties().map(prop => 
            `${prop.name}: ${prop.type.name}`).join(", ")}`;
            // return `${concept.allPrimProperties().map(prop => 
            //     `${prop.name}: ${prop.primType}`).concat(
            //         `${concept.allEnumProperties().map(prop => 
            //             `${prop.name}: ${prop.type.name}`)}`
            //     ).join(", ")}`;
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
