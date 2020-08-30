import SomeService from "../services/SomeService.js"; // Chrome/Firefox is apparently understanding & loading this without help; explicit extension needed
 
SomeService.printer();

export default class inner { 
    constructor() { 
        console.log("innerclass ctor");
    }
}