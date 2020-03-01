import { Names } from "../../Names";
import { PiLangConcept, PiLangElementProperty, PiLangPrimitiveProperty } from "../../../metalanguage/PiLanguage";

export class ConceptTemplate {
    constructor() {
    }

    generateConcept(concept: PiLangConcept): string {
        const language = concept.language;
        const hasSuper = !!concept.base;
        const extendsClass = hasSuper ? Names.concept(concept.base.concept()) : "MobxModelElementImpl";
        const hasName = concept.properties.some(p => p.name === "name");
        const hasSymbol = !!concept.symbol;
        const baseExpressionName = Names.concept(concept.language.findExpressionBase());
        const isBinaryExpression = concept.binaryExpression();
        const isExpression = (!isBinaryExpression) && concept.expression() ;
        const abstract = (concept.isAbstract ? "abstract" : "");
        const implementsPi = (isExpression ? "PiExpression": (isBinaryExpression ? "PiBinaryExpression" : "PiElement"));

        const imports = Array.from(
            new Set(
                concept.parts.map(p => Names.concept(p.type.concept()))
                    .concat(concept.references.map(r => Names.concept(r.type.concept())))
                    .concat(language.enumerations.map(e => Names.enumeration(e)))
                    .concat(language.types.map(e => Names.type(e)))
                    .concat(Names.concept(language.expressionPlaceholder()))
                    .concat([baseExpressionName])
                    .filter(name => !(name === concept.name))
                    // .concat(element.properties.map(p => p.type).filter(t => language.enumerations.some(e => e.name === t)))
                    .concat((concept.base ? Names.concept(concept.base.concept()) : null))
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
            import { ${Names.withTypeInterface(language)} } from "./${Names.withTypeInterface(language)}";
            import { PiElement, PiExpression, PiBinaryExpression } from "@projectit/core";
            import { ${mobxImports.join(",")} } from "@projectit/model";
            import { ${language.name}ConceptType } from "./${language.name}";
            ${imports.map(imp => `import { ${imp} } from "./${imp}";`).join("")}

            @model
            export ${abstract}  class ${Names.concept(concept)} extends ${extendsClass} implements ${implementsPi}, ${Names.withTypeInterface(language)} 
            {
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
                    ${concept.binaryExpression() ? `
                    this.left = new ${Names.concept(language.expressionPlaceholder())};
                    this.right = new ${Names.concept(language.expressionPlaceholder())};
                    `: ""
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
                    return ${isExpression || isBinaryExpression};
                }
                
                piIsBinaryExpression(): boolean {
                    return ${isBinaryExpression};
                }
                
                ${ isExpression || isBinaryExpression ? `
                piIsExpressionPlaceHolder(): boolean {
                    return ${concept.isExpressionPlaceHolder};
                }`
                : ""}
                
                ${ isBinaryExpression ? `
                public piSymbol(): string {
                    return "${concept.symbol}";
                }
                
                piPriority(): number {
                    return ${concept.getPriority() ? concept.getPriority() : "-1"};
                }
                
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

                ${hasName ? `
                static create(name: string): ${concept.name} {
                    const result = new ${concept.name}();
                    result.name = name;
                    return result;
                }`
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
        const initializer = (property.type.concept().expression() ? `= ${property.isList ? "[" : ""} new ${Names.concept(property.owningConcept.language.expressionPlaceholder())} ${property.isList ? "]" : ""}` : "");
        return `
            ${decorator} ${property.name} : ${Names.concept(property.type.concept())}${arrayType} ${initializer};
        `;
    }

    generateReferenceProperty(property: PiLangElementProperty): string {
        const decorator = property.isList ? "@observablelistreference" : "@observablereference";
        const arrayType = property.isList ? "[]" : "";
        return `
            ${decorator} ${property.name} : ${Names.concept(property.type.concept())}${arrayType};
        `;
    }

}
