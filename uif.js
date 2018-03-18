"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var surroundTag = 'INNERHTML';
var standardCustomTags = ['IF', 'EACH'];
var standardTags = ['DIV', 'P', 'SPAN', 'SCRIPT', 'B', 'I', 'A', 'UL', 'LI', surroundTag].concat(standardCustomTags);
var standardExtentions = ["html", "css", "js"];
var definitions = new Map();
var getFile = function (tag, ext) { return new Promise(function (resolve) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "http://localhost/uif/components/" + tag + "." + ext);
    xhr.onload = function () { return resolve((xhr.status >= 200 && xhr.status < 300) ? xhr.response : void 0); };
    xhr.send();
}); };
var browserToParseHTML = function () { return new Promise(function (r) { return setTimeout(r); }); };
function getTagsWithin(elements) {
    var customElements = [];
    for (var i = 0; i < elements.length; i++)
        if (standardTags.indexOf(elements[i].tagName) === -1)
            customElements.push(elements[i]);
    return customElements;
}
function loadComponent(tag) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            if (definitions.has(tag))
                return [2, definitions.get(tag)];
            definitions.set(tag, {});
            return [2, Promise.all(standardExtentions.map(function (ext) { return __awaiter(_this, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _a = definitions.get(tag);
                            _b = ext;
                            return [4, getFile(tag, ext)];
                        case 1: return [2, _a[_b] = _c.sent()];
                    }
                }); }); }))
                    .then(function (_) { return definitions.get(tag); })];
        });
    });
}
function instantiateComponent(component) {
    return __awaiter(this, void 0, void 0, function () {
        var style, script, content, contentElement, i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (component.definition.css) {
                        style = document.createElement('style');
                        style.innerHTML = component.definition.css;
                        document.head.appendChild(style);
                    }
                    if (component.definition.js) {
                        script = document.createElement('script');
                        script.innerHTML = component.definition.js;
                        document.body.appendChild(script);
                    }
                    if (!component.definition.html) return [3, 4];
                    content = component.location.innerHTML;
                    component.location.innerHTML = component.definition.html;
                    return [4, browserToParseHTML()];
                case 1:
                    _a.sent();
                    if (!content) return [3, 3];
                    contentElement = component.location.getElementsByTagName(surroundTag);
                    if (!(contentElement && contentElement.length > 0)) return [3, 3];
                    for (i = 0; i < contentElement.length; i++)
                        contentElement[i].outerHTML = content;
                    return [4, browserToParseHTML()];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2, scanLoadAndInstantiate(component.location)];
                case 4: return [2, component];
            }
        });
    });
}
function scanLoadAndInstantiate(customElement) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2, Promise.all(getTagsWithin(customElement.children)
                    .map(function (element) { return __awaiter(_this, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = {};
                            return [4, loadComponent(element.tagName.toLowerCase())];
                        case 1:
                            _a.definition = _b.sent();
                            return [4, element];
                        case 2: return [2, (_a.location = _b.sent(), _a)];
                    }
                }); }); })
                    .map(function (component2Create) { return __awaiter(_this, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = instantiateComponent;
                            return [4, component2Create];
                        case 1: return [2, _a.apply(void 0, [_b.sent()])];
                    }
                }); }); }))];
        });
    });
}
window.onload = function (_) { return scanLoadAndInstantiate(document.body); };
