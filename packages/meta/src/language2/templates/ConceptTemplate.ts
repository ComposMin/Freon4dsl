import { PiLangConcept, PiLanguage, PiLangElementProperty, PiLangPrimitiveProperty } from "../PiLanguage";

export class ConceptTemplate {
    constructor() {
    }

    generateConcept(concept: PiLangConcept): string {
        const language = concept.language;
        const hasSuper = !!concept.base;
        const extendsClass = hasSuper ? concept.base.name : "MobxModelElementImpl";
        const hasName = concept.properties.some(p => p.name === "name");
        const hasSymbol = !!concept.symbol;
        const baseExpressionName = concept.language.findExpressionBase().name;

        const imports = Array.from(
            new Set(
                concept.parts.map(p => p.type.name)
                    .concat(concept.references.map(r => r.type.name))
                    .concat(language.enumerations.map(e => e.name))
                    .filter(name => !(name === concept.name))
                    // .concat(element.properties.map(p => p.type).filter(t => language.enumerations.some(e => e.name === t)))
                    .concat((concept.base ? concept.base.name : null))
                    .filter(r => r !== null)
            )
        );

        const mobxImports: string[] = ["model"];
        // if( element.references.length > 0) {
        //     mobxImports.push("observable")
        // }
        if (!hasSuper) {
            mobxImports.push("MobxModelElementImpl");
        }
        if (concept.parts.some(part => part.isList)) {
            mobxImports.push("observablelistpart");
        }
        if (concept.parts.some(part => !part.isList)) {
            mobxImports.push("observablepart");
        }
        if (concept.references.some(ref => ref.isList)) {
            mobxImports.push("observablelistreference");
        }
        if (concept.references.some(ref => !ref.isList)) {
            mobxImports.push("observablereference");
        }

        // Template starts here
        const result = `
            ${concept.properties.length > 0 ? `import { observable } from "mobx";` : ""}
            import * as uuid from "uuid";
            import { WithType } from "./WithType";
            import { ${mobxImports.join(",")} } from "@projectit/model";
            import { ${language.name}ConceptType } from "./${language.name}";
            ${imports.map(imp => `import { ${imp} } from "./${imp}";`).join("")}

            @model
            export class ${concept.name} extends ${extendsClass} implements WithType {
                readonly $type: ${language.name}ConceptType = "${concept.name}";
                ${!hasSuper ? "$id: string;" : ""}
                    
                constructor(id?: string) {
                    ${!hasSuper ? "super();" : "super(id);"}
                    ${!hasSuper ? `
                        if (!!id) { 
                            this.$id = id;
                        } else {
                            this.$id = uuid.v4();
                        }` : ""
        }
                }
                
                ${concept.properties.map(p => this.generatePrimitiveProperty(p)).join("")}
                ${concept.parts.map(p => this.generatePartProperty(p)).join("")}
                ${concept.references.map(p => this.generateReferenceProperty(p)).join("")}

                get$Type(): ${language.name}ConceptType {
                    return this.$type;
                }

                ${!concept.base ? `
                piId(): string {
                    return this.$id;
                }`
            : ""}
                
                piIsExpression(): boolean {
                    return ${concept.isExpression};
                }
                
                piIsBinaryExpression(): boolean {
                    return ${concept.isBinaryExpression};
                }
                
                piIsExpressionPlaceHolder(): boolean {
                    return ${concept.isExpressionPlaceHolder};
                }
                
                piPriority(): number {
                    return ${concept.getPriority() ? concept.getPriority() : "-1"};
                }
               
                ${hasName ? `
                static create(name: string): ${concept.name} {
                    const result = new ${concept.name}();
                    result.name = name;
                    return result;
                }`
            : ""}
                
                ${hasSymbol ? `
                public piSymbol(): string {
                    return "${concept.symbol}";
                }`
            : ""}
                
                ${concept.isBinaryExpression ? `
                public piLeft(): ${baseExpressionName} {
                    return this.left;
                }
                
                public piRight(): ${baseExpressionName} {
                    return this.right;
                }
                
                public piSetLeft(value: ${baseExpressionName}): void {
                    this.left = value;
                }
                
                public piSetRight(value: ${baseExpressionName}): void {
                    this.right = value;
                }
                `
            : ""}

            }`;
        return result;
    }

    generatePrimitiveProperty(property: PiLangPrimitiveProperty): string {
        return `
            @observable ${property.name}: ${property.type} ${property.isList ? "[]" : ""};
        `;
    }

    generatePartProperty(property: PiLangElementProperty): string {
        const decorator = property.isList ? "@observablelistpart" : "@observablepart";
        const arrayType = property.isList ? "[]" : "";
        return `
            ${decorator} ${property.name} : ${property.type.name}${arrayType};
        `;
    }

    generateReferenceProperty(property: PiLangElementProperty): string {
        const decorator = property.isList ? "@observablelistreference" : "@observablereference";
        const arrayType = property.isList ? "[]" : "";
        return `
            ${decorator} ${property.name} : ${property.type.name}${arrayType};
        `;
    }

}
