import {
    BoolKeywords, ListInfo, ListJoinType,
    PiEditClassifierProjection,
    PiEditProjection, PiEditProjectionDirection,
    PiEditProjectionItem,
    PiEditProjectionLine, PiEditProjectionText, PiEditPropertyProjection, PiEditSuperProjection, PiEditTableProjection,
    PiEditUnit, PiOptionalPropertyProjection
} from "../../metalanguage";
import {
    PiBinaryExpressionConcept,
    PiClassifier,
    PiConceptProperty,
    PiExpressionConcept,
    PiLanguage,
    PiPrimitiveProperty, PiPrimitiveType,
    PiProperty
} from "../../../languagedef/metalanguage";
import { LANGUAGE_GEN_FOLDER, LOG2USER, Names, PROJECTITCORE, Roles } from "../../../utils";
import { ParserGenUtil } from "../../../parsergen/parserTemplates/ParserGenUtil";

export class ProjectionTemplate {
    // The values for the boolean keywords are set on initialization (by a call to 'setStandardBooleanKeywords').
    private trueKeyword: string = "true";
    private falseKeyword: string = "false";
    // The classes, functions, etc. to import are collected during the creation of the content for the generated file,
    // to avoid unused imports. All imports are stored in the following two variables, one for the imports that
    // come from '@projectit/core', and one for the import that come from other parts of the generated code.
    private modelImports: string[] = [];
    private coreImports: string[] = [];

    setStandardBooleanKeywords(editorDef: PiEditUnit) {
        // get the standard labels for true and false
        const stdLabels: BoolKeywords = editorDef.getDefaultProjectiongroup().standardBooleanProjection;
        if (!!stdLabels) {
            this.trueKeyword = stdLabels.trueKeyword;
            this.falseKeyword = stdLabels.falseKeyword;
        }
    }

    generateBoxProviderCache(language: PiLanguage, editDef: PiEditUnit, relativePath: string) {
        // get the imports
        let imports: string[] = [];
        language.concepts.forEach(concept => {
            imports.push(`import { ${Names.boxProvider(concept)}  } from "./${Names.boxProvider(concept)}";`);
        });
        language.units.forEach(unit => {
            imports.push(`import { ${Names.boxProvider(unit)}  } from "./${Names.boxProvider(unit)}";`);
        });

        // get all the constructors
        let constructors: string[] = [];
        language.concepts.forEach(concept => {
            constructors.push(`["${Names.concept(concept)}", () => {
                        return new ${Names.boxProvider(concept)}()
                    }]`);
        });
        language.units.forEach(unit => {
            constructors.push(`["${Names.classifier(unit)}", () => {
                        return new ${Names.boxProvider(unit)}()
                    }]`);
        });

        // todo add methods for the projections names

        // template starts here
        return `
        import { isNullOrUndefined, PiBoxProvider, PiCompositeProjection, PiElement } from "@projectit/core";
        ${imports.map(imp => imp).join("\n")}            
        
        export class ${Names.boxProviderCache(language)} extends PiCompositeProjection {
            public static showBrackets: boolean = false;
            private static theInstance: ${Names.boxProviderCache(language)} = null; // the only instance of this class
        
            /**
             * This method implements the singleton pattern
             */
            public static getInstance(): ${Names.boxProviderCache(language)} {
                if (this.theInstance === undefined || this.theInstance === null) {
                    this.theInstance = new ${Names.boxProviderCache(language)}();
                }
                return this.theInstance;
            }
        
            /**
             * A private constructor, as demanded by the singleton pattern,
             * in which the list of predefined elements is filled.
             */
            private constructor() {
                super();
            }
        
            private elementToProvider: Map<string, PiBoxProvider> = new Map<string, PiBoxProvider>();
            private conceptNameToProviderConstructor: Map<string, () => PiBoxProvider> = new Map<string, () => PiBoxProvider>(
                [
                    ${constructors.map(constr => constr).join(",\n")} 
                ]);
        
            addConceptProjection(elementId: string, provider: PiBoxProvider) {
                this.elementToProvider.set(elementId, provider);
            }
        
            getConceptProjection(element: PiElement): PiBoxProvider {
                // let boxType: string = element.piLanguageConcept();
                // if (!!nameOfSuper && nameOfSuper.length > 0) {
                //     if (!this.rootProjection.checkSuper(nameOfSuper, element.piLanguageConcept())) {
                //         throw new Error(
                //             \`A box requested for '\${nameOfSuper}', which is not a super class or interface of '\${element.piLanguageConcept()}'\`
                //         );
                //     } else {
                //         boxType = nameOfSuper;
                //     }
                // }
        
                // try {
                if (isNullOrUndefined(element)) {
                    throw Error('${Names.boxProviderCache(language)}.getConceptProjection: element is null/undefined');
                }
                // } catch (e) {
                //     console.log(e.stack);
                //     return null;
                // }
        
                // return if present, else create a new provider based on the language concept
                let boxProvider = this.elementToProvider.get(element.piId());
                if (isNullOrUndefined(boxProvider)) {
                    boxProvider = this.conceptNameToProviderConstructor.get(element.piLanguageConcept())();
                    this.elementToProvider.set(element.piId(), boxProvider);
                    boxProvider.element = element;
                }
                return boxProvider;
            }
        
            getProjectionNames(): string[] {
                return ['default'];
            }
        
            getConstructor(conceptName: string): () => PiBoxProvider {
                return this.conceptNameToProviderConstructor.get(conceptName);
            }
        }`;
    }


