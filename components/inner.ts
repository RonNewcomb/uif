import SomeService from "../services/SomeService";
 
SomeService.printer();

export default class inner { 
    constructor() { 
        console.log("innerclass ctor");
    }
}