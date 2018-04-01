import * as ts from 'typescript';
import { relative } from 'path';

const names = {
    treeMeta: '___treeMeta' as ts.__String,
    skip: 'skip',
    staticFields: '__fields',
    Base: 'Base',
    classPrefix: '__',
    fields: {
        name: 'name',
        type: 'type',
        readonly: 'readonly',
        args: 'args',
    },
};

export default (ctx: ts.TransformationContext, program?: ts.Program): ts.Transformer<ts.SourceFile> => {
    return sourceFile => {
        if (!program) {
            program = ts.createProgram([sourceFile.fileName], {
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.Latest,
                strict: true,
            });
        }
        const checker = program.getTypeChecker();
        const imports = new Set<ts.Symbol>();
        const assignedSymbols = new Set<ts.Symbol>();
        const classSymbols = checker.getSymbolsInScope(sourceFile, ts.SymbolFlags.Class);
        function visitor(node: ts.Node): ts.Node {
            node = ts.visitEachChild(node, visitor, ctx);
            if (ts.isClassDeclaration(node)) {
                const classType = checker.getTypeAtLocation(node) as ts.InterfaceType;
                const classSymbol = classType.symbol;
                let props: ts.Expression[] | undefined = undefined;
                // debugger;
                if (classType && classSymbol && classSymbol.members) {
                    let base: ts.BaseType | undefined = classType;
                    let isExtendedBase = false;
                    while (base) {
                        base = checker.getBaseTypes(base as ts.InterfaceType)[0];
                        if (base && base.symbol && base.symbol.escapedName === names.Base) {
                            isExtendedBase = true;
                            break;
                        }
                    }
                    // console.log(classSymbol.escapedName, isExtendedBase);
                    if (isExtendedBase) {
                        const superFieldsNode = ts.createPropertyAccess(ts.createSuper(), ts.createIdentifier(names.staticFields));
                        const prevFields = ts.createSpread(ts.createCall(superFieldsNode, undefined, []));
                        props = [prevFields];
                        classSymbol.members.forEach((propSymbol, key) => {
                            if (propSymbol.escapedName === names.treeMeta) return;
                            if (!propSymbol.declarations) return;
                            if (propSymbol.flags & ts.SymbolFlags.Property) {
                                const node = propSymbol.declarations[0];
                                const type = checker.getTypeAtLocation(node);
                                if (
                                    node.decorators &&
                                    node.decorators.some(
                                        d => ts.isIdentifier(d.expression) && getText(d.expression) === names.skip
                                    )
                                ) {
                                    return;
                                }
                                props!.push(
                                    createObj({
                                        [names.fields.name]: propSymbol.escapedName as string,
                                        [names.fields.readonly]: !assignedSymbols.has(propSymbol),
                                        [names.fields.type]: typeToJS(type),
                                    })
                                );
                            }
                        });
                    }
                }
                if (props) {
                    const body = ts.createBlock([ts.createReturn(ts.createArrayLiteral(props))]);
                    const staticFieldList = ts.createMethod(
                        undefined,
                        [ts.createModifier(ts.SyntaxKind.StaticKeyword)],
                        undefined,
                        names.staticFields,
                        undefined,
                        undefined,
                        [],
                        undefined,
                        body
                    );
                    const newMembers = ts.createNodeArray([...node.members, staticFieldList]);
                    node = ts.createClassDeclaration(
                        node.decorators,
                        node.modifiers,
                        node.name,
                        node.typeParameters,
                        node.heritageClauses || [],
                        newMembers as ts.NodeArray<ts.ClassElement>
                    );
                }
            }
            if (
                ts.isBinaryExpression(node) &&
                node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
                ts.isPropertyAccessExpression(node.left)
            ) {
                const symbol = checker.getSymbolAtLocation(node.left);
                if (symbol) {
                    let p: ts.Node | undefined = node;
                    // skip assignments in constructor
                    while (p && !ts.isConstructorDeclaration(p)) {
                        p = p.parent;
                    }
                    if (!p) {
                        assignedSymbols.add(symbol);
                    }
                }
            }
            return node;
        }

        const res = ts.visitNode(sourceFile, visitor);
        const importNodes = [];
        // console.log(classSymbols);
        for (const symbol of imports) {
            if (classSymbols.indexOf(symbol) > -1) continue;
            // if (!symbol.declarations || !symbol.declarations[0]) continue;
            const importedSourceFile = symbol.declarations![0].parent as ts.SourceFile;
            const path = importedSourceFile.fileName;
            let relativePath = relative(sourceFile.fileName + '/..', path).replace(/.tsx?$/, '');
            relativePath = relativePath[0] === '.' ? relativePath : './' + relativePath;

            const parentSymbol = (symbol as any).parent as ts.Symbol;
            const namedBindings = ts.createNamedImports([
                ts.createImportSpecifier(
                    ts.createIdentifier(symbol.escapedName as string),
                    ts.createIdentifier(names.classPrefix + symbol.escapedName)
                ),
            ]);
            const importClause = ts.createImportClause(undefined, namedBindings);
            const importDeclr = ts.createImportDeclaration(
                undefined,
                undefined,
                importClause,
                ts.createLiteral(relativePath)
            );
            importNodes.push(importDeclr);
        }
        if (importNodes.length) {
            (res.statements as any).unshift(...importNodes);
        }
        debugger;
        return res;

        /**
         * Util functions
         */
        function getText(node: ts.Node) {
            return (node as any).escapedText;
        }

        function createObj(obj: { [key: string]: ts.Expression | ts.Expression[] | string | boolean | undefined }) {
            const keys = Object.keys(obj);
            const props = [];
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                let value = obj[key];
                if (value === undefined) continue;
                if (value === null) value = ts.createNull();
                if (typeof value !== 'object') value = ts.createLiteral(value);
                if (Array.isArray(value)) value = ts.createArrayLiteral(value);
                props.push(ts.createPropertyAssignment(key, value as ts.Expression));
            }
            return ts.createObjectLiteral(props);
        }

        function typeToJS(type: ts.Type): ts.Expression {
            let symbol = type.symbol;
            let args = (type as ts.TypeReference).typeArguments;
            if (type.aliasSymbol) {
                symbol = type.aliasSymbol;
                args = type.aliasTypeArguments;
            }
            if (symbol) {
                const symbolName = symbol.escapedName as string;
                const objectFlags = (type as ts.ObjectType).objectFlags;
                let jsType: ts.Expression = ts.createLiteral(symbolName);
                if (objectFlags & ts.ObjectFlags.Class) {
                    imports.add(symbol);
                    jsType = ts.createIdentifier(
                        (classSymbols.indexOf(symbol) === -1 ? names.classPrefix : '') + symbolName
                    );
                }
                return createObj({
                    [names.fields.type]: jsType,
                    [names.fields.args]: args ? args.map(typeToJS) : undefined,
                });
            }
            return ts.createLiteral(checker.typeToString(type));
        }
    };
};

function printFlags(flag: number, enums: any) {
    const flags = [];
    const keys = Object.keys(enums);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (flag & enums[key]) {
            flags.push(key);
        }
    }
    console.log(flags);
}
