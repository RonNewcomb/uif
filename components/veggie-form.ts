export default class {
  mustBeAnimal = (val: string, form: any) => (val || "").includes("a");
  mustBeMineral = (val: string, form: any) => (val || "").includes("m");
  mustBeVegetable = (val: string, form: any) => (val || "").includes("v");
  mustBeOpt2 = (val: string) => (val || "").includes("2");
}
