import SomeService from "../services/SomeService";

console.log("inner.ts is evaluated");
 
SomeService.printer();

export class inner { 
    constructor() { 
        console.log("innerclass ctor");
    }
}