import * as ts from 'typescript';
import { relative } from 'path';

const names = {
    treeMeta: '___treeMeta' as ts.__String,
    skip: 'skip',
    fields: '__fields',
    Base: 'Base',
    classPrefix: '__',
};

export default (ctx: ts.TransformationContext, program: ts.Program): ts.Transformer<ts.SourceFile> => {
    return sourceFile => {
        const checker = program.getTypeChecker();
        const imports = new Set<ts.Symbol>();
        const assignedSymbols = new Set<ts.Symbol>();
        function visitor(node: ts.Node): ts.Node {
            node = ts.visitEachChild(node, visitor, ctx);
            if (ts.isClassDeclaration(node)) {
                const classType = checker.getTypeAtLocation(node) as ts.InterfaceType;
                const classSymbol = classType.symbol;
                let props: ts.Expression[] | undefined = undefined;
                // debugger;
                if (classType && classSymbol && classSymbol.members) {
                    const basedTypes = checker.getBaseTypes(classType);
                    if (
                        basedTypes &&
                        basedTypes.some(type => !!type.symbol && type.symbol.escapedName === names.Base)
                    ) {
                        props = [];
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
                                    typeToObj(propSymbol.escapedName as string, type, !assignedSymbols.has(propSymbol))
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
                        names.fields,
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
        for (const symbol of imports) {
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

        function typeToObj(
            fieldName: string | undefined,
            type: ts.Type,
            readonly?: boolean
        ): ts.ObjectLiteralExpression {
            const symbol = type.symbol;
            if (!symbol) {
                return createObj({
                    name: fieldName,
                    readonly,
                    type: checker.typeToString(type),
                });
            }
            const objectFlags = (type as ts.ObjectType).objectFlags;
            if (
                (objectFlags & ts.ObjectFlags.Reference && symbol.escapedName === 'Map') ||
                symbol.escapedName === 'Array'
            ) {
                const args = (type as ts.TypeReference).typeArguments;
                return createObj({
                    name: fieldName,
                    type: ts.createIdentifier(symbol.escapedName as string),
                    args: args ? args.map(t => typeToObj(undefined, t)) : undefined,
                    readonly,
                });
            }
            if (objectFlags & ts.ObjectFlags.Class) {
                imports.add(symbol);
                return createObj({
                    name: fieldName,
                    readonly,
                    type: ts.createIdentifier((names.classPrefix + symbol.escapedName) as string),
                });
            }
            return createObj({
                name: fieldName,
                readonly,
                type: checker.typeToString(type),
            });
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
