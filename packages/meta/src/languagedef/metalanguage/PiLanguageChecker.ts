import {
    PiLanguage,
    PiBinaryExpressionConcept,
    PiExpressionConcept,
    PiPrimitiveProperty,
    PiInterface, PiConcept, PiProperty, PiClassifier, PiLimitedConcept,
    PiElementReference, PiMetaEnvironment, PiPrimitiveType, PiModelDescription, PiUnitDescription
} from "./internal";
import { MetaLogger } from "../../utils/MetaLogger";
import { reservedWordsInTypescript } from "../../validatordef/generator/templates/ReservedWords";
import { PiLangCheckerPhase2 } from "./PiLangCheckerPhase2";
import { PiLangAbstractChecker } from "./PiLangAbstractChecker";
import { CheckerHelper } from "./CheckerHelper";
import { Checker } from "../../utils";

const LOGGER = new MetaLogger("PiLanguageChecker").mute();
const piReservedWords = ["model", "modelunit", "abstract", "limited", "language", "property", "concept",
    "binary", "expression", "concept", "base", "reference", "priority", "implements", "id", "in"];
// "in" is reserved word in pegjs

export class PiLanguageChecker extends PiLangAbstractChecker {

    public check(language: PiLanguage): void {
        LOGGER.info("Checking language '" + language.name + "'");
        this.errors = [];
        this.warnings = [];
        this.simpleCheck(!!language.name && !piReservedWords.includes(language.name.toLowerCase()) ,
            `Language should have a name ${Checker.location(language)}.`);

        this.language = language;
        // Note: this should be done first, otherwise the references will not be resolved
        PiMetaEnvironment.metascoper.language = language;

        // now check the whole language
        this.checkModel(language.modelConcept);
        language.units.forEach(unit => this.checkUnit(unit));
        language.concepts.forEach(concept => this.checkConcept(concept));
        language.interfaces.forEach(intf => this.checkInterface(intf));

        // now everything has been resolved, check that all concepts and interfaces have
        // unique names, that there are no circular inheritance or interface relationships,
        // and that all their properties have unique names
        const phase2: PiLangCheckerPhase2 = new PiLangCheckerPhase2(language);
        phase2.check(language);
        if (phase2.hasErrors()) {
            this.errors.push(...phase2.errors);
        }
        if (phase2.hasWarnings()) {
            this.warnings.push(...phase2.warnings);
        }
    }

    private checkModel(myModel: PiModelDescription) {
        this.nestedCheck({
            check: !!myModel,
            error: `There should be a model in your language ${Checker.location(this.language)}.`,
            whenOk: () => {
                myModel.primProperties.forEach(prop => this.checkPrimitiveProperty(prop));
                // check that model has a name property => can be done here, even though allProperties() is used, because models have no base
                CheckerHelper.checkOrCreateNameProperty(myModel, this);
                myModel.properties.forEach(part => this.checkConceptProperty(part));
                this.simpleCheck(myModel.parts().length > 0,
                    `The model should have at least one unit type ${Checker.location(myModel)}.`);
                this.simpleCheck(myModel.references().length == 0,
                    `All properties of a model must be parts, not references ${Checker.location(myModel)}.`);
            }
        });
    }

    private checkUnit(unit: PiUnitDescription) {
        unit.primProperties.forEach(prop => this.checkPrimitiveProperty(prop));
        unit.properties.forEach(part => this.checkConceptProperty(part));
        // check that modelunits have a name property => can be done here, even though allProperties() is used, because units have no base
        CheckerHelper.checkOrCreateNameProperty(unit, this);
    }

