export default class {
  mustBeAnimal = (val: string, form: any) => {
    console.log(val, "is an animal?");
    return val.includes('a');;
  };

  mustBeMineral = (val: string, form: any) => {
    console.log(val, "is a mineral?");
    return val.includes('m');
  };

  mustBeVegetable = (val: string, form: any) => {
    console.log(val, "is a vegetable?");
    return val.includes('v');
  };
}