    generateBoxProvider(language: PiLanguage, concept: PiClassifier, editDef: PiEditUnit, relativePath: string) {
        // init the imports
        this.addToIfNotPresent(this.modelImports, Names.classifier(concept));
        this.coreImports.push(...['Box', 'BoxUtils', 'BoxFactory', 'ElementBox', 'PiElement', 'PiBoxProvider']);

        // see which projections there are for this concept
        const myProjections: PiEditClassifierProjection[] = editDef.findProjectionsForType(concept);

        // if concept is a binary expression, handle it differently
        let isBinExp: boolean = false;
        let symbol: string = '';
        if (concept instanceof PiBinaryExpressionConcept) {
            isBinExp = true;
            symbol = editDef.getDefaultProjectiongroup().findExtrasForType(concept).symbol;
            this.coreImports.push(...['createDefaultBinaryBox', 'LanguageEnvironment', 'isPiBinaryExpression']);
        } else {
            this.coreImports.push('NewBoxUtils');
        }

        // start template
        const coreText: string = ` 
            /**
             * This class implements the box provider for one node in the PiElement model. The box provider is able to
             * create the (tree of) boxes for the node, based on the projections that are currently selected by the user.
             * The top of the tree of boxes is always a box of type ElementBox, which is a box that will never be
             * rendered itself, only its content will. Thus, we have a stable entry in the complete box tree for every 
             * PiElement node. 
             */          
            export class ${Names.boxProvider(concept)} implements PiBoxProvider {
                private _mainBox: ElementBox = null; // init is need for mobx!
                private _element: ${Names.classifier(concept)};
                private knownProjections: string[] = ['default'];
            
                constructor() {
                    makeObservable(this, {
                        box: computed
                    })
                }
            
                set element(element: PiElement) {
                    if (element.piLanguageConcept() === '${Names.classifier(concept)}') {
                        this._element = element as ${Names.classifier(concept)};
                    } else {
                        console.log('setelement: wrong type (' + element.piLanguageConcept() + '!= ${Names.classifier(concept)})')
                    }
                }
            
                get box(): Box {
                    if (this._element === null) {
                        return null;
                    }
            
                    if (this._mainBox === null || this._mainBox === undefined) {
                        this._mainBox = new ElementBox(this._element, 'main-box-for-' + this._element.piLanguageConcept() + '-' + this._element.piId());
                    }
            
                    // the main box always stays the same for this element, but the content may differ
                    this._mainBox.content = this.getContent();
                    console.log('BOX: ' + this._mainBox.role + ' for ' + this._mainBox.element.piId());
                    return this._mainBox;
                }
            
                private getContent(): Box {
                    // from the list of projections that must be shown, select the first one for this type of Freon node 
                    let projToUse = ${Names.boxProviderCache(language)}.getInstance().getProjectionNames().filter(p => this.knownProjections.includes(p))[0];
                    ${myProjections.length > 0 ? 
                        `// select the box to return based on the chosen selection
                        ${myProjections.map(proj => `if ( projToUse === '${proj.name}') {
                            return this.${Names.projectionMethod(proj)}();
                        }`).join(" else ")}                  
                        // in all other cases, return the default`
                    : ``
                    }
                    return this.getDefault();
                }
            
                ${!isBinExp ?
                    myProjections.map(proj => `${this.generateProjectionForClassfier(language, concept, proj)}`).join("\n\n")
                : ` /**
                     *  Create a standard binary box to ensure binary expressions can be edited easily
                     */
                    private getDefault(): Box {
                        const binBox = createDefaultBinaryBox(this._element, "${symbol}", LanguageEnvironment.getInstance().editor);
                        if (
                            ${Names.boxProviderCache(language)}.showBrackets &&
                            !!this._element.piOwnerDescriptor().owner &&
                            isPiBinaryExpression(this._element.piOwnerDescriptor().owner)
                        ) {
                            return BoxFactory.horizontalList(this._element, "brackets", [
                                BoxUtils.labelBox(this._element, "(", "bracket-open", true),
                                binBox,
                                BoxUtils.labelBox(this._element, ")", "bracket-close", true)
                            ]);
                        } else {
                            return binBox;
                        }
                    }`
                }                
            }`;

        // add the collected imports
        let importsText: string = `
            import { computed, makeObservable } from "mobx";           
            
            ${this.coreImports.length > 0
            ? `import { ${this.coreImports.map(c => `${c}`).join(", ")} } from "${PROJECTITCORE}";`
            : ``}         

            ${this.modelImports.length > 0
            ? `import { ${this.modelImports.map(c => `${c}`).join(", ")} } from "${relativePath}${LANGUAGE_GEN_FOLDER}";`
            : ``}             
            
            import { ${Names.boxProviderCache(language)} } from "./${Names.boxProviderCache(language)}";
            `;

        // reset the imports
        this.modelImports = [];
        this.coreImports = [];

        // return the generated text
        return importsText + coreText;
    }

    private generateProjectionForClassfier(language: PiLanguage, concept: PiClassifier, projection: PiEditClassifierProjection): string {
        this.addToIfNotPresent(this.modelImports, Names.classifier(concept));
        if (projection instanceof PiEditProjection) {
            // const elementVarName = Roles.elementVarName(concept);
            const elementVarName = 'this._element';
            let result = this.generateLines(projection.lines, elementVarName, concept.name, language, 1);
            if (concept instanceof PiExpressionConcept) {
                this.addToIfNotPresent(this.coreImports, "createDefaultExpressionBox");
                return `private ${Names.projectionMethod(projection)} () : Box {
                    return createDefaultExpressionBox( ${elementVarName}, "default-expression-box", [
                            ${result}
                        ],
                        { selectable: false }
                    );
                }`;
            } else {
                return `private ${Names.projectionMethod(projection)} () : Box {
                    return ${result};
                }`;
            }
            // } else if (projection instanceof PiEditTableProjection) => should not occur. Filtered out of 'allClassifiersWithProjection'
        }
        return '';
    }

    private generateLines(lines: PiEditProjectionLine[], elementVarName: string, boxLabel: string, language: PiLanguage, topIndex: number) {
        let result: string = "";
        // do all lines, separate them with a comma
        lines.forEach((line, index) => {
            result += this.generateLine(line, elementVarName, index, boxLabel, language, topIndex);
            if (index !== lines.length - 1) { // add a comma
                result += ",";
            }
        });
        if (lines.length > 1) { // multi-line projection, so surround with vertical box
            this.addToIfNotPresent(this.coreImports, "BoxFactory");
            result = `BoxFactory.verticalList(${elementVarName}, "${boxLabel}-overall", [
                ${result} 
            ])`;
        }
        if (result === "") {
            result = "null";
        }
        return result;
    }

    private generateLine(line: PiEditProjectionLine, elementVarName: string, index: number, boxLabel: string, language: PiLanguage, topIndex: number): string {
        let result: string = "";
        if (line.isEmpty()) {
            this.addToIfNotPresent(this.coreImports, "BoxUtils");
            result = `BoxUtils.emptyLineBox(${elementVarName}, "${boxLabel}-empty-line-${index}")`;
        } else {
            // do all projection items in the line, separate them with a comma
            line.items.forEach((item, itemIndex) => {
                result += this.generateItem(item, elementVarName, index, itemIndex, boxLabel, language, topIndex);
                if (itemIndex < line.items.length - 1) {
                    result += ",";
                }
            });
            if (line.items.length > 1) { // surround with horizontal box
                // TODO Too many things are now selectable, but if false, you cannot select e.g. an attribute
                this.addToIfNotPresent(this.coreImports, "BoxFactory");
                result = `BoxFactory.horizontalList(${elementVarName}, "${boxLabel}-hlist-line-${index}", [ ${result} ], { selectable: true } ) `;
            }
            if (line.indent > 0) { // surround with indentBox
                this.addToIfNotPresent(this.coreImports, "BoxUtils");
                result = `BoxUtils.indentBox(${elementVarName}, ${line.indent}, "${index}", ${result} )`;
            }
        }
        return result;
    }

    private generateItem(item: PiEditProjectionItem,
                         elementVarName: string,
                         lineIndex: number,
                         itemIndex: number,
                         mainBoxLabel: string,
                         language: PiLanguage,
                         topIndex: number): string {
        let result: string = "";
        if (item instanceof PiEditProjectionText) {
            this.addToIfNotPresent(this.coreImports, "BoxUtils");
            result += ` BoxUtils.labelBox(${elementVarName}, "${ParserGenUtil.escapeRelevantChars(item.text.trim())}", "top-${topIndex}-line-${lineIndex}-item-${itemIndex}") `;
        } else if (item instanceof PiOptionalPropertyProjection) {
            result += this.generateOptionalProjection(item, elementVarName, mainBoxLabel, language);
        } else if (item instanceof PiEditPropertyProjection) {
            // Note: this condition must come after PiOptionalPropertyProjection,
            // because PiOptionalPropertyProjection is a sub class of PiEditPropertyProjection
            result += this.generatePropertyProjection(item, elementVarName, mainBoxLabel, language);
        } else if (item instanceof PiEditSuperProjection) {
            result += this.generateSuperProjection(item, elementVarName);
        }
        return result;
    }

    private generateOptionalProjection(optional: PiOptionalPropertyProjection, elementVarName: string, mainBoxLabel: string, language: PiLanguage): string {
        const propertyProjection: PiEditPropertyProjection = optional.findPropertyProjection();
        if (!!propertyProjection) {
            const optionalPropertyName = propertyProjection.property.name;
            const myLabel = `${mainBoxLabel}-optional-${optionalPropertyName}`;

            // reuse the general method to handle lines
            let result = this.generateLines(optional.lines, elementVarName, myLabel, language, 2);

            // surround with optional box, and add "BoxFactory" to imports
            this.addToIfNotPresent(this.coreImports, "BoxFactory");
            result = `BoxFactory.optional(${elementVarName}, "optional-${optionalPropertyName}", () => (!!${elementVarName}.${optionalPropertyName}),
                ${result},
                false, "<+>"
            )`
            return result;
        } else {
            LOG2USER.error("INTERNAL ERROR: no property found in optional projection.");
        }
        return "";
    }

    /**
     * Projection template for a property.
     *
     * @param item      The property projection
     * @param elementVarName
     * @param mainLabel
     * @param language
     * @private
     */
    private generatePropertyProjection(item: PiEditPropertyProjection, elementVarName: string, mainLabel: string, language: PiLanguage) {
        let result: string = "";
        const property: PiProperty = item.property.referred;
        if (property instanceof PiPrimitiveProperty) {
            result += this.primitivePropertyProjection(property, elementVarName, item.boolInfo, item.listInfo);
        } else if (property instanceof PiConceptProperty) {
            if (property.isPart) {
                let projNameStr: string = '';
                if (!!item.projectionName && item.projectionName.length > 0) {
                    projNameStr = ', "' + item.projectionName + '"';
                }
                if (property.isList) {
                    if (!!item.listInfo && item.listInfo.isTable) {  // if there is information on how to project the property as a table, make it a table
                        result += this.generatePropertyAsTable(item.listInfo.direction, property, elementVarName, language);
                    } else if (!!item.listInfo) { // if there is information on how to project the property as a list, make it a list
                        result += this.generatePartAsList(item, property, elementVarName, projNameStr, language);
                    }
                } else { // single element
                    this.addToIfNotPresent(this.coreImports, "BoxUtils");
                    result += `NewBoxUtils.getBoxOrAlias(${elementVarName}, "${property.name}", "${property.type.name}", ${Names.boxProviderCache(language)}.getInstance()) `;
                }
            } else { // reference
                if (property.isList) {
                    if (!!item.listInfo&& item.listInfo.isTable) { // if there is information on how to project the property as a table, make it a table
                        // no table projection for references - for now
                        result += this.generateReferenceAsList(language, item.listInfo, property, elementVarName);
                    } else if (!!item.listInfo) { // if there is information on how to project the property as a list, make it a list
                        result += this.generateReferenceAsList(language, item.listInfo, property, elementVarName);
                    }
                } else { // single element
                    result += this.generateReferenceProjection(language, property, elementVarName);
                }
            }
        } else {
            result += `/* ERROR unknown property box here for ${property.name} */ `;
        }
        return result;
    }

    /**
     * Returns the text string that projects 'property' as a table.
     * @param orientation       Either row or column based
     * @param property          The property to be projected
     * @param elementVarName    The name of the variable that holds the property at runtime
     * @param language          The language for which this projection is made
     * @private
     */
    private generatePropertyAsTable(orientation: PiEditProjectionDirection, property: PiConceptProperty, elementVarName: string, language: PiLanguage): string {
        this.addToIfNotPresent(this.coreImports, "TableUtil");
        this.addToIfNotPresent(this.coreImports, "LanguageEnvironment");
        // return the projection based on the orientation of the table
        if (orientation === PiEditProjectionDirection.Vertical) {
            return `TableUtil.tableBoxColumnOriented(
                ${elementVarName},
                "${property.name}",
                this.rootProjection.getTableDefinition("${property.type.name}").headers,
                this.rootProjection.getTableDefinition("${property.type.name}").cells,
                LanguageEnvironment.getInstance().editor)`;
        } else {
            return `TableUtil.tableBoxRowOriented(
                ${elementVarName},
                "${property.name}",
                this.rootProjection.getTableDefinition("${property.type.name}").headers,
                this.rootProjection.getTableDefinition("${property.type.name}").cells,
                LanguageEnvironment.getInstance().editor)`;
        }
    }

    /**
     * generate the part list
     *
     * @param item
     * @param propertyConcept   The property for which the projection is generated.
     * @param elementVarName    The name of the element parameter of the getBox projection method.
     * @param projNameStr
     * @private
     */
    private generatePartAsList(item: PiEditPropertyProjection, propertyConcept: PiConceptProperty, elementVarName: string, projNameStr: string, language: PiLanguage) {
        // todo do we need the param 'projNameStr'? Isn't this the same as 'item.name'?
        this.addToIfNotPresent(this.coreImports, "BoxUtils");
        let joinEntry = this.getJoinEntry(item.listInfo);
        if (item.listInfo.direction === PiEditProjectionDirection.Vertical) {
            return `NewBoxUtils.verticalPartListBox(${elementVarName}, ${elementVarName}.${item.property.name}, "${propertyConcept.name}", ${joinEntry}${projNameStr}, ${Names.boxProviderCache(language)}.getInstance())`;
        } // else
        return `BoxUtils.horizontalPartListBox(${elementVarName}, "${propertyConcept.name}", this.rootProjection, ${joinEntry}${projNameStr})`;
    }

    private generateReferenceProjection(language: PiLanguage, appliedFeature: PiConceptProperty, element: string) {
        const featureType = Names.classifier(appliedFeature.type);
        this.addToIfNotPresent(this.modelImports, featureType);
        this.addToIfNotPresent(this.coreImports, Names.PiElementReference);
        this.addToIfNotPresent(this.coreImports, "BoxUtils");
        this.addToIfNotPresent(this.coreImports, "LanguageEnvironment");
        return `BoxUtils.referenceBox(
                                ${element},
                                "${appliedFeature.name}",
                                (selected: string) => {
                                    ${element}.${appliedFeature.name} = PiElementReference.create<${featureType}>(
                                       LanguageEnvironment.getInstance().scoper.getFromVisibleElements(
                                            ${element},
                                            selected,
                                            "${featureType}"
                                       ) as ${featureType}, "${featureType}");
                                },
                                LanguageEnvironment.getInstance().scoper
               )`;
    }

    private generateReferenceAsList(language: PiLanguage, listJoin: ListInfo, reference: PiConceptProperty, element: string) {
        this.addToIfNotPresent(this.coreImports, "BoxUtils");
        this.addToIfNotPresent(this.coreImports, "LanguageEnvironment");
        let joinEntry = this.getJoinEntry(listJoin);
        if (listJoin.direction === PiEditProjectionDirection.Vertical) {
            return `BoxUtils.verticalReferenceListBox(${element}, "${reference.name}", LanguageEnvironment.getInstance().scoper, ${joinEntry})`;
        } // else
        return `BoxUtils.horizontalReferenceListBox(${element}, "${reference.name}", LanguageEnvironment.getInstance().scoper, ${joinEntry})`;
    }

    private getJoinEntry(listJoin: ListInfo) {
        let joinEntry: string = `{ text:"${listJoin.joinText}", type:"${listJoin.joinType}" }`;
        if (listJoin.joinType === ListJoinType.NONE || !(listJoin.joinText?.length > 0)) {
            joinEntry = "null";
        }
        return joinEntry;
    }

    private primitivePropertyProjection(property: PiPrimitiveProperty, element: string, boolInfo?: BoolKeywords, listInfo?: ListInfo): string {
        if (property.isList) {
            return this.listPrimitivePropertyProjection(property, element, boolInfo, listInfo);
        } else {
            return this.singlePrimitivePropertyProjection(property, element, boolInfo);
        }
    }

    private singlePrimitivePropertyProjection(property: PiPrimitiveProperty, element: string, boolInfo?: BoolKeywords): string {
        this.addToIfNotPresent(this.coreImports, "BoxUtils");
        const listAddition: string = `${property.isList ? `, index` : ``}`;
        switch (property.type) {
            case PiPrimitiveType.string:
            case PiPrimitiveType.identifier:
                return `BoxUtils.textBox(${element}, "${property.name}"${listAddition})`;
            case PiPrimitiveType.number:
                return `BoxUtils.numberBox(${element}, "${property.name}"${listAddition})`;
            case PiPrimitiveType.boolean:
                let trueKeyword: string = this.trueKeyword;
                let falseKeyword: string = this.falseKeyword;
                if (!!boolInfo) {
                    // TODO this should probably get a new type of box
                    trueKeyword = boolInfo.trueKeyword;
                    falseKeyword = boolInfo.falseKeyword;
                }
                return `BoxUtils.booleanBox(${element}, "${property.name}", {yes:"${trueKeyword}", no:"${falseKeyword}"}${listAddition})`;
            default:
                return `BoxUtils.textBox(${element}, "${property.name}"${listAddition})`;
        }
    }

    private listPrimitivePropertyProjection(property: PiPrimitiveProperty, element: string, boolInfo?: BoolKeywords, listInfo?: ListInfo): string {
        let direction: string = "verticalList";
        if (!!listInfo && listInfo.direction === PiEditProjectionDirection.Horizontal) {
            direction = "horizontalList";
        }
        // TODO also adjust role '..-hlist' to '..-vlist'?
        this.addToIfNotPresent(this.coreImports, "BoxFactory");
        this.addToIfNotPresent(this.coreImports, "Box");
        // TODO Create Action for the role to actually add an element.
        return `BoxFactory.${direction}(${element}, "${Roles.property(property)}-hlist",
                            (${element}.${property.name}.map( (item, index)  =>
                                ${this.singlePrimitivePropertyProjection(property, element, boolInfo)}
                            ) as Box[]).concat( [
                                BoxFactory.alias(${element}, "new-${Roles.property(property)}-hlist", "<+ ${property.name}>")
                            ])
                        )`;
    }

    private generateTableDefinition(language: PiLanguage, c: PiClassifier, myTableProjection: PiEditTableProjection): string {
        // TODO Check whether 999 argument to generateItem()n should be different.
        if (!!myTableProjection) {
            // create the cell getters
            let cellGetters: string = '';
            myTableProjection.cells.forEach((cell, index) => {
                this.addToIfNotPresent(this.modelImports, Names.classifier(c));
                cellGetters += `(cell${index}: ${Names.classifier(c)}): Box => {
                        return ${this.generateItem(cell, `cell${index}`, index, index, c.name + "_table", language, 999)}
                    },\n`;
            });
            this.addToIfNotPresent(this.coreImports, "PiTableDefinition");

            return `${Names.tabelDefinitionFunction(c)}(): PiTableDefinition {
                const result: PiTableDefinition = {
                    headers: [ ${myTableProjection.headers.map(head => `"${head}"`).join(", ")} ],
                    cells: [${cellGetters}]
                };
                return result;
            }
        `;
        } else {
            console.log("INTERNAL PROJECTIT ERROR in generateTableCellFunction");
            return "";
        }
    }

    private generateSuperProjection(item: PiEditSuperProjection, elementVarName: string) {
        return `this.getBox(${elementVarName}, "${Names.classifier(item.superRef.referred)}")`;
    }

    private addToIfNotPresent(list: string[], newEntry: string) {
        if (list.indexOf(newEntry) === -1) {
            list.push(newEntry);
        }
    }
}
