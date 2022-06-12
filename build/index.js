"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
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
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c, _d, _e;
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var express_actuator_1 = __importDefault(require("express-actuator"));
var spotify_web_api_node_1 = __importDefault(require("spotify-web-api-node"));
var http_1 = __importDefault(require("http"));
var https_1 = __importDefault(require("https"));
var credentials = {
    clientId: (_a = process.env.CLIENT_ID) !== null && _a !== void 0 ? _a : 'a2a88c4618324942859ce3e1f888b938',
    clientSecret: (_b = process.env.CLIENT_SECRET) !== null && _b !== void 0 ? _b : 'bfce3e5d96074c21ac4db8b4991c2f37',
    redirectUri: 'com.fissa:/oauth',
};
var clientErrorHandler = function (err, req, res, next) {
    if (req.xhr) {
        res.status(500).send({ error: 'Something failed!' });
    }
    else {
        next(err);
    }
};
var errorHandler = function (err, req, res, next) {
    res.status(500);
    res.render('error', { error: err });
};
var logErrors = function (err, req, res, next) {
    console.error(err.stack);
    next(err);
};
var app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, express_actuator_1.default)());
app.use(logErrors);
app.use(clientErrorHandler);
app.use(errorHandler);
var server = http_1.default.createServer(app);
var serverHttps = https_1.default.createServer(app);
app.post('/api/token', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var spotifyApi, response;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                spotifyApi = new spotify_web_api_node_1.default(credentials);
                return [4 /*yield*/, spotifyApi.authorizationCodeGrant(req.body.code)];
            case 1:
                response = _a.sent();
                res.send(JSON.stringify(response.body));
                return [2 /*return*/];
        }
    });
}); });
app.post('/api/refresh', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var spotifyApi, response;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                spotifyApi = new spotify_web_api_node_1.default(credentials);
                spotifyApi.setAccessToken(req.body.access_token);
                spotifyApi.setRefreshToken(req.body.refresh_token);
                return [4 /*yield*/, spotifyApi.refreshAccessToken()];
            case 1:
                response = _a.sent();
                res.send(JSON.stringify(response.body));
                return [2 /*return*/];
        }
    });
}); });
var port = (_d = (_c = process.env.NODE_PORT) !== null && _c !== void 0 ? _c : process.env.PORT) !== null && _d !== void 0 ? _d : 8080;
var portHttps = (_e = process.env.HTTPS_PORT) !== null && _e !== void 0 ? _e : 8443;
server.listen(port, function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        console.log('Server running', server.address());
        return [2 /*return*/];
    });
}); });
serverHttps.listen(portHttps, function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        console.log('Https server running', serverHttps.address());
        return [2 /*return*/];
    });
}); });
//# sourceMappingURL=index.js.map