import { PiLangConcept, PiLangEnumeration, PiLanguage, PiLangUnion, PiLangConceptReference } from "../languagedef/metalanguage/PiLanguage";
import { PiScopeDef } from "../scoperdef/metalanguage/PiScopeDefLang";
import { ValidatorDef } from "../validatordef/metalanguage/ValidatorDefLang";

/**
 * Defines all names that are used in the generation, to ensure they are identical
 * at each usage.
 */
export class Names {
    public static context(language: PiLanguage){
        return language.name + "Context";
    }

    public static actions(language: PiLanguage){
        return language.name + "Actions";
    }

    public static defaultActions(language: PiLanguage){
        return language.name + "DefaultActions";
    }

    public static manualActions(language: PiLanguage){
        return language.name + "ManualActions";
    }

    public static projectionDefault(language: PiLanguage){
        return language.name + "ProjectionDefault";
    }

    public static projection(language: PiLanguage){
        return language.name + "Projection";
    }

    public static editor(language: PiLanguage){
        return language.name + "Editor";
    }

    public static mainProjectionalEditor(language: PiLanguage){
        return "MainProjectionalEditor";
    }

    public static concept(concept: PiLangConcept){
        return concept.name;
    }

    public static enumeration(enumeration: PiLangEnumeration){
        return enumeration.name;
    }

    public static type(type: PiLangUnion){
        return type.name;
    }

    public static languageConceptType(language: PiLanguage){
        return language.name + "ConceptType";
    }

    public static allConcepts(language: PiLanguage){
        return "All" + language.name + "Concepts";
    }

    public static scoperInterface(language: PiLanguage){
        return "I" + language.name + "Scoper";
    }

    public static typerInterface(language: PiLanguage){
        return "I" + language.name + "Typer";
    }
    
    public static validatorInterface(language: PiLanguage){
        return "I" + language.name + "Validator";
    }

    public static namespace(language: PiLanguage, scopedef: PiScopeDef){
        return scopedef.scoperName + "Namespace";
    }

    public static scoper(language: PiLanguage, scopedef: PiScopeDef){
        return scopedef.scoperName + "Scoper";
    }

    public static validator(language: PiLanguage, validdef: ValidatorDef){
        return "DemoValidator"; // TODO
    }

    public static errorClassName(language: PiLanguage, ){
        return "PiError"; // TODO
    }

}
