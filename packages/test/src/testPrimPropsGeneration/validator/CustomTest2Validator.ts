// Generated by the ProjectIt Language Generator.
import { PiError, PiErrorSeverity } from "@projectit/core";
import { Test2DefaultWorker } from "../utils/gen/Test2DefaultWorker";
import { Test2CheckerInterface } from "./gen/Test2Validator";

export class CustomTest2Validator extends Test2DefaultWorker implements Test2CheckerInterface {
    errorList: PiError[] = [];
}
