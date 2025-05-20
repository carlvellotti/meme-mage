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
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
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
Object.defineProperty(exports, "__esModule", { value: true });
var supabase_js_1 = require("@supabase/supabase-js");
var dotenv = require("dotenv");
var path = require("path");
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') }); // Load environment variables from .env.local file
var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
var supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Supabase URL or Service Role Key is not defined in environment variables.');
    process.exit(1);
}
var supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey);
// Regex to parse the caption from the "Analyze Provided Example" section
// This will capture the text within the quotes after "**Caption:**"
var captionRegex = /- \*\*Analyze Provided Example:\*\s*\n\s*\*\s*\*\*Caption:\*\*\s*"(.*?)"/;
function backfillCaptions() {
    return __awaiter(this, void 0, void 0, function () {
        var errorCount, successCount, processedCount, batchSize, offset, hasMore, _a, templates, fetchError, _i, _b, template, match, parsedCaption, updateError;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log('Starting backfill process for scraped_example_caption...');
                    errorCount = 0;
                    successCount = 0;
                    processedCount = 0;
                    batchSize = 100;
                    offset = 0;
                    hasMore = true;
                    _c.label = 1;
                case 1:
                    if (!hasMore) return [3 /*break*/, 7];
                    console.log("Fetching batch starting at offset ".concat(offset, "..."));
                    return [4 /*yield*/, supabase
                            .from('meme_templates')
                            .select('id, instructions, scraped_example_caption')
                            .is('scraped_example_caption', null) // Only fetch rows where it's NULL
                            // You could add more filters, e.g., .not('instructions', 'is', null)
                            .range(offset, offset + batchSize - 1)];
                case 2:
                    _a = _c.sent(), templates = _a.data, fetchError = _a.error;
                    if (fetchError) {
                        console.error('Error fetching templates:', fetchError);
                        errorCount++;
                        return [3 /*break*/, 7]; // Stop if there's a major fetch error
                    }
                    if (!templates || templates.length === 0) {
                        console.log('No more templates to process or initial fetch empty.');
                        hasMore = false;
                        return [3 /*break*/, 7];
                    }
                    console.log("Processing ".concat(templates.length, " templates in this batch..."));
                    _i = 0, _b = templates;
                    _c.label = 3;
                case 3:
                    if (!(_i < _b.length)) return [3 /*break*/, 6];
                    template = _b[_i];
                    processedCount++;
                    if (!template.instructions) {
                        console.log("Template ID ".concat(template.id, " has no instructions, skipping."));
                        return [3 /*break*/, 5];
                    }
                    match = template.instructions.match(captionRegex);
                    parsedCaption = null;
                    if (match && match[1]) {
                        parsedCaption = match[1].trim();
                        // Further cleanup if needed, e.g., unescaping characters if your AI output tends to escape them
                    }
                    if (!parsedCaption) return [3 /*break*/, 5];
                    return [4 /*yield*/, supabase
                            .from('meme_templates')
                            .update({ scraped_example_caption: parsedCaption })
                            .eq('id', template.id)];
                case 4:
                    updateError = (_c.sent()).error;
                    if (updateError) {
                        console.error("Failed to update template ID ".concat(template.id, ":"), updateError);
                        errorCount++;
                    }
                    else {
                        // console.log(`Successfully updated template ID ${template.id}`);
                        successCount++;
                    }
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6:
                    offset += templates.length;
                    if (templates.length < batchSize) {
                        hasMore = false; // Last batch was smaller than batchSize
                    }
                    return [3 /*break*/, 1];
                case 7:
                    console.log('\n--- Backfill Summary ---');
                    console.log("Total templates checked (where scraped_example_caption was NULL): ".concat(processedCount));
                    console.log("Successfully updated with parsed caption: ".concat(successCount));
                    console.log("Errors encountered during updates/fetches: ".concat(errorCount));
                    console.log('Backfill process complete.');
                    return [2 /*return*/];
            }
        });
    });
}
backfillCaptions().catch(function (err) {
    console.error('Unhandled error during backfill script execution:', err);
    process.exit(1);
});