    private checkConcept(piConcept: PiConcept): void {
        LOGGER.log("Checking concept '" + piConcept.name + "' of type " + piConcept.constructor.name);
        this.simpleCheck(!!piConcept.name, `Concept should have a name ${Checker.location(piConcept)}.`);
        this.simpleCheck(!(piReservedWords.includes(piConcept.name.toLowerCase())), `Concept may not have a name that is equal to a reserved word ('${piConcept.name}') ${Checker.location(piConcept)}.`);
        this.simpleCheck(!(reservedWordsInTypescript.includes(piConcept.name.toLowerCase())),
            `Concept may not have a name that is equal to a reserved word in TypeScript ('${piConcept.name}') ${Checker.location(piConcept)}.`);

        if (!!piConcept.base) {
            this.checkClassifierReference(piConcept.base);
            const myBase = piConcept.base.referred;
            if (!!myBase) { // error message taken care of by checkClassifierReference
                this.nestedCheck({
                    check: myBase instanceof PiConcept,
                    error: `Base '${piConcept.base.name}' must be a concept ` +
                        `${Checker.location(piConcept.base)}.`,
                    whenOk: () => {
                        this.simpleCheck(!(!(piConcept instanceof PiExpressionConcept) && myBase instanceof PiExpressionConcept),
                            `A concept may not have an expression as base ${this.location(piConcept.base)}.`);
                        if (piConcept instanceof PiLimitedConcept) {
                            this.simpleWarning(piConcept.base.referred instanceof PiLimitedConcept, `Base '${piConcept.base.name}' of limited concept is not a limited concept.
    Only properties that have primitive type may be inherited ` +
                                `${Checker.location(piConcept.base)}.`
                            this.simpleWarning(myBase instanceof PiLimitedConcept,
                                `Base '${piConcept.base.name}' of limited concept is not a limited concept. ` +
                                        `Only properties that have primitive type are inherited ${this.location(piConcept.base)}.`
                            );
                        } else {
                            this.simpleCheck(!(piConcept.base.referred instanceof PiLimitedConcept), `Limited concept '${piConcept.base.name}' cannot be base of an unlimited concept ` +
                                `${Checker.location(piConcept.base)}.`
                            this.simpleCheck(!(myBase instanceof PiLimitedConcept), `Limited concept '${piConcept.base.name}' cannot be base of an unlimited concept ` +
                                `${this.location(piConcept.base)}.`
                            );
                        }
                    }
                });
            }
        }

        // do the interfaces
        const newInterfaces: PiElementReference<PiInterface>[] = [];
        for (const intf of piConcept.interfaces) {
            this.checkClassifierReference(intf);
            if (!!intf.referred) { // error message taken care of by checkClassifierReference
                this.simpleCheck(intf.referred instanceof PiInterface, `Concept '${intf.name}' is not an interface ${Checker.location(intf)}.`);
                // add to the list
                newInterfaces.push(intf);
            }
        }
        piConcept.interfaces = newInterfaces;

        // do the properties
        piConcept.primProperties.forEach(prop => this.checkPrimitiveProperty(prop));
        if (!(piConcept instanceof PiLimitedConcept)) {
            piConcept.properties.forEach(part => this.checkConceptProperty(part));
        }

        if (piConcept instanceof PiBinaryExpressionConcept && !(piConcept.isAbstract)) {
            // this.simpleCheck(binExpConcept.getSymbol() !== "undefined", `Concept ${piClass.name} should have a symbol`);
            this.simpleCheck(piConcept.getPriority() !== -1,
                `Binary expression concept ${piConcept.name} should have a priority ${Checker.location(piConcept)}.`);

            const left = piConcept.allParts().find(part => part.name === "left");
            this.nestedCheck({
                check: !!left,
                error: `Binary expression concept ${piConcept.name} should have a left part ${Checker.location(piConcept)}.`,
                whenOk: () => {
                    this.simpleCheck(!!left && left.type.referred instanceof PiExpressionConcept,
                        `Concept ${piConcept.name}.left should be an expression concept ${Checker.location(piConcept)}.`);
                }
            });
            const right = piConcept.allParts().find(part => part.name === "right");
            this.nestedCheck({
                check: !!right,
                error: `Binary expression concept ${piConcept.name} should have a right part ${Checker.location(piConcept)}.`,
                whenOk: () => {
                    this.simpleCheck(!!right && right.type.referred instanceof PiExpressionConcept,
                        `Concept ${piConcept.name}.right should be an expression concept ${Checker.location(piConcept)}.`);
                }
            });
        }

        if (piConcept instanceof PiLimitedConcept) {
            this.checkLimitedConcept(piConcept);
        }
    }

    checkLimitedConcept(piLimitedConcept: PiLimitedConcept) {
        LOGGER.log(`Checking limited concept '${piLimitedConcept.name}' ${Checker.location(piLimitedConcept)}`);
        // the normal checking of concepts is done in this.checkConcept

        // limited concept may be used as reference only, thus it should have a property 'name: string'
        // this property is added in 'createLimitedConcept' in file 'LanguageCreators.ts'

        // checking for properties other than primitive ones
        piLimitedConcept.properties.forEach(prop => {
            this.simpleCheck(false, `Property '${prop.name}' of limited concept should have primitive type ${Checker.location(prop)}.`);
        });

        // if this concept is abstract there may be no instances
        // if this concept is not abstract there must be instances
        if (piLimitedConcept.isAbstract) {
            this.simpleCheck(piLimitedConcept.instances.length === 0,
                `An abstract limited concept may not have any instances ${Checker.location(piLimitedConcept)}.`);
        } else {
            this.simpleCheck(piLimitedConcept.instances.length > 0,
                `A non-abstract limited concept must have instances ${Checker.location(piLimitedConcept)}.`);
        }
    }


    checkConceptProperty(piProperty: PiProperty): void {
        LOGGER.log("Checking concept property '" + piProperty.name + "'");
        this.checkPropertyName(piProperty);
        this.nestedCheck(
            {
                check: !!piProperty.type,
                error: `Element '${piProperty.name}' should have a type ${Checker.location(piProperty)}.`,
                whenOk: () => {
                    this.checkClassifierReference(piProperty.type);
                    const realType = piProperty.type.referred;
                    if (!!realType) { // error message handled by checkClassifierReference
                        const owningClassifier = piProperty.owningClassifier;
                        this.checkPropertyType(piProperty, realType);

                        const isUnit = (realType instanceof PiUnitDescription);

                        // check use of unit types in non-model concepts: may be references only
                        if (isUnit && piProperty.isPart) {
                            this.simpleCheck(
                                owningClassifier instanceof PiModelDescription,
                                `Modelunit '${realType.name}' may be used as reference only in a non-model concept ${Checker.location(piProperty.type)}.`);
                        }
                        // check use of non-unit types in model concept
                        if (owningClassifier instanceof PiModelDescription) {
                            this.simpleCheck(
                                isUnit,
                                `Type of property '${piProperty.name}' should be a modelunit ${Checker.location(piProperty.type)}.`);
                        }
                        // TODO review the rules around 'public'
                        // if (piProperty.isPart && piProperty.isPublic) {
                        //     this.nestedCheck({
                        //         check: realType.isPublic,
                        //         error: `Property '${piProperty.name} of type ${realType.name}' is public, the concept ${realType.name} should be public as well ${Checker.location(piProperty)}.`,
                        //         whenOk: () => {
                        //             this.simpleCheck(
                        //                 !!realType.nameProperty() && realType.nameProperty().isPublic,
                        //                 `public Concept '${realType.name}' must have a public property 'name'`
                        //             )
                        //         }
                        //     });
                        // }
                    }
                    // optionality for lists is ignored
                    if (piProperty.isList && piProperty.isOptional) {
                        // TODO get wording of error message right
                        this.simpleWarning(false,
                            `Property '${piProperty.name}' is a list and therefore always optional, optionality will be ignored ${Checker.location(piProperty)}.`);
                        piProperty.isOptional = false;
                    }
                }
            });
    }

    private checkPropertyType(piProperty: PiProperty, realType: PiClassifier) {
        if (!!realType) { // error message taken care of by checkClassifierReference
            if (realType instanceof PiLimitedConcept) {
                // this situation is OK, but property with limited concept as type should always be a reference property.
                // the property should refer to one of the predefined instances of the limited concept.
                // in phase2 of the checker it is ensured that limited concepts always have a 'name' property of type 'identifier'.
                piProperty.isPart = false;
            } else {
                if (!piProperty.isPart) {
                    // it is a reference, so check whether the type has a name by which it can be referred
                    const nameProperty = realType.nameProperty();
                    this.nestedCheck({
                        check: !!nameProperty,
                        error: `Type '${realType.name}' cannot be used as a reference, because it has no name property ${Checker.location(piProperty.type)}.`,
                        whenOk: () => {
                            this.simpleCheck(nameProperty.type.referred === PiPrimitiveType.identifier,
                                `Type '${realType.name}' cannot be used as a reference, because its name property is not of type 'identifier' ${Checker.location(piProperty.type)}.`);
                        }
                    });
                }
            }
        }
    }

    checkPrimitiveProperty(element: PiPrimitiveProperty): void {
        LOGGER.log("Checking primitive property '" + element.name + "'");
        this.checkPropertyName(element);
        this.nestedCheck(
            {
                check: !!element.type,
                error: `Property '${element.name}' should have a type ${Checker.location(element)}.`,
                whenOk: () => {
                    let myType = element.type.referred;
                    this.checkPrimitiveType(myType, element);
                    if (element.isOptional) {
                        this.simpleWarning(false,
                            `Property '${element.name}' has primitive type, may therefore not be optional, optionality will be ignored ${Checker.location(element)}.`);
                        element.isOptional = false;
                    }
                    // check initial value(s)
                    if (!element.isList) {
                        this.simpleCheck(element.initialValueList.length <= 1,
                            `Initial value of property '${element.name}' should be a single value ${Checker.location(element)}.`);
                        if (element.initialValue !== null && element.initialValue !== undefined) { // the property has an initial value, so check it
                            this.simpleCheck(this.checkValueToType(element.initialValue, myType as PiPrimitiveType),
                                `Type of '${element.initialValue}' (${typeof element.initialValue}) does not fit type (${element.type.name}) of property '${element.name}' ${Checker.location(element)}.`);
                        }
                    } else {
                        // this.simpleCheck(element.initialValue === null || element.initialValue === undefined,
                        //     `Initial value of property '${element.name}' should be a list value ${Checker.location(element)}.`);
                        if (element.initialValueList.length > 0) { // the property has an initial value, so check it
                            element.initialValueList.forEach(value => {
                                this.simpleCheck(this.checkValueToType(value, myType as PiPrimitiveType),
                                    `Type of '${value}' (${typeof element.initialValue}) does not fit type (${element.type.name}[]) of property '${element.name}' ${Checker.location(element)}.`);
                            });
                        }
                    }
                    // end check initial value(s)
                }
            });
    }

    private checkPropertyName(element: PiProperty) {
        this.nestedCheck(
            {
                check: !!element.name,
                error: `Property should have a name ${Checker.location(element)}.`,
                whenOk: () => {
                    this.simpleCheck(!(reservedWordsInTypescript.includes(element.name.toLowerCase())),
                        `Property may not have a name that is equal to a reserved word in TypeScript ('${element.name}') ${Checker.location(element)}.`);
                    // TODO determine whether the following check is important
                    // this.simpleCheck(!(piReservedWords.includes(element.name.toLowerCase())),
                    //     `Property may not have a name that is equal to a reserved word ('${element.name}') ${Checker.location(element)}.`);
                }
            });
    }


    private checkPrimitiveType(type: PiClassifier, element: PiPrimitiveProperty) {
        LOGGER.log("Checking primitive type '" + type.name + "'");
        this.simpleCheck((type === PiPrimitiveType.identifier || type === PiPrimitiveType.string || type === PiPrimitiveType.number || type === PiPrimitiveType.boolean),
            `Primitive property '${element.name}' should have a primitive type (string, identifier, boolean, or number) ${Checker.location(element)}.`
        );
    }

    checkInterface(piInterface: PiInterface) {
        this.simpleCheck(!!piInterface.name, `Interface should have a name ${Checker.location(piInterface)}.`);
        this.simpleCheck(!(piReservedWords.includes(piInterface.name.toLowerCase())), `Interface may not have a name that is equal to a reserved word ('${piInterface.name}') ${Checker.location(piInterface)}.`);
        this.simpleCheck(!(reservedWordsInTypescript.includes(piInterface.name.toLowerCase())),
            `Interface may not have a name that is equal to a reserved word in TypeScript ('${piInterface.name}') ${Checker.location(piInterface)}.`);

        for (const intf of piInterface.base) {
            this.checkClassifierReference(intf);
            if (!!intf.referred) { // error message taken care of by checkClassifierReference
                this.simpleCheck(intf.referred instanceof PiInterface,
                    `Base concept '${intf.name}' must be an interface concept ` +
                        `${Checker.location(intf)}`);
            }
        }

        piInterface.primProperties.forEach(prop => this.checkPrimitiveProperty(prop));
        piInterface.properties.forEach(part => this.checkConceptProperty(part));
    }


}
