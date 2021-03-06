/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const HarmonyExportExpressionDependency = require("./HarmonyExportExpressionDependency");
const HarmonyExportHeaderDependency = require("./HarmonyExportHeaderDependency");
const HarmonyExportSpecifierDependency = require("./HarmonyExportSpecifierDependency");
const HarmonyExportImportedSpecifierDependency = require("./HarmonyExportImportedSpecifierDependency");
const HarmonyImportDependency = require("./HarmonyImportDependency");
const HarmonyModulesHelpers = require("./HarmonyModulesHelpers");

module.exports = class HarmonyExportDependencyParserPlugin {
	apply(parser) {
		parser.plugin("export", statement => {
			const dep = new HarmonyExportHeaderDependency(statement.declaration && statement.declaration.range, statement.range);
			dep.loc = Object.create(statement.loc);
			dep.loc.index = -1;
			parser.state.current.addDependency(dep);
			return true;
		});
		parser.plugin("export import", (statement, source) => {
			const dep = new HarmonyImportDependency(source, HarmonyModulesHelpers.getNewModuleVar(parser.state, source), statement.range);
			dep.loc = Object.create(statement.loc);
			dep.loc.index = -1;
			parser.state.current.addDependency(dep);
			parser.state.lastHarmonyImport = dep;
			return true;
		});
		parser.plugin("export expression", (statement, expr) => {
			const dep = new HarmonyExportExpressionDependency(parser.state.module, expr.range, statement.range);
			dep.loc = Object.create(statement.loc);
			dep.loc.index = -1;
			parser.state.current.addDependency(dep);
			return true;
		});
		parser.plugin("export declaration", statement => {});
		parser.plugin("export specifier", (statement, id, name, idx) => {
			const rename = parser.scope.renames[`$${id}`];
			let dep;
			const harmonyNamedExports = parser.state.harmonyNamedExports = parser.state.harmonyNamedExports || new Set();
			harmonyNamedExports.add(name);
			if(rename === "imported var") {
				const settings = parser.state.harmonySpecifier[`$${id}`];
				dep = new HarmonyExportImportedSpecifierDependency(parser.state.module, settings[0], settings[1], settings[2], name, harmonyNamedExports, null);
			} else {
				const immutable = statement.declaration && isImmutableStatement(statement.declaration);
				const hoisted = statement.declaration && isHoistedStatement(statement.declaration);
				dep = new HarmonyExportSpecifierDependency(parser.state.module, id, name, !immutable || hoisted ? -2 : (statement.range[1] + 0.5), immutable);
			}
			dep.loc = Object.create(statement.loc);
			dep.loc.index = idx;
			parser.state.current.addDependency(dep);
			return true;
		});
		parser.plugin("export import specifier", (statement, source, id, name, idx) => {
			const harmonyNamedExports = parser.state.harmonyNamedExports = parser.state.harmonyNamedExports || new Set();
			let harmonyStarExports = null;
			if(name) {
				harmonyNamedExports.add(name);
			} else {
				harmonyStarExports = parser.state.harmonyStarExports = parser.state.harmonyStarExports || [];
			}
			const dep = new HarmonyExportImportedSpecifierDependency(parser.state.module, parser.state.lastHarmonyImport, HarmonyModulesHelpers.getModuleVar(parser.state, source), id, name, harmonyNamedExports, harmonyStarExports && harmonyStarExports.slice());
			if(harmonyStarExports) {
				harmonyStarExports.push(dep);
			}
			dep.loc = Object.create(statement.loc);
			dep.loc.index = idx;
			parser.state.current.addDependency(dep);
			return true;
		});
	}
};

function isImmutableStatement(statement) {
	if(statement.type === "FunctionDeclaration") return true;
	if(statement.type === "ClassDeclaration") return true;
	if(statement.type === "VariableDeclaration" && statement.kind === "const") return true;
	return false;
}

function isHoistedStatement(statement) {
	if(statement.type === "FunctionDeclaration") return true;
	return false;
}
